package com.thecstudio.finly.capture

import android.content.Context
import android.content.SharedPreferences

/**
 * What the listener needs to decide without the app running: whether it is on,
 * which apps it may read, and whether it may post the "to review" notification.
 * Package names and flags only — never message text.
 */
class CapturePrefs(context: Context) {
  private val prefs: SharedPreferences =
    context.applicationContext.getSharedPreferences("finly_capture", Context.MODE_PRIVATE)

  var enabled: Boolean
    get() = prefs.getBoolean(KEY_ENABLED, false)
    set(value) = prefs.edit().putBoolean(KEY_ENABLED, value).apply()

  var packages: Set<String>
    get() = prefs.getStringSet(KEY_PACKAGES, emptySet())?.toSet() ?: emptySet()
    set(value) = prefs.edit().putStringSet(KEY_PACKAGES, value.toSet()).apply()

  var notify: Boolean
    get() = prefs.getBoolean(KEY_NOTIFY, false)
    set(value) = prefs.edit().putBoolean(KEY_NOTIFY, value).apply()

  var lastCaptureAt: Long
    get() = prefs.getLong(KEY_LAST_CAPTURE, 0L)
    set(value) = prefs.edit().putLong(KEY_LAST_CAPTURE, value).apply()

  var lastConnectedAt: Long
    get() = prefs.getLong(KEY_LAST_CONNECTED, 0L)
    set(value) = prefs.edit().putLong(KEY_LAST_CONNECTED, value).apply()

  companion object {
    private const val KEY_ENABLED = "enabled"
    private const val KEY_PACKAGES = "packages"
    private const val KEY_NOTIFY = "notify"
    private const val KEY_LAST_CAPTURE = "last_capture_at"
    private const val KEY_LAST_CONNECTED = "last_connected_at"
  }
}
