/**
 * Dates, months and billing days.
 *
 * Timestamps are stored as UTC epoch milliseconds. Everything a human sees — the
 * month an expense belongs to, the day it groups under, the statement date of a
 * card — is derived in the **device's local timezone** (§4.2). That split is the
 * whole reason this module exists in one piece rather than scattered across the
 * screens that need it.
 *
 * `toISOString()` is banned here, and the ban is the point. `toISOString()
 * .slice(0, 7)` looks exactly like a period key and is wrong: in IST, 1 March
 * 00:30 local is 28 February 19:00 UTC, so it yields '2026-02' and the expense
 * lands in the wrong month. Local derivation goes through `getFullYear()`,
 * `getMonth()` and `getDate()`, which read the local calendar by definition.
 *
 * Month and weekday names come from a fixed array rather than `Intl`. Hermes'
 * Intl surface varies by platform and build, and the code this replaced already
 * leaked a hardcoded 'en-US' in four places. A fixed array is deterministic,
 * testable, and honest about the fact that the app is English-only today.
 */

/** A calendar month in local time, keyed 'YYYY-MM'. */
export type PeriodKey = string;

const MONTHS_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

const MS_PER_DAY = 86_400_000;

const pad2 = (value: number): string => String(value).padStart(2, '0');

const PERIOD_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export const isPeriodKey = (value: string): boolean => PERIOD_PATTERN.test(value);

/** @param month1 the month as humans write it: 1 is January. */
export const periodKey = (year: number, month1: number): PeriodKey =>
  `${String(year).padStart(4, '0')}-${pad2(month1)}`;

export function parsePeriod(period: PeriodKey): { year: number; month: number } {
  if (!isPeriodKey(period)) {
    throw new RangeError(`Not a period key: ${JSON.stringify(period)}`);
  }
  return { year: Number(period.slice(0, 4)), month: Number(period.slice(5, 7)) };
}

/** The period an instant falls in, read off the local calendar. */
export function periodOf(occurredAt: number): PeriodKey {
  const date = new Date(occurredAt);
  return periodKey(date.getFullYear(), date.getMonth() + 1);
}

export const currentPeriod = (now: number = Date.now()): PeriodKey => periodOf(now);

/**
 * Half-open: `[startMs, endMs)`. Half-open rather than inclusive so a query for
 * a month can never double-count the midnight that separates two of them.
 */
export function periodBounds(period: PeriodKey): { startMs: number; endMs: number } {
  const { year, month } = parsePeriod(period);
  return {
    startMs: new Date(year, month - 1, 1).getTime(),
    endMs: new Date(year, month, 1).getTime(),
  };
}

export function addPeriods(period: PeriodKey, delta: number): PeriodKey {
  const { year, month } = parsePeriod(period);
  // Date normalises an out-of-range month into the neighbouring year, which is
  // exactly the arithmetic wanted here and avoids a manual modulo.
  const shifted = new Date(year, month - 1 + delta, 1);
  return periodKey(shifted.getFullYear(), shifted.getMonth() + 1);
}

export const previousPeriod = (period: PeriodKey): PeriodKey => addPeriods(period, -1);
export const nextPeriod = (period: PeriodKey): PeriodKey => addPeriods(period, 1);

/** Zero-padded keys sort lexicographically, so this is also the SQL ordering. */
export const comparePeriods = (a: PeriodKey, b: PeriodKey): number =>
  a < b ? -1 : a > b ? 1 : 0;

/**
 * Every period from `from` to `to`, inclusive, oldest first — including months
 * with no activity at all.
 *
 * The density matters: carry-over compounds by walking month to month, so a list
 * that skips an empty January silently carries December's overspend into
 * February as if January never happened.
 */
export function periodsBetween(from: PeriodKey, to: PeriodKey): PeriodKey[] {
  if (comparePeriods(from, to) > 0) return [];

  const periods: PeriodKey[] = [];
  let cursor = from;
  while (comparePeriods(cursor, to) <= 0) {
    periods.push(cursor);
    cursor = nextPeriod(cursor);
  }
  return periods;
}

