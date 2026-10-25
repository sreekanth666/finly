/**
 * What the user has said about each sender, as counts (D21). SQL only.
 *
 * Counted where a candidate is resolved, in the same transaction, and taken
 * back where that is undone, so the counts always match what the user did.
 * Only a confirmation and "not a payment" count; a discard never does.
 */

import { eq, isNull } from 'drizzle-orm';

import { nextCounts, type LabelCounts } from '@/domain/txn-detect/model/doubt';

import { db, type DbLike } from '../client';
import { detectorLabels } from '../schema';

export type LabelField = keyof LabelCounts;

/**
 * Adds `delta` to one count for `key`, never below zero. A key the user had
 * asked Finly to forget starts again from nothing.
 */
export function bumpLabel(key: string | null, field: LabelField, delta: 1 | -1, tx: DbLike): void {
  if (key === null) return;
  const now = Date.now();
  const row = tx.select().from(detectorLabels).where(eq(detectorLabels.key, key)).get();
  const current = row === undefined || row.deletedAt !== null ? null : row;
  const { confirmed, notTransaction } = nextCounts(current, field, delta);
  tx.insert(detectorLabels)
    .values({ key, confirmed, notTransaction, updatedAt: now, deletedAt: null })
    .onConflictDoUpdate({
      target: detectorLabels.key,
      set: { confirmed, notTransaction, updatedAt: now, deletedAt: null },
    })
    .run();
}

/** Every sender the user has said something about. */
export function listLabelCounts(database: DbLike = db): Map<string, LabelCounts> {
  return new Map(
    database
      .select()
      .from(detectorLabels)
      .where(isNull(detectorLabels.deletedAt))
      .all()
      .map((row) => [row.key, { confirmed: row.confirmed, notTransaction: row.notTransaction }]),
  );
}

/** "Forget what Finly learned from your choices." */
export function forgetLabels(database: DbLike = db): void {
  database
    .update(detectorLabels)
    .set({ deletedAt: Date.now(), updatedAt: Date.now() })
    .where(isNull(detectorLabels.deletedAt))
    .run();
}
