/**
 * Turning validated CSV rows into expenses.
 *
 * The account and category named in the file are **created when they don't
 * match** an existing one, rather than dropped. The `from` column is the whole
 * point of D6 — without it, imported history contributes nothing to per-card
 * spend or utilisation, which is most of what the import is for.
 */

import { db, type DbLike } from '@/db/client';
import { withSuppressedInvalidation } from '@/db/live';
import { createAccount, listAccounts } from '@/db/repositories/accounts';
import { createCategory, listCategories } from '@/db/repositories/categories';
import { createExpense, listExpensePage } from '@/db/repositories/expenses';
import type { ImportRow } from '@/domain/csv';
import { yieldToUi } from '@/db/transaction';

export type ImportPlan = {
  /** Rows that will be written. */
  ready: ImportRow[];
  /** Names in the file with no matching account. */
  newAccounts: string[];
  /** Names in the file with no matching category. */
  newCategories: string[];
  /** Rows that look like something already recorded. */
  duplicates: ImportRow[];
};

const key = (occurredAt: number | null, item: string, amount: number | null) =>
  `${occurredAt ?? 0}|${item.trim().toLowerCase()}|${amount ?? 0}`;

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * What the import would do, worked out before anything is written so the
 * preview can say it out loud.
 */
export function planImport(rows: readonly ImportRow[], database: DbLike = db): ImportPlan {
  const ready = rows.filter((row) => row.issues.length === 0);

  const accounts = listAccounts({ includeArchived: true }, database);
  const categories = listCategories({ includeArchived: true }, database);

  const newAccounts = [
    ...new Set(
      ready
        .map((row) => row.account.trim())
        .filter((name) => name.length > 0 && !accounts.some((row) => sameName(row.name, name))),
    ),
  ];

  const newCategories = [
    ...new Set(
      ready
        .map((row) => row.category.trim())
        .filter((name) => name.length > 0 && !categories.some((row) => sameName(row.name, name))),
    ),
  ];

  /*
   * Duplicate detection is on date, description and amount together. Two coffees
   * on the same day for the same price are indistinguishable from one imported
   * twice, so this is offered as a skip rather than applied silently.
   */
  const existing = new Set(
    listExpensePage({}, { limit: 5000, offset: 0 }, database).map((expense) =>
      key(expense.occurredAt, expense.item, expense.amountMinor),
    ),
  );
  const duplicates = ready.filter((row) => existing.has(key(row.occurredAt, row.item, row.amount)));

  return { ready, newAccounts, newCategories, duplicates };
}

export type ImportResult = {
  imported: number;
  skipped: number;
  createdAccounts: number;
  createdCategories: number;
};

const CHUNK = 100;

export async function runImport(
  rows: readonly ImportRow[],
  options: { skipDuplicates: boolean },
  database: DbLike = db,
): Promise<ImportResult> {
  const plan = planImport(rows, database);
  const duplicateKeys = new Set(
    plan.duplicates.map((row) => key(row.occurredAt, row.item, row.amount)),
  );

  const toWrite = options.skipDuplicates
    ? plan.ready.filter((row) => !duplicateKeys.has(key(row.occurredAt, row.item, row.amount)))
    : plan.ready;

  return withSuppressedInvalidation(async () => {
    const accountIds = new Map<string, string>();
    const categoryIds = new Map<string, string>();

    for (const row of listAccounts({ includeArchived: true }, database)) {
      accountIds.set(row.name.trim().toLowerCase(), row.id);
    }
    for (const row of listCategories({ includeArchived: true }, database)) {
      categoryIds.set(row.name.trim().toLowerCase(), row.id);
    }

    let createdAccounts = 0;
    for (const name of plan.newAccounts) {
      // Imported accounts land as 'bank': a statement does not say what kind of
      // account it is, and guessing 'credit_card' would demand a credit limit
      // the file cannot supply and put a fictional card in every utilisation.
      const id = createAccount({ name, type: 'bank', colorToken: 'accent' }, database);
      accountIds.set(name.trim().toLowerCase(), id);
      createdAccounts += 1;
    }

    let createdCategories = 0;
    for (const name of plan.newCategories) {
      const id = createCategory(
        { name, icon: 'Ellipsis', colorToken: 'muted', chartTone: 'chart-5' },
        database,
      );
      categoryIds.set(name.trim().toLowerCase(), id);
      createdCategories += 1;
    }

    let imported = 0;
    for (let index = 0; index < toWrite.length; index += CHUNK) {
      for (const row of toWrite.slice(index, index + CHUNK)) {
        if (row.occurredAt === null || row.amount === null) continue;

        createExpense(
          {
            occurredAt: row.occurredAt,
            amountMinor: row.amount,
            item: row.item,
            note: row.note.length > 0 ? row.note : null,
            categoryId: categoryIds.get(row.category.trim().toLowerCase()) ?? null,
            accountId: accountIds.get(row.account.trim().toLowerCase()) ?? null,
            countsToBudget: true,
          },
          database,
        );
        imported += 1;
      }

      // Reads are synchronous, so a long import would otherwise hold the JS
      // thread for its whole duration and freeze the progress it is reporting.
      if (index + CHUNK < toWrite.length) await yieldToUi();
    }

    return {
      imported,
      skipped: plan.ready.length - imported,
      createdAccounts,
      createdCategories,
    };
  });
}