export function formatPeriodLong(period: PeriodKey): string {
  const { year, month } = parsePeriod(period);
  return `${MONTHS_LONG[month - 1]} ${year}`;
}

export function formatPeriodShort(period: PeriodKey): string {
  const { month } = parsePeriod(period);
  return MONTHS_SHORT[month - 1]!;
}

/**
 * Whether a newly-dirtied period should replace the one already recorded.
 *
 * Pure, and separated out because getting it wrong is invisible: an over-eager
 * guard silently retires the recompute rather than producing a wrong number.
 * A blank or absent marker means nothing is recorded yet, and a blank string is
 * treated as absent deliberately — an earlier version cleared the marker by
 * writing '', which reads back as a value and made every later mark a no-op.
 *
 * @param existing what is stored, or null when nothing is.
 */
export const shouldReplaceDirtyPeriod = (
  existing: string | null,
  period: PeriodKey,
): boolean =>
  existing === null || existing === '' || comparePeriods(period, existing) < 0;

/* -------------------------------------------------------------------------- */
/* Days                                                                         */
/* -------------------------------------------------------------------------- */

export const startOfLocalDay = (ms: number): number => {
  const date = new Date(ms);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
};

/** 'YYYY-MM-DD' in local time — the key the transaction feed groups on. */
export function dayKey(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/**
 * Whole days between two instants, counted in local calendar days rather than
 * by dividing milliseconds — so a day that is 23 or 25 hours long across a DST
 * boundary still counts as one.
 */
export const daysBetween = (fromMs: number, toMs: number): number =>
  Math.round((startOfLocalDay(toMs) - startOfLocalDay(fromMs)) / MS_PER_DAY);

/** 'Today' | 'Yesterday' | 'Sun, 24 Aug' | 'Sun, 24 Aug 2025' */
export function formatDayLabel(ms: number, now: number = Date.now()): string {
  const distance = daysBetween(ms, now);
  if (distance === 0) return 'Today';
  if (distance === 1) return 'Yesterday';

  const date = new Date(ms);
  const base = `${WEEKDAYS_SHORT[date.getDay()]}, ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
  // The year is only worth the space once it stops being the obvious one.
  return date.getFullYear() === new Date(now).getFullYear() ? base : `${base} ${date.getFullYear()}`;
}

/** 'Mon, 25 Aug 2026' — the unabbreviated form, for a detail screen. */
export function formatDateLong(ms: number): string {
  const date = new Date(ms);
  return `${WEEKDAYS_SHORT[date.getDay()]}, ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]} ${date.getFullYear()}`;
}

/** '11:23', 24-hour, as the transaction rows show it. */
export function formatTime(ms: number): string {
  const date = new Date(ms);
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * Days left in a period, counting today as one of them.
 *
 * A month that has already ended has none left, and a month still in the future
 * has all of them — so "what can I spend today" divides by a number that is
 * always at least 1 for the month being lived in.
 */
export function daysRemainingIn(period: PeriodKey, now: number = Date.now()): number {
  const { year, month } = parsePeriod(period);
  const today = new Date(now);
  const total = daysInMonth(year, month);

  if (periodOf(now) !== period) {
    return comparePeriods(period, periodOf(now)) > 0 ? total : 0;
  }

  return total - today.getDate() + 1;
}

/* -------------------------------------------------------------------------- */
/* Statement days (§4.5)                                                        */
/* -------------------------------------------------------------------------- */

/** @param month1 1 is January. */
export const daysInMonth = (year: number, month1: number): number =>
  // Day 0 of the following month is the last day of this one.
  new Date(year, month1, 0).getDate();

/**
 * A statement day of 31 has to mean something in February. It means the 28th,
 * or the 29th in a leap year — the last day the month actually has.
 *
 * Every cycle calculation goes through this one helper, so the rule cannot drift
 * between the start of a window and its end.
 */
export const clampDayToMonth = (year: number, month1: number, day: number): number =>
  Math.min(day, daysInMonth(year, month1));

/** Local midnight on the statement day of a given month, short months clamped. */
export const statementDateIn = (year: number, month1: number, statementDay: number): number =>
  new Date(year, month1 - 1, clampDayToMonth(year, month1, statementDay)).getTime();
