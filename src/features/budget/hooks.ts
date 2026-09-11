/**
 * Budget standing, carry-over history, and the "a past month changed" notice.
 */

import { dismissCarryOverNotice, getCarryOverNotice, type CarryOverNotice } from '@/db/carry-over';
import { useDbQuery, type TableName } from '@/db/live';
import { buildBudgetHistory, defaultMonthlyBudget } from '@/db/repositories/budgets';
import type { PeriodResult } from '@/domain/budget';
import type { Minor } from '@/domain/money';

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

export function useCarryOverNotice() {
  return useDbQuery<CarryOverNotice>('carry-notice', ['settings'], (database) =>
    getCarryOverNotice(database),
  );
}

export { dismissCarryOverNotice };
