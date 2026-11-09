/**
 * Budget standing, carry-over history, and the "a past month changed" notice.
 */

import { dismissCarryOverNotice, getCarryOverNotice, type CarryOverNotice } from '@/db/carry-over';
import { useDbQuery, type TableName } from '@/db/live';
import { buildBudgetHistory, defaultMonthlyBudget } from '@/db/repositories/budgets';
import { budgetSpendEntries, offBudgetSpend } from '@/db/repositories/expenses';
import type { PeriodResult } from '@/domain/budget';
import type { Minor } from '@/domain/money';
import {
  currentPeriod,
  daysInMonth,
  parsePeriod,
  previousPeriod,
  type PeriodKey,
} from '@/domain/period';
import {
  compareToSameDay,
  cumulativeDailySpend,
  type DayComparison,
} from '@/domain/spend-curve';

/* The history is derived from expenses and settlements, not from the snapshot,
   so those two tables are what invalidate it — along with budgets and settings,
   which hold the amounts. */
const BUDGET_TABLES: readonly TableName[] = ['expenses', 'settlements', 'budgets', 'settings'];

export function useBudgetHistory() {
  return useDbQuery<PeriodResult[]>('budget-history', BUDGET_TABLES, (database) =>
    buildBudgetHistory(database),
  );
}

/* Kept apart from the history above rather than folded into it: the history is
   what the ring and the carry-over walk mean by "spent", and this is the part
   they deliberately leave out (D3). */
const OFF_BUDGET_TABLES: readonly TableName[] = ['expenses', 'settlements'];

export function useOffBudgetSpend(period: PeriodKey) {
  return useDbQuery<Minor>(`off-budget:${period}`, OFF_BUDGET_TABLES, (database) =>
    offBudgetSpend(period, database),
  );
}

export type SpendCurve = {
  /** Running total at the end of each day; `null` for days not yet lived. */
  current: (Minor | null)[];
  /** The month before, same shape. All zeros when it had no spending. */
  previous: (Minor | null)[];
  /** Index of "today" in `current`; the last day for a month that is over. */
  dayIndex: number;
  daysInMonth: number;
  /** This month so far against last month on the same day. */
  comparison: DayComparison;
};

/* Both tables, for the same reason as the off-budget total: the curve nets
   settlements, so a settlement written alone has to move it. */
const SPEND_CURVE_TABLES: readonly TableName[] = ['expenses', 'settlements'];

/**
 * The home chart's data: this month's and last month's cumulative spend by day.
 *
 * @param now the clock, for tests. Left to default inside the read rather than
 *            in the signature: a default of `Date.now()` is an impure call during
 *            render. The cost is that a screen left open across midnight keeps
 *            yesterday's "today" until the next write or month change.
 */
export function useSpendCurve(period: PeriodKey, now?: number) {
  return useDbQuery<SpendCurve>(`spend-curve:${period}`, SPEND_CURVE_TABLES, (database) => {
    const at = now ?? Date.now();
    const previousKey = previousPeriod(period);
    const rows = budgetSpendEntries([previousKey, period], database);

    const current = cumulativeDailySpend(
      rows.filter((row) => row.budgetPeriod === period),
      period,
      at,
    );
    const previous = cumulativeDailySpend(
      rows.filter((row) => row.budgetPeriod === previousKey),
      previousKey,
      at,
    );

    const { year, month } = parsePeriod(period);
    const length = daysInMonth(year, month);
    const today = currentPeriod(at);
    const dayIndex =
      period === today
        ? new Date(at).getDate() - 1
        : period < today
          ? length - 1
          : 0;

    return {
      current,
      previous,
      dayIndex,
      daysInMonth: length,
      comparison: compareToSameDay(current, previous, dayIndex),
    };
  });
}

export function useDefaultMonthlyBudget() {
  return useDbQuery<Minor>('monthly-budget', ['settings'], (database) =>
    defaultMonthlyBudget(database),
  );
}

export function useCarryOverNotice() {
  return useDbQuery<CarryOverNotice>('carry-notice', ['settings'], (database) =>
    getCarryOverNotice(database),
  );
}

export { dismissCarryOverNotice };
