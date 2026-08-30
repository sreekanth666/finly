/**
 * The four Insights views (D13), as aggregates.
 *
 * Every one of these is a grouped query rather than a fold over rows loaded into
 * JavaScript. The screen asks four questions about a month and gets four answers
 * back; it never sees an expense.
 */

import { and, desc, eq, isNull, sql } from 'drizzle-orm';

import { asMinor, type Minor } from '@/domain/money';
import { formatPeriodShort, type PeriodKey } from '@/domain/period';
import { CHART_TONES, toChartTone, type ChartTone } from '@/theme/chart';

import { db, type DbLike } from '../client';
import { categories, expenses, settlements } from '../schema';

/** Effective spend, settlements deducted — the same expression spentByPeriod uses. */
const EFFECTIVE = sql<number>`sum(max(0, ${expenses.amountMinor} - coalesce(settled.settled_total, 0)))`;

/**
 * Every figure on this screen means §4.3's `spent(P)`: effective, and counting
 * only what the budget counts.
 *
 * This has to be the same definition the trend chart uses, because they sit
 * beside each other. When the headline and the donut included off-budget
 * spending and the trend bar for the same month did not, one screen showed two
 * different answers to one question — and a ₹45,000 laptop is exactly the kind
 * of expense that makes the gap large enough to notice and impossible to
 * explain. Off-budget spending is shown as its own figure instead.
 */
const inPeriod = (period: PeriodKey) =>
  and(isNull(expenses.deletedAt), eq(expenses.countsToBudget, true), eq(expenses.budgetPeriod, period));

const settledTotals = (database: DbLike) =>
  database
    .select({
      expenseId: settlements.expenseId,
      total: sql<number>`sum(${settlements.amountMinor})`.as('settled_total'),
    })
    .from(settlements)
    .where(isNull(settlements.deletedAt))
    .groupBy(settlements.expenseId)
    .as('settled');

/* -------------------------------------------------------------------------- */
/* Spend by category                                                            */
/* -------------------------------------------------------------------------- */

export type CategorySpend = {
  id: string;
  label: string;
  amountMinor: Minor;
  tone: ChartTone;
};

/** tokens.css validates exactly five chart slots; the tail folds into "Other". */
const CHART_SLOTS = CHART_TONES.length;

/**
 * @param period the month to break down.
 *
 * Tones are pinned to the category rather than assigned by rank, so a category
 * keeps its colour when a quiet month reorders the chart. There are nine seeded
 * categories and five slots, so two visible slices can want the same one — the
 * lower-ranked of the pair deterministically moves to the first free slot rather
 * than the two being drawn identically.
 */
export function spendByCategory(period: PeriodKey, database: DbLike = db): CategorySpend[] {
  const settled = settledTotals(database);

  const rows = database
    .select({
      id: expenses.categoryId,
      name: categories.name,
      chartTone: categories.chartTone,
      amount: EFFECTIVE,
    })
    .from(expenses)
    .leftJoin(settled, eq(settled.expenseId, expenses.id))
    .leftJoin(categories, eq(categories.id, expenses.categoryId))
    .where(inPeriod(period))
    .groupBy(expenses.categoryId)
    .orderBy(desc(EFFECTIVE))
    .all();

  const named = rows.map((row) => ({
    id: row.id ?? 'uncategorised',
    label: row.name ?? 'Uncategorised',
    amountMinor: asMinor(row.amount ?? 0),
    preferredTone: toChartTone(row.chartTone ?? ''),
  }));

  const head = named.slice(0, CHART_SLOTS - 1);
  const tail = named.slice(CHART_SLOTS - 1);

  const visible = [...head];
  if (tail.length > 0) {
    visible.push({
      id: 'other',
      label: 'Other',
      amountMinor: asMinor(tail.reduce((total, row) => total + row.amountMinor, 0)),
      preferredTone: CHART_TONES[CHART_SLOTS - 1]!,
    });
  }

  const taken = new Set<ChartTone>();
  return visible.map((row) => {
    const tone = taken.has(row.preferredTone)
      ? (CHART_TONES.find((candidate) => !taken.has(candidate)) ?? row.preferredTone)
      : row.preferredTone;
    taken.add(tone);

    return { id: row.id, label: row.label, amountMinor: row.amountMinor, tone };
  });
}

