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

import {
  comparePeriods,
  currentPeriod,
  shouldReplaceDirtyPeriod,
  type PeriodKey,
} from '@/domain/period';

import { db, type DbLike } from './client';
import { buildBudgetHistory, getBudget, getOrCreateBudget } from './repositories/budgets';
import { deleteSetting, getSetting, setSetting } from './repositories/settings';
import { budgets } from './schema';
import { writeTransaction } from './transaction';
import { eq } from 'drizzle-orm';

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
  if (!shouldReplaceDirtyPeriod(existing, period)) return;

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

/**
 * Removes the row rather than blanking it.
 *
 * Writing '' left a row that `getSetting` reports as a non-null value, and
 * `markCarryDirty` guards on `existing !== null` — so `comparePeriods('', …)`
 * came back -1 and every subsequent mark returned early. The marker stuck
 * permanently after the first flush, which silently retired the whole
 * recompute-and-notify path §4.3 depends on.
 */
export const clearCarryDirty = (database: DbLike = db): void => {
  deleteSetting('carry_dirty_from', database);
};

/* -------------------------------------------------------------------------- */
/* Recompute                                                                    */
/* -------------------------------------------------------------------------- */

export type CarryOverNotice = {
  /** Past months whose carry-over moved since the user last saw them. */
  periods: PeriodKey[];
  at: number;
};

const EMPTY_NOTICE: CarryOverNotice = { periods: [], at: 0 };

/**
 * Brings the stored snapshots back in line with what the data now says, and
 * records which **past** months moved.
 *
 * The current month is deliberately excluded from that record. It changes on
 * every single expense, and "August updated" the instant you add an August
 * expense is noise. §4.3's notice is about the surprising case: a settlement
 * landing today that quietly changes what February cost.
 *
 * Safe to call when nothing is dirty — it returns immediately.
 */
export function flushCarryOver(database: DbLike = db): PeriodKey[] {
  const dirtyFrom = getCarryDirtyFrom(database);
  if (dirtyFrom === null || dirtyFrom === '') return [];

  const history = buildBudgetHistory(database);
  const now = currentPeriod();
  const changed: PeriodKey[] = [];

  writeTransaction((tx) => {
    for (const result of history) {
      if (comparePeriods(result.period, dirtyFrom) < 0) continue;

      const existing = getBudget(result.period, tx);

      if (existing === null) {
        // Only materialise a row where there is something worth remembering;
        // an untouched month with no budget of its own needs no snapshot.
        if (result.spent === 0 && result.carryOver === 0) continue;
        const created = getOrCreateBudget(result.period, tx);
        tx.update(budgets)
          .set({ carryOverMinor: result.carryOver, carryRecomputedAt: Date.now() })
          .where(eq(budgets.id, created.id))
          .run();
        // A row that did not exist has no previous value to have changed from.
        continue;
      }

      if (existing.carryOverMinor === result.carryOver) continue;

      tx.update(budgets)
        .set({ carryOverMinor: result.carryOver, carryRecomputedAt: Date.now() })
        .where(eq(budgets.id, existing.id))
        .run();

      if (comparePeriods(result.period, now) < 0) changed.push(result.period);
    }

    if (changed.length > 0) {
      const notice: CarryOverNotice = { periods: changed, at: Date.now() };
      setSetting('carry_changed_periods', JSON.stringify(notice), tx);
    }

    clearCarryDirty(tx);
  }, database);

  return changed;
}

export function getCarryOverNotice(database: DbLike = db): CarryOverNotice {
  const raw = getSetting('carry_changed_periods', database);
  if (raw === null || raw === '') return EMPTY_NOTICE;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Array.isArray((parsed as CarryOverNotice).periods)
    ) {
      return parsed as CarryOverNotice;
    }
  } catch {
    // A malformed value is not worth a crash on the home screen; treat it as
    // nothing to report and let the next flush overwrite it.
  }

  return EMPTY_NOTICE;
}

export const dismissCarryOverNotice = (database: DbLike = db): void => {
  setSetting('carry_changed_periods', '', database);
};

/* -------------------------------------------------------------------------- */
/* Scheduling                                                                   */
/* -------------------------------------------------------------------------- */

let scheduled: ReturnType<typeof setTimeout> | null = null;

/**
 * Runs a flush shortly after the current burst of writes settles.
 *
 * Deferred rather than inline so that a Save which writes an expense does not
 * also pay for the recompute before it can navigate away, and so a bulk import
 * of two thousand rows recomputes once at the end rather than two thousand
 * times. Called from useAction, so every write the UI makes is covered, and once
 * at boot to cover a crash mid-write or a month rolling over while the app was
 * closed.
 */
export function scheduleCarryOverFlush(): void {
  if (scheduled !== null) return;
  scheduled = setTimeout(() => {
    scheduled = null;
    try {
      flushCarryOver();
    } catch {
      // A failed recompute leaves the dirty marker in place, so the next write
      // or the next launch tries again. Reads never depended on the snapshot,
      // so nothing the user sees is wrong in the meantime.
    }
  }, 50);
}
