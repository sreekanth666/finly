/**
 * Budget standing, carry-over history, and the "a past month changed" notice.
 */

import { dismissCarryOverNotice, getCarryOverNotice, type CarryOverNotice } from '@/db/carry-over';
import { useDbQuery, type TableName } from '@/db/live';
import { buildBudgetHistory, defaultMonthlyBudget } from '@/db/repositories/budgets';
import { offBudgetSpend } from '@/db/repositories/expenses';
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

/* Kept apart from the history above rather than folded into it: the history is
   what the ring and the carry-over walk mean by "spent", and this is the part
   they deliberately leave out (D3). */
const OFF_BUDGET_TABLES: readonly TableName[] = ['expenses', 'settlements'];

export function useOffBudgetSpend(period: PeriodKey) {
  return useDbQuery<Minor>(`off-budget:${period}`, OFF_BUDGET_TABLES, (database) =>
    offBudgetSpend(period, database),
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
