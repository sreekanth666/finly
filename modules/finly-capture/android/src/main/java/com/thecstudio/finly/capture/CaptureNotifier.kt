package com.thecstudio.finly.capture

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build

/**
 * "Finly found 3 transactions to review", while the app is closed.
 *
 * One notification, replaced rather than stacked, on its own channel so it can
 * be silenced without silencing the daily reminder. It never says an amount or
 * a payee: the app may be locked, and a notification is readable on the lock
 * screen. Skipped silently when notifications are not allowed.
 */
object CaptureNotifier {
  private const val CHANNEL_ID = "capture"
  private const val NOTIFICATION_ID = 7301

  fun show(context: Context, count: Int) {
    if (count <= 0) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    if (!manager.areNotificationsEnabled()) return

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL_ID, "Transactions to review", NotificationManager.IMPORTANCE_LOW)
      channel.description = "A count of payments read from your alerts, waiting for you to confirm."
      manager.createNotificationChannel(channel)
    }

    val open = Intent(Intent.ACTION_VIEW, Uri.parse("finly://inbox")).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    val pending = PendingIntent.getActivity(
      context,
      NOTIFICATION_ID,
      open,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )

    val title = if (count == 1) "1 transaction to review" else "$count transactions to review"

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context)
    }

    val notification = builder
      .setSmallIcon(iconOf(context))
      .setContentTitle(title)
      .setContentText("Read from your payment alerts. Nothing is added until you confirm.")
      .setContentIntent(pending)
      .setAutoCancel(true)
      .setOnlyAlertOnce(true)
      .setVisibility(Notification.VISIBILITY_PRIVATE)
      .build()

    manager.notify(NOTIFICATION_ID, notification)
  }

  fun cancel(context: Context) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
    manager.cancel(NOTIFICATION_ID)
  }

  /** The monochrome icon expo-notifications generates, or the launcher icon. */
  private fun iconOf(context: Context): Int {
    val generated = context.resources.getIdentifier("notification_icon", "drawable", context.packageName)
    return if (generated != 0) generated else context.applicationInfo.icon
  }
}
