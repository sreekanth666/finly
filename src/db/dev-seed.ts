/**
 * Three months of plausible history, for development only.
 *
 * The M2 and M4 acceptance criteria — "correct available/spent/remaining across
 * three seeded months", "the recharge case reads ₹0 and the next month's
 * carry-over updates" — cannot be checked against an empty database, and typing
 * three months of expenses by hand before every check is not a plan.
 *
 * Deliberately not automatic. It is reachable only from a long-press on the
 * Settings About row in a dev build, so it can never contaminate real data.
 */

import { rupees } from '@/domain/money';
import { addPeriods, currentPeriod, parsePeriod } from '@/domain/period';

import { db, type DbLike } from './client';
import { createAccount } from './repositories/accounts';
import { listCategories } from './repositories/categories';
import { countExpenses, createExpense } from './repositories/expenses';
import { createRule } from './repositories/rules';
import { addSettlement } from './repositories/settlements';

/** Local midday on a given day of a period, so nothing drifts across a date. */
function dayIn(period: string, day: number): number {
  const { year, month } = parsePeriod(period);
  return new Date(year, month - 1, day, 12, 0).getTime();
}

export type DevSeedResult = { expenses: number; accounts: number; settlements: number; rules: number };

export function runDevSeed(database: DbLike = db): DevSeedResult {
  const categories = listCategories({}, database);
  const byName = (name: string) => categories.find((row) => row.name === name)?.id ?? null;

  const millennia = createAccount(
    {
      name: 'HDFC Millennia',
      type: 'credit_card',
      issuer: 'HDFC Bank',
      last4: '4821',
      creditLimitMinor: rupees(400000),
      // A 31st statement day, precisely so short-month clamping gets exercised.
      statementDay: 31,
      colorToken: 'accent',
    },
    database,
  );

  const icici = createAccount(
    { name: 'ICICI Bank', type: 'bank', issuer: 'ICICI', colorToken: 'iris' },
    database,
  );

  const thisMonth = currentPeriod();
  const lastMonth = addPeriods(thisMonth, -1);
  const twoMonthsAgo = addPeriods(thisMonth, -2);

  type Row = {
    period: string;
    day: number;
    item: string;
    category: string;
    amount: number;
    accountId: string | null;
    countsToBudget?: boolean;
    note?: string;
  };

  const rows: Row[] = [
    // Two months ago: comfortably over ₹5,000, so something carries.
    { period: twoMonthsAgo, day: 3, item: 'Monthly rent', category: 'Housing', amount: 3200, accountId: icici },
    { period: twoMonthsAgo, day: 8, item: 'Big Bazaar', category: 'Groceries', amount: 1840, accountId: millennia },
    { period: twoMonthsAgo, day: 14, item: 'Swiggy', category: 'Food', amount: 420, accountId: millennia },
    { period: twoMonthsAgo, day: 21, item: 'Electricity bill', category: 'Bills', amount: 760, accountId: icici },
    { period: twoMonthsAgo, day: 26, item: 'Metro recharge', category: 'Transport', amount: 300, accountId: millennia },

    // Last month: over again, so the carry compounds.
    { period: lastMonth, day: 2, item: 'Monthly rent', category: 'Housing', amount: 3200, accountId: icici },
    { period: lastMonth, day: 6, item: 'Pharmacy', category: 'Health', amount: 540, accountId: millennia },
    { period: lastMonth, day: 11, item: 'Swiggy', category: 'Food', amount: 380, accountId: millennia },
    { period: lastMonth, day: 17, item: 'Phone recharge for Arjun', category: 'Personal', amount: 500, accountId: millennia, note: 'He will pay this back' },
    { period: lastMonth, day: 23, item: 'Laptop', category: 'Shopping', amount: 45000, accountId: millennia, countsToBudget: false, note: 'One-off, not part of the routine' },

    // This month.
    { period: thisMonth, day: 1, item: 'Monthly rent', category: 'Housing', amount: 3200, accountId: icici },
    { period: thisMonth, day: 4, item: 'Big Bazaar', category: 'Groceries', amount: 1260, accountId: millennia },
    { period: thisMonth, day: 5, item: 'Swiggy', category: 'Food', amount: 410, accountId: millennia },
  ];

  let repayable: string | null = null;

  for (const row of rows) {
    const id = createExpense(
      {
        occurredAt: dayIn(row.period, row.day),
        amountMinor: rupees(row.amount),
        item: row.item,
        note: row.note ?? null,
        categoryId: byName(row.category),
        accountId: row.accountId,
        countsToBudget: row.countsToBudget ?? true,
      },
      database,
    );

    if (row.item.startsWith('Phone recharge')) repayable = id;
  }

  /*
   * The §4.3 case, seeded on purpose: a recharge paid for last month, repaid in
   * full this month. Last month must read ₹0 for it, and last month's carry-over
   * into this one must shrink accordingly.
   */
  let settlements = 0;
  if (repayable !== null) {
    addSettlement(
      {
        expenseId: repayable,
        amountMinor: rupees(500),
        settledAt: dayIn(thisMonth, 3),
        accountId: icici,
        note: 'Arjun paid it back',
      },
      database,
    );
    settlements = 1;
  }

  /* §9's M5 acceptance check is "a swiggy rule fills category and account while
     typing", so the seed provides exactly that to try. */
  createRule(
    {
      name: 'Food delivery',
      priority: 100,
      isEnabled: true,
      matchMode: 'any',
      conditions: [
        { field: 'item', operator: 'contains', value: 'swiggy' },
        { field: 'item', operator: 'contains', value: 'zomato' },
      ],
      actions: [
        ...(byName('Food') === null
          ? []
          : [{ type: 'set_category' as const, categoryId: byName('Food')! }]),
        { type: 'set_account' as const, accountId: millennia },
      ],
    },
    database,
  );

  return { expenses: rows.length, accounts: 2, settlements, rules: 1 };
}

export const hasAnyExpenses = (database: DbLike = db): boolean =>
  countExpenses({}, database) > 0;
