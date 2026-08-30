/**
 * Credit-card billing cycles and utilisation — §4.5.
 *
 * Budget and billing are separate concerns and never mix. A card expense counts
 * toward the budget in the calendar month it happened (D10); utilisation is a
 * different calculation over a different window, and `counts_to_budget` has no
 * bearing on it at all. A ₹45,000 laptop excluded from the budget is absolutely
 * still on the card.
 *
 * Every window boundary goes through `clampDayToMonth`, so a statement day of 31
 * resolves to the 28th, 29th or 30th in months that lack it — and, crucially,
 * resolves the same way at both ends of the window.
 */

import { ratio, type Minor } from './money';
import {
  daysBetween,
  parsePeriod,
  periodOf,
  startOfLocalDay,
  statementDateIn,
  addPeriods,
} from './period';

export type CycleWindow = {
  /** The most recent statement day on or before today, at local midnight. */
  startMs: number;
  /** The next statement day, exclusive. */
  endMs: number;
  /** The next statement date — the same instant as `endMs`, named for reading. */
  statementMs: number;
  /** Whole days from today until that statement. */
  daysToStatement: number;
};

/**
 * @param statementDay 1–31, clamped per month.
 *
 * Note the boundary: "the most recent occurrence **on or before** today" means
 * that on the statement day itself the cycle restarts that morning, so a card
 * correctly shows near-zero cycle spend on its statement day. That looks like a
 * bug in testing and is not one.
 *
 * The window is half-open — `[startMs, endMs)` — rather than §4.5's inclusive
 * "next occurrence minus one day". They describe the same set of days, and a
 * half-open range cannot double-count the midnight between two cycles.
 */
export function cycleWindow(statementDay: number, now: number = Date.now()): CycleWindow {
  const today = startOfLocalDay(now);
  const period = periodOf(now);
  const { year, month } = parsePeriod(period);

  const thisMonth = statementDateIn(year, month, statementDay);

  const previous = parsePeriod(addPeriods(period, -1));
  const next = parsePeriod(addPeriods(period, 1));

  const startMs =
    thisMonth <= today ? thisMonth : statementDateIn(previous.year, previous.month, statementDay);
  const endMs =
    thisMonth <= today ? statementDateIn(next.year, next.month, statementDay) : thisMonth;

  return {
    startMs,
    endMs,
    statementMs: endMs,
    daysToStatement: daysBetween(today, endMs),
  };
}

export type UtilisationBand = 'healthy' | 'high' | 'critical';

/**
 * The thresholds lived as magic numbers inside the card list component, where
 * they could not be tested and could drift from any other place that judged a
 * card. They live here now.
 */
export function utilisationBand(value: number): UtilisationBand {
  if (value >= 0.85) return 'critical';
  if (value >= 0.6) return 'high';
  return 'healthy';
}

/** Cycle spend over the limit. Zero when there is no limit to divide by. */
export const utilisation = (cycleSpendMinor: Minor, creditLimitMinor: Minor): number =>
  ratio(cycleSpendMinor, creditLimitMinor);
