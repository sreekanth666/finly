/**
 * Budget standing, carry-over history, and the "a past month changed" notice.
 */

import { dismissCarryOverNotice, getCarryOverNotice, type CarryOverNotice } from '@/db/carry-over';
import { useDbQuery, type TableName } from '@/db/live';
import {
  buildBudgetHistory,
  defaultMonthlyBudget,
  getBudget,
} from '@/db/repositories/budgets';
import type { PeriodResult } from '@/domain/budget';
import type { Minor } from '@/domain/money';
import type { PeriodKey } from '@/domain/period';

/* The history is derived from expenses and settlements, not from the snapshot,
   so those two tables are what invalidate it — along with budgets and settings,
   which hold the amounts. */
const BUDGET_TABLES: readonly TableName[] = ['expenses', 'settlements', 'budgets', 'settings'];

export function useBudgetHistory() {
  return useDbQuery<PeriodResult[]>('budget-history', BUDGET_TABLES, (database) =>
    buildBudgetHistory(database),
  );
}

export function useDefaultMonthlyBudget() {
  return useDbQuery<Minor>('monthly-budget', ['settings'], (database) =>
    defaultMonthlyBudget(database),
  );
}

/** The amount set for one month, or null when it just follows the default. */
export function useBudgetOverride(period: PeriodKey) {
  return useDbQuery<Minor | null>(`budget-override:${period}`, ['budgets'], (database) => {
    const row = getBudget(period, database);
    return row?.amountMinor ?? null;
  });
}

export function useCarryOverNotice() {
  return useDbQuery<CarryOverNotice>('carry-notice', ['settings'], (database) =>
    getCarryOverNotice(database),
  );
}

export { dismissCarryOverNotice };
