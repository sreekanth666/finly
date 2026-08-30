/**
 * Expenses — the table the whole app is about.
 *
 * Three things here are load-bearing:
 *
 * - `budget_period` is derived from `occurred_at` at write time (§4.2). Editing
 *   the date rewrites it, and marks **both** the old month and the new one as
 *   needing their carry-over snapshot recomputed.
 * - Soft delete, everywhere. Every read filters `deleted_at IS NULL` through one
 *   shared predicate so it cannot be forgotten in a single query.
 * - The settled total arrives from a grouped subquery joined once, never by
 *   loading an expense's child rows per row of a list.
 */

import { and, asc, count, desc, eq, gte, inArray, isNull, like, lt, or, sql } from 'drizzle-orm';

import { asMinor, getActiveCurrency, type Minor } from '@/domain/money';
import { periodOf, type PeriodKey } from '@/domain/period';
import { summariseSettlements } from '@/domain/settlement';

import { markCarryDirty, markCarryDirtyForMove } from '../carry-over';
import { db, type DbLike } from '../client';
import { NotFoundError, SettlementExceedsExpenseError, ValidationError } from '../errors';
import { newId } from '../id';
import { accounts, categories, expenses, settlements, type ExpenseRow } from '../schema';
import { writeTransaction } from '../transaction';

const alive = isNull(expenses.deletedAt);

export type ExpenseInput = {
  occurredAt: number;
  amountMinor: Minor;
  item: string;
  note?: string | null;
  categoryId?: string | null;
  accountId?: string | null;
  countsToBudget: boolean;
};

export type ExpenseCategory = {
  id: string;
  name: string;
  icon: string;
  colorToken: string;
  chartTone: string;
};

export type ExpenseAccount = { id: string; name: string; colorToken: string };

export type ExpenseListItem = {
  id: string;
  occurredAt: number;
  budgetPeriod: PeriodKey;
  item: string;
  note: string | null;
  amountMinor: Minor;
  settledMinor: Minor;
  effectiveMinor: Minor;
  countsToBudget: boolean;
  category: ExpenseCategory | null;
  account: ExpenseAccount | null;
};

export type ExpenseFilter = {
  period?: PeriodKey;
  categoryIds?: readonly string[];
  accountIds?: readonly string[];
  /** Matched against item and note, case-insensitively. */
  search?: string;
  /** Only expenses that count toward the budget (D3). */
  budgetOnly?: boolean;
};

/* -------------------------------------------------------------------------- */
/* Reads                                                                        */
/* -------------------------------------------------------------------------- */

/** Settled totals per expense, as one grouped subquery to join against. */
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

function buildWhere(filter: ExpenseFilter) {
  const clauses = [alive];

  if (filter.period !== undefined) {
    clauses.push(eq(expenses.budgetPeriod, filter.period));
  }
  if (filter.categoryIds !== undefined && filter.categoryIds.length > 0) {
    clauses.push(inArray(expenses.categoryId, [...filter.categoryIds]));
  }
  if (filter.accountIds !== undefined && filter.accountIds.length > 0) {
    clauses.push(inArray(expenses.accountId, [...filter.accountIds]));
  }
  if (filter.budgetOnly === true) {
    clauses.push(eq(expenses.countsToBudget, true));
  }

  const search = filter.search?.trim();
  if (search !== undefined && search.length > 0) {
    /*
     * LIKE will scan; at a few thousand rows that is about a millisecond, and
     * FTS5 is the answer if that ever stops being true.
     *
     * SQLite has no default escape character, so escaping the wildcards is only
     * half the job — without the ESCAPE clause a search for a literal '%' looks
     * for a backslash followed by '%' and finds nothing.
     */
    const pattern = `%${search.replace(/[%_\\]/g, (char) => `\\${char}`)}%`;
    clauses.push(
      or(
        sql`${expenses.item} like ${pattern} escape '\\'`,
        sql`${expenses.note} like ${pattern} escape '\\'`,
      )!,
    );
  }

  return and(...clauses);
}

