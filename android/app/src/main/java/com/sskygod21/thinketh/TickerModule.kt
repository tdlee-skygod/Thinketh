package com.sskygod21.thinketh

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

// JS(lib/notifications.ts)에서 TickerService(F-14 상시 알림)를 시작/중지하기 위한 브리지.
class TickerModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "TickerModule"

  @ReactMethod
  fun start(picksJson: String, notifyFrom: String, notifyTo: String, intervalMinutes: Int) {
    val context = reactApplicationContext
    val intent = Intent(context, TickerService::class.java).apply {
      action = TickerService.ACTION_START
      putExtra(TickerService.EXTRA_PICKS, picksJson)
      putExtra(TickerService.EXTRA_FROM, notifyFrom)
      putExtra(TickerService.EXTRA_TO, notifyTo)
      putExtra(TickerService.EXTRA_INTERVAL_MINUTES, intervalMinutes)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent)
    } else {
      context.startService(intent)
    }
  }

  @ReactMethod
  fun stop() {
    val context = reactApplicationContext
    val intent = Intent(context, TickerService::class.java).apply {
      action = TickerService.ACTION_STOP
    }
    context.startService(intent)
  }

  // 제조사 배터리 최적화(삼성/샤오미 등)가 포그라운드 서비스를 강제 종료하는 것을 막기 위해
  // 앱을 배터리 최적화 예외 목록에 추가하도록 사용자에게 요청한다 (D-219).
  @ReactMethod
  fun requestIgnoreBatteryOptimizations() {
    val context = reactApplicationContext
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    if (powerManager.isIgnoringBatteryOptimizations(context.packageName)) return

    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
      data = Uri.parse("package:${context.packageName}")
      flags = Intent.FLAG_ACTIVITY_NEW_TASK
    }
    context.startActivity(intent)
  }

  @ReactMethod
  fun isIgnoringBatteryOptimizations(promise: Promise) {
    val context = reactApplicationContext
    val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    promise.resolve(powerManager.isIgnoringBatteryOptimizations(context.packageName))
  }
}
