package com.sskygod21.thinketh

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import java.util.Calendar
import org.json.JSONArray

// Thinketh 상시 알림 (F-14) 포그라운드 서비스.
// 앱이 백그라운드에 있거나 다른 앱을 쓰는 동안에도 알림 시간대 안에서는 지정된 주기(분)마다
// 오늘의 문구 풀을 순환 표시한다. PRIORITY_LOW라 갱신 시 팝업/소리 없이 조용히 내용만 바뀐다.
//
// D-219: 앱이 최근 앱 목록에서 스와이프로 종료되거나(onTaskRemoved), OS가 메모리 부족으로
// 프로세스를 죽였다 살리는 경우(START_STICKY)에도 알림이 계속되도록 마지막 실행 파라미터를
// SharedPreferences(PREFS_NAME)에 캐싱해둔다. 재부팅 복구는 BootReceiver가 같은 캐시를 읽는다.
class TickerService : Service() {

  companion object {
    const val ACTION_START = "com.sskygod21.thinketh.TICKER_START"
    const val ACTION_STOP = "com.sskygod21.thinketh.TICKER_STOP"
    const val EXTRA_PICKS = "picks"
    const val EXTRA_FROM = "notifyFrom"
    const val EXTRA_TO = "notifyTo"
    const val EXTRA_INTERVAL_MINUTES = "intervalMinutes"
    private const val CHANNEL_ID = "thinketh_persistent_ticker"
    private const val NOTIFICATION_ID = 9001
    private const val DEFAULT_INTERVAL_MINUTES = 30

    const val PREFS_NAME = "thinketh_ticker_prefs"
    const val PREF_ENABLED = "enabled"
    const val PREF_PICKS = "picksJson"
    const val PREF_FROM = "notifyFrom"
    const val PREF_TO = "notifyTo"
    const val PREF_INTERVAL = "intervalMinutes"
  }

  private val handler = Handler(Looper.getMainLooper())
  private var picks: List<Pair<String, String>> = emptyList()
  private var picksJson = "[]"
  private var notifyFrom = "00:00"
  private var notifyTo = "23:59"
  private var intervalMinutes = DEFAULT_INTERVAL_MINUTES
  private var intervalMs = DEFAULT_INTERVAL_MINUTES * 60_000L
  private var index = 0

