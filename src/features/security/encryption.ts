/**
 * Turning database encryption on and off.
 *
 * Off by default (P4). The SQLCipher build ships from M0, and a SQLCipher binary
 * with no key set behaves as ordinary SQLite — which is why this can be enabled
 * later without a native rebuild.
 *
 * The mechanism is not `PRAGMA rekey`. SQLCipher's own documentation is explicit:
 * *"PRAGMA rekey can not be used to encrypt a standard SQLite database"* — it
 * only changes the key on an already-encrypted one. Converting a plaintext
 * database means copying it through `sqlcipher_export()` into a fresh keyed file
 * and swapping the two.
 *
 * Because the connection is a module-scope singleton bound to the old file, the
 * app has to be restarted afterwards. That is a real cost and the UI says so
 * rather than pretending otherwise.
 */

import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';

import { DATABASE_NAME, ENCRYPTION_KEY_STORE_KEY, sqlite } from '@/db/client';
import { RepositoryError } from '@/db/errors';
import { setFlag } from '@/db/repositories/settings';

/** Where expo-sqlite keeps database files, on both platforms. */
const databaseDirectory = () => new File(Paths.document, 'SQLite', DATABASE_NAME);
const WORKING_NAME = 'finly-rekey.db';

export class EncryptionError extends RepositoryError {
  constructor(readonly userMessage: string) {
    super(userMessage);
  }
}

export const isEncrypted = (): boolean =>
  SecureStore.getItem(ENCRYPTION_KEY_STORE_KEY) !== null;

/** 256 bits of entropy, hex-encoded so it survives a PRAGMA string literal. */
function generateKey(): string {
  const bytes = Crypto.getRandomBytes(32);
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const quote = (value: string) => value.replace(/'/g, "''");

/**
 * Copies the live database into `destination`, keyed or unkeyed, then swaps the
 * files. Shared by both directions because they differ only in which side
 * carries the key.
 */
function exportThroughSqlcipher(destinationKey: string | null): void {
  const working = new File(Paths.document, 'SQLite', WORKING_NAME);
  if (working.exists) working.delete();

  const attachKey = destinationKey === null ? '' : quote(destinationKey);

  try {
    /*
     * An empty KEY is how SQLCipher writes a plaintext database, which is what
     * makes this work in both directions.
     */
    sqlite.execSync(`ATTACH DATABASE '${quote(working.uri.replace('file://', ''))}' AS rekeyed KEY '${attachKey}'`);
    sqlite.execSync(`SELECT sqlcipher_export('rekeyed')`);
    sqlite.execSync('DETACH DATABASE rekeyed');
  } catch (cause) {
    if (working.exists) working.delete();
    throw new EncryptionError(
      `The database could not be rewritten, so nothing was changed. ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
    );
  }

  // Only once the copy exists and is complete does the original go.
  sqlite.closeSync();
  SQLite.deleteDatabaseSync(DATABASE_NAME);
  working.move(databaseDirectory());
}

/**
 * @returns the new key, so a caller can offer to show it once. Never stored
 * anywhere but the keychain.
 */
export function enableEncryption(): void {
  if (isEncrypted()) return;

  const key = generateKey();
  exportThroughSqlcipher(key);

  /*
   * The key is written only after the encrypted file is in place. The reverse
   * order would leave a key in the keychain for a plaintext database, which
   * fails to open on the next launch and looks exactly like data loss.
   */
  SecureStore.setItem(ENCRYPTION_KEY_STORE_KEY, key);
  setFlag('encryption_enabled', true);
}

export function disableEncryption(): void {
  if (!isEncrypted()) return;

  exportThroughSqlcipher(null);

  void SecureStore.deleteItemAsync(ENCRYPTION_KEY_STORE_KEY);
  setFlag('encryption_enabled', false);
}