/* -------------------------------------------------------------------------- */
/* Month-over-month trend                                                       */
/* -------------------------------------------------------------------------- */

export type TrendMonth = {
  period: PeriodKey;
  label: string;
  spentMinor: Minor;
};

/**
 * @param periods the months to chart, oldest first — dense, so an empty month
 * shows as an empty bar rather than being silently skipped and making the chart
 * lie about the shape of the year.
 */
export function spendTrend(
  periods: readonly PeriodKey[],
  spentByPeriod: ReadonlyMap<PeriodKey, Minor>,
): TrendMonth[] {
  return periods.map((period) => ({
    period,
    label: formatPeriodShort(period),
    spentMinor: spentByPeriod.get(period) ?? asMinor(0),
  }));
}

/* -------------------------------------------------------------------------- */
/* Top items                                                                    */
/* -------------------------------------------------------------------------- */

export type TopItem = {
  id: string;
  item: string;
  count: number;
  amountMinor: Minor;
  categoryLabel: string;
  categoryIcon: string;
  categoryTone: string;
};

/**
 * The descriptions a month spent the most on, by total rather than by frequency
 * — eleven ₹380 Swiggy orders matter more than one ₹500 chemist run, and the
 * count is shown beside the total so both readings are available.
 *
 * The same description can be filed under different categories on different
 * days, so the category shown is the one the most recent of them used. The
 * subquery runs per group; at a few hundred distinct descriptions that is a few
 * hundred indexed lookups, which is cheap and bounded by the month.
 */
export function topItems(period: PeriodKey, limit: number, database: DbLike = db): TopItem[] {
  const settled = settledTotals(database);

  const rows = database
    .select({
      item: expenses.item,
      count: sql<number>`count(*)`,
      amount: EFFECTIVE,
      categoryName: sql<string | null>`(
        select c.name from expenses e2
        left join categories c on c.id = e2.category_id
        where e2.item = ${expenses.item} and e2.deleted_at is null
        order by e2.occurred_at desc limit 1
      )`,
      categoryIcon: sql<string | null>`(
        select c.icon from expenses e2
        left join categories c on c.id = e2.category_id
        where e2.item = ${expenses.item} and e2.deleted_at is null
        order by e2.occurred_at desc limit 1
      )`,
      categoryToken: sql<string | null>`(
        select c.color_token from expenses e2
        left join categories c on c.id = e2.category_id
        where e2.item = ${expenses.item} and e2.deleted_at is null
        order by e2.occurred_at desc limit 1
      )`,
    })
    .from(expenses)
    .leftJoin(settled, eq(settled.expenseId, expenses.id))
    .where(inPeriod(period))
    .groupBy(expenses.item)
    .orderBy(desc(EFFECTIVE))
    .limit(limit)
    .all();

  return rows.map((row) => ({
    id: row.item,
    item: row.item,
    count: row.count,
    amountMinor: asMinor(row.amount ?? 0),
    categoryLabel: row.categoryName ?? 'Uncategorised',
    categoryIcon: row.categoryIcon ?? 'Ellipsis',
    categoryTone: row.categoryToken ?? 'muted',
  }));
}

/** What a month spent in total, effective. */
export function totalSpend(period: PeriodKey, database: DbLike = db): Minor {
  const settled = settledTotals(database);

  const row = database
    .select({ amount: EFFECTIVE })
    .from(expenses)
    .leftJoin(settled, eq(settled.expenseId, expenses.id))
    .where(inPeriod(period))
    .get();

  return asMinor(row?.amount ?? 0);
}