  private val tickRunnable = object : Runnable {
    override fun run() {
      if (!isWithinRange()) {
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        return
      }
      if (picks.isNotEmpty()) {
        index = (index + 1) % picks.size
        updateNotification()
      }
      handler.postDelayed(this, intervalMs)
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      savePrefs(enabled = false)
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
      return START_NOT_STICKY
    }

    if (intent == null) {
      // OS가 메모리 부족 등으로 프로세스를 죽였다가 START_STICKY 계약에 따라 서비스를 재기동한
      // 경우 — 원래 시작시킨 Intent가 없으므로 마지막으로 저장해둔 값을 복원한다.
      if (!restoreFromPrefs()) {
        stopSelf()
        return START_NOT_STICKY
      }
    } else {
      picksJson = intent.getStringExtra(EXTRA_PICKS) ?: "[]"
      notifyFrom = intent.getStringExtra(EXTRA_FROM) ?: "00:00"
      notifyTo = intent.getStringExtra(EXTRA_TO) ?: "23:59"
      intervalMinutes = intent.getIntExtra(EXTRA_INTERVAL_MINUTES, DEFAULT_INTERVAL_MINUTES)
        .coerceIn(1, 60)
      picks = parsePicks(picksJson)
      index = 0
      savePrefs(enabled = true)
    }

    intervalMs = intervalMinutes.coerceIn(1, 60) * 60_000L

    createChannel()

    // Android는 startForegroundService() 호출 후 몇 초 안에 반드시 startForeground()를 불러야 한다.
    // 지키지 않으면 ForegroundServiceDidNotStartInTimeException으로 앱 프로세스 전체가 강제 종료된다.
    // 그래서 시간대/문구 존재 여부와 무관하게 먼저 startForeground()로 계약을 만족시킨 뒤,
    // 조건에 안 맞으면 바로 stopForeground + stopSelf로 정리한다.
    startForeground(NOTIFICATION_ID, buildNotification())

    if (!isWithinRange() || picks.isEmpty()) {
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
      return START_NOT_STICKY
    }

    handler.removeCallbacks(tickRunnable)
    handler.postDelayed(tickRunnable, intervalMs)

    // START_STICKY: 알림 시간대 안에서 정상 동작 중에 OS가 프로세스를 죽이면 시스템이 이 서비스를
    // (intent 없이) 재기동하도록 요청한다 — 이때 위 restoreFromPrefs() 경로가 사용된다.
    return START_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // 사용자가 최근 앱 목록에서 Thinketh를 스와이프로 종료해도, 상시 알림이 켜져 있었다면
    // 즉시 같은 파라미터로 자신을 다시 시작해 알림이 끊기지 않게 한다 (D-219).
    if (getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getBoolean(PREF_ENABLED, false)) {
      val restartIntent = Intent(applicationContext, TickerService::class.java).apply {
        action = ACTION_START
        putExtra(EXTRA_PICKS, picksJson)
        putExtra(EXTRA_FROM, notifyFrom)
        putExtra(EXTRA_TO, notifyTo)
        putExtra(EXTRA_INTERVAL_MINUTES, intervalMinutes)
      }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        applicationContext.startForegroundService(restartIntent)
      } else {
        applicationContext.startService(restartIntent)
      }
    }
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    handler.removeCallbacks(tickRunnable)
    super.onDestroy()
  }

  private fun savePrefs(enabled: Boolean) {
    getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit().apply {
      putBoolean(PREF_ENABLED, enabled)
      if (enabled) {
        putString(PREF_PICKS, picksJson)
        putString(PREF_FROM, notifyFrom)
        putString(PREF_TO, notifyTo)
        putInt(PREF_INTERVAL, intervalMinutes)
      }
      apply()
    }
  }

  private fun restoreFromPrefs(): Boolean {
    val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    if (!prefs.getBoolean(PREF_ENABLED, false)) return false

    picksJson = prefs.getString(PREF_PICKS, null) ?: return false
    notifyFrom = prefs.getString(PREF_FROM, "00:00") ?: "00:00"
    notifyTo = prefs.getString(PREF_TO, "23:59") ?: "23:59"
    intervalMinutes = prefs.getInt(PREF_INTERVAL, DEFAULT_INTERVAL_MINUTES).coerceIn(1, 60)
    picks = parsePicks(picksJson)
    index = 0
    return picks.isNotEmpty()
  }

  private fun parsePicks(json: String): List<Pair<String, String>> {
    return try {
      val arr = JSONArray(json)
      (0 until arr.length()).map {
        val obj = arr.getJSONObject(it)
        obj.getString("category") to obj.getString("text")
      }
    } catch (e: Exception) {
      emptyList()
    }
  }

  private fun isWithinRange(): Boolean {
    val cal = Calendar.getInstance()
    val nowMinutes = cal.get(Calendar.HOUR_OF_DAY) * 60 + cal.get(Calendar.MINUTE)
    val from = notifyFrom.split(":").map { it.toInt() }
    val to = notifyTo.split(":").map { it.toInt() }
    val fromMinutes = from[0] * 60 + from[1]
    val toMinutes = to[0] * 60 + to[1]
    return nowMinutes in fromMinutes until toMinutes
  }

  private fun createChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val manager = getSystemService(NotificationManager::class.java)
      if (manager.getNotificationChannel(CHANNEL_ID) == null) {
        val channel = NotificationChannel(CHANNEL_ID, "상시 알림", NotificationManager.IMPORTANCE_LOW)
        manager.createNotificationChannel(channel)
      }
    }
  }

  private fun buildNotification(): Notification {
    val current = picks.getOrNull(index)
    val title = current?.first?.let { "✦ $it" } ?: "Thinketh"
    val text = current?.second ?: ""

    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
    val pendingIntentFlags = PendingIntent.FLAG_IMMUTABLE
    val pendingIntent = PendingIntent.getActivity(this, 0, launchIntent, pendingIntentFlags)

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(text)
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setContentIntent(pendingIntent)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setOnlyAlertOnce(true)
      .build()
  }

  private fun updateNotification() {
    val manager = getSystemService(NotificationManager::class.java)
    manager.notify(NOTIFICATION_ID, buildNotification())
  }
}
