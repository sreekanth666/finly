/**
 * Transactions, and the reason the repository layer is synchronous.
 *
 * expo-sqlite offers `withExclusiveTransactionAsync`, and it is the wrong tool
 * here: it opens a *second* connection, so anything issued through the shared
 * drizzle instance during that window runs outside the transaction entirely —
 * and, once the user turns encryption on, against a connection that was never
 * given the key.
 *
 * Drizzle's expo driver runs every statement through `executeSync` on the one
 * connection, and its `transaction()` wraps BEGIN/COMMIT around a *synchronous*
 * callback. That is a stronger guarantee than the async form: the whole body
 * runs in a single JS tick, so a double-tapped Save button cannot interleave a
 * read of "how much is already settled" with someone else's write. Rules SQLite
 * can't express (§5) are therefore enforced, not merely usually enforced.
 *
 * The cost is that reads block the JS thread. Reading a few hundred local rows
 * costs microseconds, so this is a good trade — but bulk writes must still be
 * chunked with a yield between batches, or a large CSV import janks the UI.
 */

import { db, type DbLike } from './client';

type TransactionBody<T> = (tx: DbLike) => T;

/**
 * Reads-then-writes that must not interleave. `immediate` takes the write lock
 * up front, so the transaction cannot fail partway through on a busy database.
 */
export function writeTransaction<T>(body: TransactionBody<T>): T {
  return db.transaction(body, { behavior: 'immediate' });
}

/** Yield to the UI between batches of a long bulk write. */
export const yieldToUi = (): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
