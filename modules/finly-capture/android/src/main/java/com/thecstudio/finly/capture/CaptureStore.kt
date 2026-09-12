package com.thecstudio.finly.capture

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.security.MessageDigest

/**
 * The listener's queue: messages that passed the gate, waiting for the app to
 * drain them into its own database.
 *
 * A separate, plain SQLite file rather than the app's database. The app's
 * database may be encrypted with a key only the JavaScript side holds, and the
 * app relies on having the only connection to it. The app never opens this
 * file either — it calls pull and ack, and acknowledges only after its own
 * write has committed, so a crash in between replays rather than loses.
 *
 * `seen` remembers what was queued for three days, so a notification the SMS
 * app re-posts, or one the service replays when it reconnects, is not queued a
 * second time after the first copy has been drained.
 */
class CaptureStore private constructor(context: Context) :
  SQLiteOpenHelper(context.applicationContext, "finly_capture.db", null, 1) {

  override fun onConfigure(db: SQLiteDatabase) {
    db.enableWriteAheadLogging()
  }

  override fun onCreate(db: SQLiteDatabase) {
    db.execSQL(
      "CREATE TABLE captures (" +
        "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
        "package TEXT NOT NULL, sender TEXT, title TEXT, body TEXT NOT NULL, " +
        "posted_at INTEGER NOT NULL, created_at INTEGER NOT NULL)"
    )
    db.execSQL("CREATE TABLE seen (hash TEXT PRIMARY KEY, seen_at INTEGER NOT NULL)")
    db.execSQL("CREATE TABLE counters (name TEXT PRIMARY KEY, value INTEGER NOT NULL)")
  }

  override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) = Unit

  /** Queues one message. False when it was already seen recently. */
  @Synchronized
  fun enqueue(packageName: String, sender: String?, title: String?, body: String, postedAt: Long): Boolean {
    val db = writableDatabase
    val now = System.currentTimeMillis()
    val hash = hashOf(packageName, sender, body)

    db.beginTransaction()
    try {
      db.delete("seen", "seen_at < ?", arrayOf((now - SEEN_TTL_MS).toString()))

      val seen = ContentValues().apply {
        put("hash", hash)
        put("seen_at", now)
      }
      if (db.insertWithOnConflict("seen", null, seen, SQLiteDatabase.CONFLICT_IGNORE) == -1L) {
        db.setTransactionSuccessful()
        return false
      }

      val row = ContentValues().apply {
        put("package", packageName)
        put("sender", sender)
        put("title", title)
        put("body", body)
        put("posted_at", postedAt)
        put("created_at", now)
      }
      db.insert("captures", null, row)

      // A queue nobody drains must not grow forever.
      db.delete("captures", "created_at < ?", arrayOf((now - QUEUE_TTL_MS).toString()))
      db.execSQL(
        "DELETE FROM captures WHERE id NOT IN (SELECT id FROM captures ORDER BY id DESC LIMIT $QUEUE_CAP)"
      )

      db.setTransactionSuccessful()
      return true
    } finally {
      db.endTransaction()
    }
  }

  @Synchronized
  fun pull(limit: Int): List<Map<String, Any?>> {
    val rows = mutableListOf<Map<String, Any?>>()
    readableDatabase.rawQuery(
      "SELECT id, package, sender, title, body, posted_at FROM captures ORDER BY id ASC LIMIT ?",
      arrayOf(limit.coerceIn(1, 500).toString())
    ).use { cursor ->
      while (cursor.moveToNext()) {
        rows.add(
          mapOf(
            "id" to cursor.getLong(0).toDouble(),
            "packageName" to cursor.getString(1),
            "sender" to if (cursor.isNull(2)) null else cursor.getString(2),
            "title" to if (cursor.isNull(3)) null else cursor.getString(3),
            "body" to cursor.getString(4),
            "postedAt" to cursor.getLong(5).toDouble()
          )
        )
      }
    }
    return rows
  }

  @Synchronized
  fun ack(ids: List<Long>) {
    if (ids.isEmpty()) return
    val db = writableDatabase
    db.beginTransaction()
    try {
      for (id in ids) db.delete("captures", "id = ?", arrayOf(id.toString()))
      db.setTransactionSuccessful()
    } finally {
      db.endTransaction()
    }
  }

  @Synchronized
  fun queued(): Int =
    readableDatabase.rawQuery("SELECT COUNT(*) FROM captures", null).use { cursor ->
      if (cursor.moveToFirst()) cursor.getInt(0) else 0
    }

  @Synchronized
  fun clear() {
    val db = writableDatabase
    db.delete("captures", null, null)
    db.delete("seen", null, null)
  }

  /**
   * Counters for the diagnostics screen: numbers only, never content. Two
   * statements rather than an upsert, which SQLite before 3.24 (Android 10 and
   * older) does not have.
   */
  @Synchronized
  fun bump(name: String) {
    val db = writableDatabase
    db.execSQL("INSERT OR IGNORE INTO counters (name, value) VALUES (?, 0)", arrayOf<Any?>(name))
    db.execSQL("UPDATE counters SET value = value + 1 WHERE name = ?", arrayOf<Any?>(name))
  }

  @Synchronized
  fun counters(): Map<String, Int> {
    val result = mutableMapOf<String, Int>()
    readableDatabase.rawQuery("SELECT name, value FROM counters", null).use { cursor ->
      while (cursor.moveToNext()) result[cursor.getString(0)] = cursor.getInt(1)
    }
    return result
  }

  companion object {
    private const val SEEN_TTL_MS = 3L * 24 * 60 * 60 * 1000
    private const val QUEUE_TTL_MS = 30L * 24 * 60 * 60 * 1000
    private const val QUEUE_CAP = 2000

    @Volatile
    private var instance: CaptureStore? = null

    fun get(context: Context): CaptureStore =
      instance ?: synchronized(this) {
        instance ?: CaptureStore(context).also { instance = it }
      }

    private fun hashOf(packageName: String, sender: String?, body: String): String {
      val normalised = body.trim().replace(Regex("\\s+"), " ").lowercase()
      val bytes = MessageDigest.getInstance("SHA-256")
        .digest("$packageName|${sender ?: ""}|$normalised".toByteArray(Charsets.UTF_8))
      return bytes.joinToString("") { "%02x".format(it) }
    }
  }
}
