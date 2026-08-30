/**
 * The Insights tab, for one month.
 */

import { useDbQuery, type TableName } from '@/db/live';
import { defaultMonthlyBudget, getBudget } from '@/db/repositories/budgets';
import { earliestActivityPeriod, spentByPeriod } from '@/db/repositories/expenses';
import {
  spendByCategory,
  spendTrend,
  topItems,
  totalSpend,
  type CategorySpend,
  type TopItem,
  type TrendMonth,
} from '@/db/repositories/insights';
import type { Minor } from '@/domain/money';
import { addPeriods, comparePeriods, periodsBetween, type PeriodKey } from '@/domain/period';

const INSIGHT_TABLES: readonly TableName[] = [
  'expenses',
  'settlements',
  'categories',
  'budgets',
  'settings',
];

/** How many months the trend chart looks back over, including the one shown. */
const TREND_MONTHS = 6;
const TOP_ITEM_COUNT = 5;

export type InsightsView = {
  period: PeriodKey;
  totalSpentMinor: Minor;
  /** The budget the trend chart draws its reference line at. */
  budgetMinor: Minor;
  byCategory: CategorySpend[];
  trend: TrendMonth[];
  topItems: TopItem[];
  /** The oldest month with anything in it, so the switcher knows where to stop. */
  earliestPeriod: PeriodKey | null;
};

export function useInsights(period: PeriodKey) {
  return useDbQuery<InsightsView>(`insights:${period}`, INSIGHT_TABLES, (database) => {
    const from = addPeriods(period, -(TREND_MONTHS - 1));
    const months = periodsBetween(from, period);
    const spent = spentByPeriod(from, period, database);

    return {
      period,
      totalSpentMinor: totalSpend(period, database),
      budgetMinor: getBudget(period, database)?.amountMinor ?? defaultMonthlyBudget(database),
      byCategory: spendByCategory(period, database),
      trend: spendTrend(months, spent),
      topItems: topItems(period, TOP_ITEM_COUNT, database),
      earliestPeriod: earliestActivityPeriod(database),
    };
  });
}

/** Whether there is any month older than this one to switch back to. */
export const hasEarlier = (view: InsightsView | undefined): boolean =>
  view?.earliestPeriod != null && comparePeriods(view.earliestPeriod, view.period) < 0;
