/**
 * Budgets, and the carry-over history the home screen is built on.
 *
 * §4.4 describes `budgets.carry_over_minor` as a cache reads depend on. Reads
 * here derive instead: `spentByPeriod` is one indexed aggregate returning a row
 * per month, and `buildCarryOverHistory` folds it in a single pass. At any
 * plausible number of months that is faster than the invalidation logic would
 * be to get right, and it cannot go stale.
 *
 * The stored column is a snapshot of what the user last saw. See carry-over.ts.
 */

import { asc, eq } from 'drizzle-orm';

import { buildCarryOverHistory, type Period, type PeriodResult } from '@/domain/budget';
import { asMinor, type Minor } from '@/domain/money';
import { currentPeriod, periodsBetween, type PeriodKey } from '@/domain/period';

import { db, type DbLike } from '../client';
import { ValidationError } from '../errors';
import { newId } from '../id';
import { budgets, type BudgetRow } from '../schema';
import { earliestActivityPeriod, spentByPeriod } from './expenses';
import { getMinorSetting, setMinorSetting } from './settings';

/** ₹5,000 unless the user has said otherwise (§5). */
export const FALLBACK_MONTHLY_BUDGET = asMinor(500000);

export const defaultMonthlyBudget = (database: DbLike = db): Minor =>
  getMinorSetting('monthly_budget_minor', FALLBACK_MONTHLY_BUDGET, database);

export function setDefaultMonthlyBudget(amountMinor: Minor, database: DbLike = db): void {
  if (amountMinor <= 0) {
    throw new ValidationError('amount', 'A monthly budget needs to be more than zero.');
  }
  setMinorSetting('monthly_budget_minor', amountMinor, database);
}

export const getBudget = (period: PeriodKey, database: DbLike = db): BudgetRow | null =>
  database.select().from(budgets).where(eq(budgets.period, period)).get() ?? null;

export const listBudgets = (database: DbLike = db): BudgetRow[] =>
  database.select().from(budgets).orderBy(asc(budgets.period)).all();

/** Created lazily on first use of that period, per §5. */
export function getOrCreateBudget(period: PeriodKey, database: DbLike = db): BudgetRow {
  const existing = getBudget(period, database);
  if (existing !== null) return existing;

  const now = Date.now();
  const row: BudgetRow = {
    id: newId(),
    period,
    amountMinor: defaultMonthlyBudget(database),
    carryOverMinor: asMinor(0),
    carryRecomputedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  database.insert(budgets).values(row).run();
  return row;
}

/** Overrides the default for one month only. */
export function setBudgetAmount(
  period: PeriodKey,
  amountMinor: Minor,
  database: DbLike = db,
): void {
  if (amountMinor <= 0) {
    throw new ValidationError('amount', 'A budget needs to be more than zero.');
  }

  getOrCreateBudget(period, database);
  database
    .update(budgets)
    .set({ amountMinor, updatedAt: Date.now() })
    .where(eq(budgets.period, period))
    .run();
}

/**
 * Every month from the first with any activity to the current one, folded.
 *
 * The list handed to the fold is **dense** — including months with no expenses
 * at all. Skipping an empty January would carry December's overspend into
 * February as though January had never happened, which is both wrong and
 * invisible.
 */
export function buildBudgetHistory(database: DbLike = db): PeriodResult[] {
  const now = currentPeriod();
  const fallback = defaultMonthlyBudget(database);

  const budgetRows = listBudgets(database);
  const earliestBudget = budgetRows[0]?.period ?? null;
  const earliestActivity = earliestActivityPeriod(database);

  const candidates = [earliestBudget, earliestActivity].filter(
    (value): value is PeriodKey => value !== null,
  );
  const earliest = candidates.length === 0 ? now : candidates.sort()[0]!;

  const spent = spentByPeriod(earliest, now, database);
  const amounts = new Map(budgetRows.map((row) => [row.period, row.amountMinor]));

  const periods: Period[] = periodsBetween(earliest, now).map((period) => ({
    period,
    budget: amounts.get(period) ?? fallback,
    spent: spent.get(period) ?? asMinor(0),
  }));

  return buildCarryOverHistory(periods);
}

/** The current month's row of that history — what the home screen leads with. */
export function currentBudgetStanding(database: DbLike = db): PeriodResult {
  const history = buildBudgetHistory(database);
  const now = currentPeriod();
  return (
    history.find((result) => result.period === now) ?? {
      period: now,
      budget: defaultMonthlyBudget(database),
      spent: asMinor(0),
      carryOver: asMinor(0),
      available: defaultMonthlyBudget(database),
      remaining: defaultMonthlyBudget(database),
      isOverspent: false,
    }
  );
}
