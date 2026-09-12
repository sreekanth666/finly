package com.thecstudio.finly.capture

import android.app.Notification
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Reads payment alerts as they are posted (D17).
 *
 * No JavaScript runs here — waking the app's JS for every notification on the
 * phone would cost battery for nothing. The service asks the gate, queues what
 * passes, and either tells the running app or, when the app is closed and the
 * user allowed it, posts one "to review" count. The app reads the queue the
 * next time it is opened.
 *
 * Everything happens on one background thread: `onNotificationPosted` arrives
 * on the main thread, and a slow disk must not make the system think the
 * listener is hung.
 *
 * Messages are read one at a time out of a MessagingStyle notification, which
 * is how Google Messages and Samsung Messages post SMS. They re-post the whole
 * conversation with every new message, so the store's `seen` table is what
 * stops the same alert being queued each time.
 */
class CaptureListenerService : NotificationListenerService() {
  private lateinit var executor: ExecutorService
  private lateinit var prefs: CapturePrefs
  private lateinit var store: CaptureStore

  private data class Message(val sender: String?, val title: String?, val text: String, val time: Long)

  override fun onCreate() {
    super.onCreate()
    executor = Executors.newSingleThreadExecutor()
    prefs = CapturePrefs(this)
    store = CaptureStore.get(this)
  }

  override fun onDestroy() {
    if (current === this) current = null
    executor.shutdown()
    super.onDestroy()
  }

  override fun onListenerConnected() {
    super.onListenerConnected()
    connected = true
    current = this
    prefs.lastConnectedAt = System.currentTimeMillis()
    // Anything posted while the service was unbound — after a force stop, an
    // update, or an OEM battery kill — is still on screen. Read it now.
    replayActive()
  }

  override fun onListenerDisconnected() {
    connected = false
    if (current === this) current = null
    super.onListenerDisconnected()
  }

  override fun onNotificationPosted(sbn: StatusBarNotification?) {
    if (sbn == null || !prefs.enabled) return
    executor.execute { handleAll(listOf(sbn)) }
  }

  /** Runs every notification currently on screen through the gate. Idempotent. */
  fun replayActive() {
    if (!prefs.enabled) return
    val active = try {
      activeNotifications?.toList() ?: emptyList()
    } catch (_: Exception) {
      emptyList()
    }
    executor.execute { handleAll(active) }
  }

  private fun handleAll(notifications: List<StatusBarNotification>) {
    var added = 0
    for (sbn in notifications) {
      added += try {
        handle(sbn)
      } catch (_: Exception) {
        store.bump("errors")
        0
      }
    }
    if (added == 0) return

    prefs.lastCaptureAt = System.currentTimeMillis()
    val module = FinlyCaptureModule.instance
    if (module != null && FinlyCaptureModule.inForeground) {
      module.emitCapture(added)
    } else if (prefs.notify) {
      CaptureNotifier.show(this, store.queued())
    }
  }

  private fun handle(sbn: StatusBarNotification): Int {
    val source = sbn.packageName ?: return 0
    if (source == packageName) return 0
    val notification = sbn.notification ?: return 0
    val flags = notification.flags
    if (flags and Notification.FLAG_GROUP_SUMMARY != 0) return 0
    if (flags and Notification.FLAG_ONGOING_EVENT != 0) return 0
    if (flags and Notification.FLAG_FOREGROUND_SERVICE != 0) return 0

    // Nothing at all is recorded about an app the user did not choose — not
    // even a counter.
    if (!CaptureGate.isSmsApp(this, source) && source !in prefs.packages) return 0

    val messages = messagesOf(sbn)
    if (messages.isEmpty()) {
      store.bump("unreadable")
      return 0
    }

    var added = 0
    for (message in messages) {
      when (CaptureGate.judge(this, prefs, source, message.text)) {
        CaptureGate.Verdict.NOT_MONITORED -> return added
        CaptureGate.Verdict.NOT_MONEY -> store.bump("rejected")
        CaptureGate.Verdict.REDACTED -> store.bump("redacted")
        CaptureGate.Verdict.KEEP ->
          if (store.enqueue(source, message.sender, message.title, message.text, message.time)) added += 1
      }
    }
    return added
  }

  @Suppress("DEPRECATION")
  private fun messagesOf(sbn: StatusBarNotification): List<Message> {
    val extras: Bundle = sbn.notification.extras ?: return emptyList()
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()
    val conversation = extras.getCharSequence(Notification.EXTRA_CONVERSATION_TITLE)?.toString()

    val parcels = extras.getParcelableArray(Notification.EXTRA_MESSAGES)
    if (parcels != null && parcels.isNotEmpty()) {
      return parcels.takeLast(MAX_MESSAGES).mapNotNull { parcel ->
        val bundle = parcel as? Bundle ?: return@mapNotNull null
        val text = bundle.getCharSequence("text")?.toString()?.trim().orEmpty()
        if (text.isEmpty()) return@mapNotNull null
        val sender = bundle.getCharSequence("sender")?.toString() ?: conversation ?: title
        Message(sender, title, text, bundle.getLong("time", sbn.postTime))
      }
    }

    val big = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()?.trim()
    if (!big.isNullOrEmpty()) return listOf(Message(title, title, big, sbn.postTime))

    val lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
    if (lines != null && lines.isNotEmpty()) {
      return lines.takeLast(MAX_MESSAGES).mapNotNull { line ->
        val text = line?.toString()?.trim().orEmpty()
        if (text.isEmpty()) null else Message(title, title, text, sbn.postTime)
      }
    }

    val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim().orEmpty()
    return if (text.isEmpty()) emptyList() else listOf(Message(title, title, text, sbn.postTime))
  }

  companion object {
    /** A conversation notification can carry its whole history; the latest few are enough. */
    private const val MAX_MESSAGES = 5

    @Volatile
    var connected: Boolean = false

    @Volatile
    var current: CaptureListenerService? = null
  }
}
