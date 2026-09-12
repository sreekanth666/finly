package com.thecstudio.finly.capture

import android.app.NotificationManager
import android.content.ActivityNotFoundException
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.provider.Telephony
import android.service.notification.NotificationListenerService
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * The app's handle on transaction detection (D17): switching the listener on
 * and off, sending the user to the system screen that grants access, and
 * draining what the listener queued.
 *
 * The app's database is the source of truth for every setting; the app pushes
 * them here on launch and whenever they change, because the listener has to
 * decide without the app running.
 */
class FinlyCaptureModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "The React context is not ready." }

  private val component: ComponentName
    get() = ComponentName(context, CaptureListenerService::class.java)

  override fun definition() = ModuleDefinition {
    Name("FinlyCapture")

    Events("onCapture", "onSharedText")

    OnCreate {
      instance = this@FinlyCaptureModule
    }

    OnDestroy {
      if (instance === this@FinlyCaptureModule) instance = null
    }

    OnActivityEntersForeground {
      inForeground = true
      appContext.reactContext?.let { CaptureNotifier.cancel(it) }
    }

    OnActivityEntersBackground {
      inForeground = false
    }

    /*
     * Text shared to Finly from another app's share sheet — usually a payment
     * SMS long-pressed in the messages app. A running app gets it here; a cold
     * start leaves it on the launch intent for consumeSharedText to find.
     */
    OnNewIntent { intent ->
      val text = sharedTextOf(intent)
      if (text != null) {
        pendingShare = text
        sendEvent("onSharedText", mapOf("available" to true))
      }
    }

    Function("consumeSharedText") {
      val pending = pendingShare
      if (pending != null) {
        pendingShare = null
        return@Function pending
      }
      val intent = appContext.currentActivity?.intent ?: return@Function null
      val text = sharedTextOf(intent) ?: return@Function null
      // Consumed, so returning to the app or rotating it does not read it again.
      intent.removeExtra(Intent.EXTRA_TEXT)
      intent.action = Intent.ACTION_MAIN
      text
    }

    Function("isGranted") {
      isGranted()
    }

    Function("isConnected") {
      CaptureListenerService.connected
    }

    Function("getDefaultSmsPackage") {
      try {
        Telephony.Sms.getDefaultSmsPackage(context)
      } catch (_: Exception) {
        null
      }
    }

    Function("setEnabled") { enabled: Boolean ->
      CapturePrefs(context).enabled = enabled
      context.packageManager.setComponentEnabledSetting(
        component,
        if (enabled) PackageManager.COMPONENT_ENABLED_STATE_ENABLED else PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
        PackageManager.DONT_KILL_APP
      )
      if (!enabled) {
        CaptureStore.get(context).clear()
        CaptureNotifier.cancel(context)
      }
    }

    Function("setMonitoredPackages") { packages: List<String> ->
      CapturePrefs(context).packages = packages.toSet()
    }

    Function("setNotifyEnabled") { enabled: Boolean ->
      CapturePrefs(context).notify = enabled
    }

    Function("openListenerSettings") {
      openListenerSettings()
    }

    Function("requestRebind") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        NotificationListenerService.requestRebind(component)
      }
    }

    AsyncFunction("replayActive") {
      val service = CaptureListenerService.current
      service?.replayActive()
      service != null
    }

    AsyncFunction("pull") { limit: Int ->
      CaptureStore.get(context).pull(limit)
    }

    AsyncFunction("ack") { ids: List<Double> ->
      CaptureStore.get(context).ack(ids.map { it.toLong() })
    }

    AsyncFunction("stats") {
      val store = CaptureStore.get(context)
      val prefs = CapturePrefs(context)
      val counters = store.counters()
      mapOf(
        "queued" to store.queued(),
        "rejected" to (counters["rejected"] ?: 0),
        "redacted" to (counters["redacted"] ?: 0),
        "unreadable" to (counters["unreadable"] ?: 0),
        "errors" to (counters["errors"] ?: 0),
        "lastCaptureAt" to prefs.lastCaptureAt.toDouble(),
        "lastConnectedAt" to prefs.lastConnectedAt.toDouble()
      )
    }

    AsyncFunction("installedPackages") { candidates: List<String> ->
      candidates.filter { isInstalled(it) }
    }

    AsyncFunction("appLabels") { packages: List<String> ->
      packages.associateWith { labelOf(it) }
    }

    /*
     * The apps with a notification on screen right now, for "add the app this
     * payment alert came from". Package names and labels only, and only when
     * the user asks — nothing is stored.
     */
    AsyncFunction("listActivePackages") {
      val active = try {
        CaptureListenerService.current?.activeNotifications?.toList() ?: emptyList()
      } catch (_: Exception) {
        emptyList()
      }
      active
        .mapNotNull { it.packageName }
        .distinct()
        .filter { it != context.packageName }
        .map { mapOf("packageName" to it, "label" to labelOf(it)) }
    }
  }

  private fun sharedTextOf(intent: Intent?): String? {
    if (intent == null || intent.action != Intent.ACTION_SEND) return null
    if (intent.type?.startsWith("text/") != true) return null
    return intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.toString()?.takeIf { it.isNotBlank() }
  }

  fun emitCapture(count: Int) {
    sendEvent("onCapture", mapOf("count" to count))
  }

  private fun isGranted(): Boolean {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return false
      return manager.isNotificationListenerAccessGranted(component)
    }
    val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners") ?: return false
    return flat.split(":").any { ComponentName.unflattenFromString(it) == component }
  }

  private fun openListenerSettings() {
    val activity = appContext.currentActivity
    val starter: Context = activity ?: context
    val flags = if (activity == null) Intent.FLAG_ACTIVITY_NEW_TASK else 0

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      // Read outside apply {}: inside it, `component` is the Intent's own
      // nullable property, not this module's listener component.
      val listener = component.flattenToString()
      val detail = Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS).apply {
        putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, listener)
        addFlags(flags)
      }
      try {
        starter.startActivity(detail)
        return
      } catch (_: ActivityNotFoundException) {
        // Some OEM builds lack the per-app screen. The list is always there.
      }
    }
    starter.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply { addFlags(flags) })
  }

  @Suppress("DEPRECATION")
  private fun isInstalled(packageName: String): Boolean =
    try {
      context.packageManager.getPackageInfo(packageName, 0)
      true
    } catch (_: PackageManager.NameNotFoundException) {
      false
    }

  @Suppress("DEPRECATION")
  private fun labelOf(packageName: String): String =
    try {
      val info = context.packageManager.getApplicationInfo(packageName, 0)
      context.packageManager.getApplicationLabel(info).toString()
    } catch (_: Exception) {
      packageName
    }

  companion object {
    @Volatile
    var instance: FinlyCaptureModule? = null

    @Volatile
    var inForeground: Boolean = false

    @Volatile
    private var pendingShare: String? = null
  }
}