const toListItem = (row: {
  expense: ExpenseRow;
  settled: number | null;
  category: ExpenseCategory | null;
  account: ExpenseAccount | null;
}): ExpenseListItem => {
  const settledMinor = asMinor(row.settled ?? 0);
  const { effectiveMinor } = summariseSettlements(row.expense.amountMinor, settledMinor);

  return {
    id: row.expense.id,
    occurredAt: row.expense.occurredAt,
    budgetPeriod: row.expense.budgetPeriod,
    item: row.expense.item,
    note: row.expense.note,
    amountMinor: row.expense.amountMinor,
    settledMinor,
    effectiveMinor,
    countsToBudget: row.expense.countsToBudget,
    category: row.category?.id == null ? null : row.category,
    account: row.account?.id == null ? null : row.account,
  };
};

const selection = (settled: ReturnType<typeof settledTotals>) => ({
  expense: expenses,
  settled: settled.total,
  category: {
    id: categories.id,
    name: categories.name,
    icon: categories.icon,
    colorToken: categories.colorToken,
    chartTone: categories.chartTone,
  },
  account: {
    id: accounts.id,
    name: accounts.name,
    colorToken: accounts.colorToken,
  },
});

export function listExpensePage(
  filter: ExpenseFilter,
  page: { limit: number; offset: number },
  database: DbLike = db,
): ExpenseListItem[] {
  const settled = settledTotals(database);

  return database
    .select(selection(settled))
    .from(expenses)
    .leftJoin(settled, eq(settled.expenseId, expenses.id))
    .leftJoin(categories, eq(categories.id, expenses.categoryId))
    .leftJoin(accounts, eq(accounts.id, expenses.accountId))
    .where(buildWhere(filter))
    .orderBy(desc(expenses.occurredAt), desc(expenses.createdAt))
    .limit(page.limit)
    .offset(page.offset)
    .all()
    .map(toListItem);
}

export const countExpenses = (filter: ExpenseFilter, database: DbLike = db): number =>
  database.select({ n: count() }).from(expenses).where(buildWhere(filter)).get()?.n ?? 0;

export const listRecentExpenses = (limit: number, database: DbLike = db): ExpenseListItem[] =>
  listExpensePage({}, { limit, offset: 0 }, database);

export type ExpenseDetail = ExpenseListItem & {
  createdAt: number;
  updatedAt: number;
};

export function getExpenseDetail(id: string, database: DbLike = db): ExpenseDetail | null {
  const settled = settledTotals(database);

  const row = database
    .select(selection(settled))
    .from(expenses)
    .leftJoin(settled, eq(settled.expenseId, expenses.id))
    .leftJoin(categories, eq(categories.id, expenses.categoryId))
    .leftJoin(accounts, eq(accounts.id, expenses.accountId))
    .where(and(eq(expenses.id, id), alive))
    .get();

  if (row === undefined) return null;

  return {
    ...toListItem(row),
    createdAt: row.expense.createdAt,
    updatedAt: row.expense.updatedAt,
  };
}

/**
 * Distinct recent descriptions, most recent first — the §7.2 suggestions.
 *
 * Grouped rather than `SELECT DISTINCT … ORDER BY occurred_at`: that form orders
 * by a column outside the result set, which SQLite permits and answers with an
 * arbitrary row per group, so the suggestions were not actually the recent ones.
 * Ordering by `max(occurred_at)` asks the question that was meant.
 */
export const listRecentItems = (limit: number, database: DbLike = db): string[] =>
  database
    .select({ item: expenses.item, lastUsed: sql<number>`max(${expenses.occurredAt})` })
    .from(expenses)
    .where(alive)
    .groupBy(expenses.item)
    .orderBy(desc(sql`max(${expenses.occurredAt})`))
    .limit(limit)
    .all()
    .map((row) => row.item);

/** What the rules editor previews against, and what entry matches while typing. */
export const listMatchTargets = (
  limit: number,
  database: DbLike = db,
): { id: string; item: string; note: string }[] =>
  database
    .select({ id: expenses.id, item: expenses.item, note: expenses.note })
    .from(expenses)
    .where(alive)
    .orderBy(desc(expenses.occurredAt))
    .limit(limit)
    .all()
    .map((row) => ({ id: row.id, item: row.item, note: row.note ?? '' }));

