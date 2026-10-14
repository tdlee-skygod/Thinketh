package com.sskygod21.thinketh

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

// 재부팅 후 상시 알림(F-14)을 복구한다 (D-219). TickerService가 꺼질 때마다 남겨둔
// SharedPreferences 캐시(마지막 문구 풀·시간대·주기)를 읽어 켜져 있던 상태였다면 재시작한다.
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != Intent.ACTION_BOOT_COMPLETED) return

    val prefs = context.getSharedPreferences(TickerService.PREFS_NAME, Context.MODE_PRIVATE)
    if (!prefs.getBoolean(TickerService.PREF_ENABLED, false)) return
    val picksJson = prefs.getString(TickerService.PREF_PICKS, null) ?: return

    val serviceIntent = Intent(context, TickerService::class.java).apply {
      action = TickerService.ACTION_START
      putExtra(TickerService.EXTRA_PICKS, picksJson)
      putExtra(TickerService.EXTRA_FROM, prefs.getString(TickerService.PREF_FROM, "00:00"))
      putExtra(TickerService.EXTRA_TO, prefs.getString(TickerService.PREF_TO, "23:59"))
      putExtra(
        TickerService.EXTRA_INTERVAL_MINUTES,
        prefs.getInt(TickerService.PREF_INTERVAL, 30)
      )
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(serviceIntent)
    } else {
      context.startService(serviceIntent)
    }
  }
}
