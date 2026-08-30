/**
 * Budget and carry-over — §4.4 of the MVP plan, pure and storage-free.
 *
 *   carryOver(P) = max(0, spent(P−1) − available(P−1))   // overspend only
 *   available(P) = budget(P) − carryOver(P)
 *   remaining(P) = available(P) − spent(P)
 *
 * Two properties this encodes deliberately, because both are easy to get wrong:
 *
 * - Carry-over is **overspend only** (D2). An underspent month banks nothing, so
 *   a frugal January can't license a blowout in February.
 * - It **compounds**. `available(P−1)` already carries its own deduction, so two
 *   bad months in a row bite twice.
 *
 * Arithmetic is in integer paise, so the running total cannot drift by a
 * fraction over a year of months the way a float would.
 */

import {
  clampMinorAtZero,
  subMinor,
  ZERO_MINOR,
  type Minor,
} from './money';
import type { PeriodKey } from './period';

export type Period = {
  period: PeriodKey;
  budget: Minor;
  spent: Minor;
};

export type PeriodResult = Period & {
  /** Overspend inherited from the month before. */
  carryOver: Minor;
  /** What there was to spend: budget less the carry-over. */
  available: Minor;
  /** What was left. Negative means this month overspent in turn. */
  remaining: Minor;
  isOverspent: boolean;
};

/**
 * @param periods oldest first, and **dense** — every month between the first and
 * the last, including ones with no activity. A gap is not the same as a month
 * that never happened: skipping an empty January carries December's overspend
 * into February as though January had been free.
 *
 * The first period ever recorded carries nothing.
 */
export function buildCarryOverHistory(periods: readonly Period[]): PeriodResult[] {
  let carryOver: Minor = ZERO_MINOR;

  return periods.map((period) => {
    const available = subMinor(period.budget, carryOver);
    const remaining = subMinor(available, period.spent);
    const result: PeriodResult = {
      ...period,
      carryOver,
      available,
      remaining,
      isOverspent: remaining < 0,
    };

    carryOver = clampMinorAtZero(subMinor(period.spent, available));

    return result;
  });
}