/** Effective spend per period, for the carry-over walk and the trend chart. */
export function spentByPeriod(
  from: PeriodKey,
  to: PeriodKey,
  database: DbLike = db,
): Map<PeriodKey, Minor> {
  const settled = settledTotals(database);

  const rows = database
    .select({
      period: expenses.budgetPeriod,
      spent: sql<number>`sum(max(0, ${expenses.amountMinor} - coalesce(${settled.total}, 0)))`,
    })
    .from(expenses)
    .leftJoin(settled, eq(settled.expenseId, expenses.id))
    .where(
      and(
        alive,
        eq(expenses.countsToBudget, true),
        gte(expenses.budgetPeriod, from),
        // Period keys are zero-padded, so a string comparison is the calendar
        // comparison and the index on budget_period still applies.
        sql`${expenses.budgetPeriod} <= ${to}`,
      ),
    )
    .groupBy(expenses.budgetPeriod)
    .all();

  return new Map(rows.map((row) => [row.period, asMinor(row.spent ?? 0)]));
}

/**
 * What a month spent that deliberately does not count toward the budget (D3) —
 * the laptop, not the groceries. Real spending, and worth seeing, but it is not
 * what the ring is measuring.
 */
export function offBudgetSpend(period: PeriodKey, database: DbLike = db): Minor {
  const settled = settledTotals(database);

  const row = database
    .select({
      spent: sql<number>`coalesce(sum(max(0, ${expenses.amountMinor} - coalesce(${settled.total}, 0))), 0)`,
    })
    .from(expenses)
    .leftJoin(settled, eq(settled.expenseId, expenses.id))
    .where(and(alive, eq(expenses.countsToBudget, false), eq(expenses.budgetPeriod, period)))
    .get();

  return asMinor(row?.spent ?? 0);
}

/**
 * Category ids, most-used first — §7.2's "chips, most-used first".
 *
 * Counted over recent expenses rather than all of history, so the order tracks
 * what someone is buying now rather than what they bought two years ago.
 */
export function categoriesByUse(limit: number, database: DbLike = db): string[] {
  return database
    .select({ categoryId: expenses.categoryId, uses: sql<number>`count(*)` })
    .from(expenses)
    .where(and(alive, sql`${expenses.categoryId} is not null`))
    .groupBy(expenses.categoryId)
    .orderBy(desc(sql`count(*)`))
    .limit(limit)
    .all()
    .map((row) => row.categoryId)
    .filter((id): id is string => id !== null);
}

export const earliestActivityPeriod = (database: DbLike = db): PeriodKey | null =>
  database
    .select({ period: expenses.budgetPeriod })
    .from(expenses)
    .where(alive)
    .orderBy(asc(expenses.budgetPeriod))
    .limit(1)
    .get()?.period ?? null;

/** Cycle spend for a card, over a half-open window. Utilisation ignores D3. */
export function cycleSpend(
  accountId: string,
  window: { startMs: number; endMs: number },
  database: DbLike = db,
): Minor {
  const settled = settledTotals(database);

  const row = database
    .select({
      spent: sql<number>`sum(max(0, ${expenses.amountMinor} - coalesce(${settled.total}, 0)))`,
    })
    .from(expenses)
    .leftJoin(settled, eq(settled.expenseId, expenses.id))
    .where(
      and(
        alive,
        eq(expenses.accountId, accountId),
        gte(expenses.occurredAt, window.startMs),
        lt(expenses.occurredAt, window.endMs),
      ),
    )
    .get();

  return asMinor(row?.spent ?? 0);
}

/** The account the last expense was paid from — the entry form's default (§7.2). */
export const lastUsedAccountId = (database: DbLike = db): string | null =>
  database
    .select({ accountId: expenses.accountId })
    .from(expenses)
    .where(alive)
    .orderBy(desc(expenses.createdAt))
    .limit(1)
    .get()?.accountId ?? null;

/* -------------------------------------------------------------------------- */
/* Writes                                                                       */
/* -------------------------------------------------------------------------- */

