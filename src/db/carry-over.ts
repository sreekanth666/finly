/**
 * Keeping the carry-over snapshot honest.
 *
 * §4.4 specifies `budgets.carry_over_minor` as a cache the reads depend on. This
 * app derives every total live instead — one grouped aggregate plus the pure
 * fold is sub-millisecond at any plausible size, and cache invalidation across
 * expenses, settlements, budgets, soft deletes and date edits that move an
 * expense between months is the single most bug-prone thing in the design.
 *
 * The column still exists and is still written, but as a *snapshot of what the
 * user last saw*. That is what makes §4.3's "February updated" notice possible:
 * when a settlement lands in March and recomputes February, the snapshot stops
 * matching, and the difference is exactly what there is to tell the user about.
 *
 * The dirty marker is persisted rather than held in memory, so a crash between
 * a write and its recompute cannot leave a snapshot that is silently wrong.
 */

import { comparePeriods, type PeriodKey } from '@/domain/period';

import { db, type DbLike } from './client';
import { getSetting, setSetting } from './repositories/settings';

/**
 * Records that period `period`, and everything after it, may no longer match its
 * stored snapshot.
 *
 * Always called from inside the caller's transaction, so the mark and the write
 * that caused it commit together or not at all.
 */
export function markCarryDirty(period: PeriodKey, database: DbLike = db): void {
  const existing = getSetting('carry_dirty_from', database);

  // The earliest dirty period wins: two edits in different months must leave the
  // recompute starting from the older of them, not the more recent.
  if (existing !== null && comparePeriods(existing, period) <= 0) return;

  setSetting('carry_dirty_from', period, database);
}

/**
 * Marks both sides of a move. Editing an expense's date takes spend out of one
 * month and puts it into another, so both are stale — and only the earlier of
 * them actually needs recording, since the recompute walks forward.
 */
export function markCarryDirtyForMove(
  from: PeriodKey,
  to: PeriodKey,
  database: DbLike = db,
): void {
  markCarryDirty(comparePeriods(from, to) <= 0 ? from : to, database);
}

export const getCarryDirtyFrom = (database: DbLike = db): PeriodKey | null =>
  getSetting('carry_dirty_from', database);

export const clearCarryDirty = (database: DbLike = db): void => {
  setSetting('carry_dirty_from', '', database);
};
