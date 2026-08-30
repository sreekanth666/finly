/**
 * The one database connection.
 *
 * Opened at module scope rather than through `SQLiteProvider`, deliberately.
 * `SQLiteProvider` opens and owns *its own* connection, and `PRAGMA
 * foreign_keys` is per-connection — its `onInit` would enable foreign keys on a
 * connection nothing uses, while the `db` singleton every repository imports ran
 * with them off. One connection, configured where it is opened.
 *
 * The whole open is synchronous, including the encryption key, which is why
 * `SecureStore.getItem` is used rather than its async twin. That keeps
 * `useMigrations` usable and keeps a nullable, half-initialised database out of
 * the type system.
 *
 * It is also wrapped in try/catch, because this runs during module evaluation —
 * before React exists. A corrupt database file would otherwise throw at bundle
 * eval and produce a white screen instead of the recovery screen the whole point
 * of which is to get the user's data back out (§10).
 */

import { drizzle } from 'drizzle-orm/expo-sqlite';
import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type { SQLiteRunResult } from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import * as schema from './schema';

export const DATABASE_NAME = 'finly.db';

/**
 * Where the SQLCipher passphrase lives once the user turns encryption on in
 * Settings. Absent means the database is plain SQLite — which is what a
 * SQLCipher build gives you when no key is ever set, so encryption can be
 * enabled later without a native rebuild.
 */
export const ENCRYPTION_KEY_STORE_KEY = 'finly.db.key';

function readEncryptionKey(): string | null {
  try {
    return SecureStore.getItem(ENCRYPTION_KEY_STORE_KEY);
  } catch {
    // A locked or unavailable keychain must not be indistinguishable from "no
    // encryption" — but it also must not crash the open. Report it as a fatal
    // open error instead, via the throw below.
    throw new Error('The device keychain could not be read, so the database stayed locked.');
  }
}

function open(): SQLite.SQLiteDatabase {
  const encryptionKey = readEncryptionKey();

  // enableChangeListener is what every reactive query in the app is built on.
  const sqlite = SQLite.openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });

  if (encryptionKey !== null) {
    // Must be the very first statement on the connection.
    sqlite.execSync(`PRAGMA key = '${encryptionKey.replace(/'/g, "''")}'`);
  }

  sqlite.execSync('PRAGMA journal_mode = WAL');
  sqlite.execSync('PRAGMA foreign_keys = ON');

  return sqlite;
}

let openedDatabase: SQLite.SQLiteDatabase | null = null;

/** Non-null when the connection could not be opened. Read by the root layout. */
export let openError: Error | null = null;

try {
  openedDatabase = open();
} catch (cause) {
  openError = cause instanceof Error ? cause : new Error(String(cause));
}

/**
 * Non-null in every code path that runs after the root layout has confirmed
 * `openError === null`. Repositories may treat it as always present; nothing
 * below the boot gate renders while it isn't.
 */
export const sqlite = openedDatabase as SQLite.SQLiteDatabase;

export const db = drizzle(sqlite, { schema });

export type Db = typeof db;

/**
 * What repositories actually take. Both the database and a transaction handle
 * satisfy it, so a repository function can be called standalone or composed into
 * a larger transaction without a cast and without a second overload.
 */
export type DbLike = BaseSQLiteDatabase<'sync', SQLiteRunResult, typeof schema>;