function validate(input: ExpenseInput): void {
  if (input.item.trim().length === 0) {
    throw new ValidationError('item', 'An expense needs a description.');
  }
  if (input.amountMinor <= 0) {
    throw new ValidationError('amount', 'An expense needs an amount.');
  }
  if (!Number.isFinite(input.occurredAt)) {
    throw new ValidationError('date', 'That is not a valid date.');
  }
}

const normalise = (input: ExpenseInput) => {
  const note = input.note?.trim() ?? '';
  return {
    occurredAt: input.occurredAt,
    budgetPeriod: periodOf(input.occurredAt),
    amountMinor: input.amountMinor,
    item: input.item.trim(),
    note: note.length > 0 ? note : null,
    categoryId: input.categoryId ?? null,
    accountId: input.accountId ?? null,
    countsToBudget: input.countsToBudget,
  };
};

export function createExpense(input: ExpenseInput, database: DbLike = db): string {
  validate(input);

  const id = newId();
  const now = Date.now();
  const values = normalise(input);

  writeTransaction((tx) => {
    /* The row records what the amount was entered in, so a later currency
       change never rewrites history. */
    tx.insert(expenses)
      .values({ id, ...values, currency: getActiveCurrency().code, createdAt: now, updatedAt: now })
      .run();
    markCarryDirty(values.budgetPeriod, tx);
  }, database);

  return id;
}

export function updateExpense(id: string, input: ExpenseInput, database: DbLike = db): void {
  validate(input);

  const existing = database
    .select()
    .from(expenses)
    .where(and(eq(expenses.id, id), alive))
    .get();
  if (existing === undefined) throw new NotFoundError('Expense', id);

  const values = normalise(input);

  writeTransaction((tx) => {
    /*
     * §5's rule is that settlements may never exceed the expense, and lowering
     * the amount can break it just as surely as adding a settlement can. Read
     * the settled total inside the same transaction that writes, for the same
     * reason addSettlement does.
     */
    const settled = tx
      .select({ total: sql<number>`coalesce(sum(${settlements.amountMinor}), 0)` })
      .from(settlements)
      .where(and(eq(settlements.expenseId, id), isNull(settlements.deletedAt)))
      .get();
    const settledMinor = asMinor(settled?.total ?? 0);

    if (values.amountMinor < settledMinor) {
      throw new SettlementExceedsExpenseError(settledMinor, 'lowering-below-settled');
    }

    tx.update(expenses)
      .set({ ...values, updatedAt: Date.now() })
      .where(eq(expenses.id, id))
      .run();

    /*
     * Moving the date takes spend out of one month and puts it in another, so
     * both are stale. Changing only the description changes no total, but
     * marking is cheap and a missed mark is a wrong number on the home screen —
     * so anything but a pure text edit marks.
     */
    if (
      existing.budgetPeriod !== values.budgetPeriod ||
      existing.amountMinor !== values.amountMinor ||
      existing.countsToBudget !== values.countsToBudget
    ) {
      markCarryDirtyForMove(existing.budgetPeriod, values.budgetPeriod, tx);
    }
  }, database);
}

export function softDeleteExpense(id: string, database: DbLike = db): void {
  const existing = database.select().from(expenses).where(eq(expenses.id, id)).get();
  if (existing === undefined) throw new NotFoundError('Expense', id);

  writeTransaction((tx) => {
    tx.update(expenses).set({ deletedAt: Date.now(), updatedAt: Date.now() }).where(eq(expenses.id, id)).run();
    markCarryDirty(existing.budgetPeriod, tx);
  }, database);
}

/** The undo behind the swipe. Soft delete is what makes it free. */
export function restoreExpense(id: string, database: DbLike = db): void {
  const existing = database.select().from(expenses).where(eq(expenses.id, id)).get();
  if (existing === undefined) throw new NotFoundError('Expense', id);

  writeTransaction((tx) => {
    tx.update(expenses).set({ deletedAt: null, updatedAt: Date.now() }).where(eq(expenses.id, id)).run();
    markCarryDirty(existing.budgetPeriod, tx);
  }, database);
}
