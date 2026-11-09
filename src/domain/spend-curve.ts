/**
 * How this month is going, day by day, against last month.
 *
 * Money here is the budget's: an entry's `effectiveMinor` is what is still out
 * of pocket after settlements, the same figure the ring and the carry-over walk
 * use, so the end of the curve always agrees with the number above it.
 *
 * Days are bucketed in local time with `getDate()`, the way `feed.ts` groups the
 * transaction list, and for the same reason: the grouping is done in JavaScript
 * because SQLite's 'localtime' is not guaranteed to be the zone JavaScript sees.
 */

import { addMinor, ZERO_MINOR, type Minor } from './money';
import { comparePeriods, currentPeriod, daysInMonth, parsePeriod, periodBounds } from './period';
import type { PeriodKey } from './period';

export type SpendEntry = { occurredAt: number; effectiveMinor: Minor };

/**
 * Running total of spend at the end of each day of `period`, index 0 being the
 * 1st. Always `daysInMonth` long, so two months line up on the same x axis.
 *
 * A day that has not happened yet is `null` rather than a repeat of today's
 * total: a flat run to the end of the month would read as "spent nothing since".
 * A past month is filled to its last day; a future one is all `null`.
 *
 * Entries outside the month are ignored.
 */
export function cumulativeDailySpend(
  entries: readonly SpendEntry[],
  period: PeriodKey,
  now: number = Date.now(),
): (Minor | null)[] {
  const { year, month } = parsePeriod(period);
  const length = daysInMonth(year, month);
  const { startMs, endMs } = periodBounds(period);

  const perDay: Minor[] = new Array<Minor>(length).fill(ZERO_MINOR);
  for (const { occurredAt, effectiveMinor } of entries) {
    if (occurredAt < startMs || occurredAt >= endMs) continue;
    const index = new Date(occurredAt).getDate() - 1;
    perDay[index] = addMinor(perDay[index]!, effectiveMinor);
  }

  const order = comparePeriods(period, currentPeriod(now));
  const lastDay = order < 0 ? length : order === 0 ? new Date(now).getDate() : 0;

  const curve: (Minor | null)[] = [];
  let running = ZERO_MINOR;
  for (let day = 0; day < length; day++) {
    running = addMinor(running, perDay[day]!);
    curve.push(day < lastDay ? running : null);
  }
  return curve;
}

/** Within this many percent of last month's figure is "about the same". */
export const SAME_TOLERANCE_PERCENT = 2;

export type DayComparison = {
  /**
   * How far apart the two months are on this day, as a whole percent of last
   * month's figure — a magnitude, with `direction` carrying the sign. Null when
   * there is nothing honest to divide by.
   */
  deltaPercent: number | null;
  direction: 'less' | 'more' | 'same';
};

const NO_COMPARISON: DayComparison = { deltaPercent: null, direction: 'same' };

/**
 * This month's total so far against last month's on the same day.
 *
 * "Same day" is by day of month, clamped to the last day of a shorter previous
 * month, so the 31st compares with the 30th rather than with nothing.
 *
 * @param previous null or empty when there is no previous month to compare with.
 */
export function compareToSameDay(
  current: readonly (Minor | null)[],
  previous: readonly (Minor | null)[] | null,
  dayIndex: number,
): DayComparison {
  if (previous === null || previous.length === 0) return NO_COMPARISON;

  const now = current[dayIndex];
  const before = previous[Math.min(dayIndex, previous.length - 1)];
  if (now === null || now === undefined || before === null || before === undefined) {
    return NO_COMPARISON;
  }
  // Nothing spent by then last month: any percentage would be infinite.
  if (before <= 0) return NO_COMPARISON;

  const deltaPercent = Math.round((Math.abs(now - before) * 100) / before);
  if (deltaPercent <= SAME_TOLERANCE_PERCENT) return { deltaPercent, direction: 'same' };
  return { deltaPercent, direction: now < before ? 'less' : 'more' };
}
