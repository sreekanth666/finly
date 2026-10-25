package com.thecstudio.finly.capture

import android.content.Context
import android.provider.Telephony

/**
 * What the listener is allowed to keep. Decided here, in native code, before
 * anything is written, so a notification that is not a payment alert never
 * reaches storage at all — the spyware policy's line, and ours.
 *
 * - Only apps on the list: the default SMS app (and the common SMS apps, since
 *   the default can change), plus the payment apps the user chose.
 * - From an SMS app, only text with a figure and a money word in it. A chat
 *   from a friend has neither.
 * - From a payment app, only text with a figure in it.
 *
 * The finer judgement — OTP, offer, statement, transfer — is the app's, on the
 * phone, once it drains the queue. This gate only has to be cheap and certain.
 */
object CaptureGate {
  private val SMS_APPS = setOf(
    "com.google.android.apps.messaging",
    "com.samsung.android.messaging",
    "com.android.mms",
    "com.android.messaging",
    "com.oneplus.mms",
    "com.motorola.messaging",
    "com.truecaller"
  )

  // Whole words only: without the boundaries "rs" matched "hours" and
  // "Callers", "card" matched "postcard" and "sent" matched "present", and a
  // friend's chat with any digit in it was stored. A currency word counts only
  // before a figure, as banks write it ("Rs.500", "INR500", "Rs: 1,200").
  // Read by capture-gate.test.ts, which holds it to every alert in the corpus.
  private val MONEY = Regex(
    "(?i)(₹|\\b(?:rs|inr)\\.?\\s*:?\\s*\\d|\\b(?:debited|credited|spent|paid|sent|received|txn|transaction|a/c|acct|card|upi|withdrawn|refund|reversal)\\b)"
  )
  private val DIGIT = Regex("\\d")
  private val REDACTED = Regex("(?i)(sensitive|content hidden)")

  enum class Verdict { NOT_MONITORED, NOT_MONEY, REDACTED, KEEP }

  fun isSmsApp(context: Context, packageName: String): Boolean {
    if (packageName in SMS_APPS) return true
    val default = try {
      Telephony.Sms.getDefaultSmsPackage(context)
    } catch (_: Exception) {
      null
    }
    return default != null && default == packageName
  }

  fun judge(context: Context, prefs: CapturePrefs, packageName: String, text: String): Verdict {
    val sms = isSmsApp(context, packageName)
    if (!sms && packageName !in prefs.packages) return Verdict.NOT_MONITORED

    if (!DIGIT.containsMatchIn(text)) {
      // Android 15+ swaps a notification it thinks holds a code for a short,
      // digit-free placeholder. Counted, so the settings screen can say so.
      return if (sms && (REDACTED.containsMatchIn(text) || text.length < 60)) Verdict.REDACTED else Verdict.NOT_MONEY
    }
    if (sms && !MONEY.containsMatchIn(text)) return Verdict.NOT_MONEY
    return Verdict.KEEP
  }
}
