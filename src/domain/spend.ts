/**
 * What a month cost in full: the spending the budget counts, plus the spending
 * deliberately kept outside it (D3).
 *
 * The two are stored and queried apart, because the ring and every Insights
 * chart mean the first one only. This is the one place they are added back
 * together, so "total" has a single definition wherever it is shown.
 */

import { addMinor, ratio, type Minor } from './money';

/** Which side of the D3 flag a list is narrowed to. Absent means both. */
export type BudgetScope = 'budget' | 'off-budget';

export const isBudgetScope = (value: string | undefined): value is BudgetScope =>
  value === 'budget' || value === 'off-budget';

export type SpendSplit = {
  totalMinor: Minor;
  /** The budget side's share of the total, 0–1. Zero for a month with no spend. */
  budgetShare: number;
};

export function splitSpend(budgetMinor: Minor, offBudgetMinor: Minor): SpendSplit {
  const totalMinor = addMinor(budgetMinor, offBudgetMinor);
  return { totalMinor, budgetShare: ratio(budgetMinor, totalMinor) };
}
