/**
 * Accounts — the payment sources.
 *
 * The design pass joined these by display name (`Transaction.accountName`), so
 * renaming a card silently orphaned every expense that referenced it. Everything
 * here is keyed by id.
 *
 * §5's integrity rule that SQLite cannot express: an account with history is
 * archived, never deleted. `deleteAccount` refuses rather than cascading, so a
 * card cannot take a year of expenses down with it.
 */

import { and, asc, count, eq, isNull } from 'drizzle-orm';

import { asMinor, type Minor } from '@/domain/money';

import { db, type DbLike } from '../client';
import { AccountInUseError, ValidationError } from '../errors';
import { newId } from '../id';
import {
  accounts,
  expenses,
  ruleActions,
  settlements,
  type AccountRow,
  type AccountType,
} from '../schema';
import { writeTransaction } from '../transaction';

const alive = isNull(accounts.deletedAt);

export type AccountInput = {
  name: string;
  type: AccountType;
  issuer?: string | null;
  last4?: string | null;
  creditLimitMinor?: Minor | null;
  statementDay?: number | null;
  colorToken: string;
};

export function listAccounts(
  { includeArchived = false }: { includeArchived?: boolean } = {},
  database: DbLike = db,
): AccountRow[] {
  const rows = database.select().from(accounts).where(alive).orderBy(asc(accounts.sortOrder)).all();
  return includeArchived ? rows : rows.filter((row) => !row.isArchived);
}

/** Cards with a limit — the only accounts utilisation means anything for (D6). */
export const listCreditCards = (database: DbLike = db): AccountRow[] =>
  listAccounts({}, database).filter(
    (row) => row.type === 'credit_card' && (row.creditLimitMinor ?? 0) > 0,
  );

export const getAccount = (id: string, database: DbLike = db): AccountRow | null =>
  database.select().from(accounts).where(eq(accounts.id, id)).get() ?? null;

/**
 * Validated before SQL rather than left to the CHECK constraints, so the editor
 * can point at the offending field instead of surfacing `SQLITE_CONSTRAINT`.
 */
function validate(input: AccountInput): void {
  if (input.name.trim().length === 0) {
    throw new ValidationError('name', 'An account needs a name.');
  }

  const last4 = input.last4?.trim() ?? '';
  if (last4.length > 0 && !/^\d{4}$/.test(last4)) {
    throw new ValidationError('last4', 'Enter the last four digits, or leave it blank.');
  }

  if (input.statementDay != null && (input.statementDay < 1 || input.statementDay > 31)) {
    throw new ValidationError('statementDay', 'A statement day is between 1 and 31.');
  }

  if (input.type === 'credit_card' && (input.creditLimitMinor ?? 0) <= 0) {
    throw new ValidationError('creditLimit', 'A credit card needs a credit limit.');
  }
}

const normalise = (input: AccountInput) => {
  const last4 = input.last4?.trim() ?? '';
  const issuer = input.issuer?.trim() ?? '';
  const isCard = input.type === 'credit_card';

  return {
    name: input.name.trim(),
    type: input.type,
    issuer: issuer.length > 0 ? issuer : null,
    last4: last4.length > 0 ? last4 : null,
    // A limit and a statement day on a cash account would satisfy the schema and
    // quietly show up in utilisation, so they are dropped rather than stored.
    creditLimitMinor: isCard ? (input.creditLimitMinor ?? null) : null,
    statementDay: isCard ? (input.statementDay ?? null) : null,
    colorToken: input.colorToken,
  };
};

export function createAccount(input: AccountInput, database: DbLike = db): string {
  validate(input);

  const id = newId();
  const now = Date.now();
  const highest = listAccounts({ includeArchived: true }, database).at(-1)?.sortOrder ?? -1;

  database
    .insert(accounts)
    .values({
      id,
      ...normalise(input),
      sortOrder: highest + 1,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return id;
}

export function updateAccount(id: string, input: AccountInput, database: DbLike = db): void {
  validate(input);

  database
    .update(accounts)
    .set({ ...normalise(input), updatedAt: Date.now() })
    .where(eq(accounts.id, id))
    .run();
}

export function setAccountArchived(id: string, isArchived: boolean, database: DbLike = db): void {
  database
    .update(accounts)
    .set({ isArchived, updatedAt: Date.now() })
    .where(eq(accounts.id, id))
    .run();
}

export function reorderAccounts(orderedIds: readonly string[], database: DbLike = db): void {
  const now = Date.now();
  orderedIds.forEach((id, index) => {
    database
      .update(accounts)
      .set({ sortOrder: index, updatedAt: now })
      .where(eq(accounts.id, id))
      .run();
  });
}

export type AccountReferences = {
  expenses: number;
  settlements: number;
  ruleActions: number;
  total: number;
};

/** Counts soft-deleted rows too: an undo would bring the reference back. */
export function countAccountReferences(id: string, database: DbLike = db): AccountReferences {
  const expenseCount =
    database.select({ n: count() }).from(expenses).where(eq(expenses.accountId, id)).get()?.n ?? 0;
  const settlementCount =
    database.select({ n: count() }).from(settlements).where(eq(settlements.accountId, id)).get()?.n ??
    0;
  const ruleActionCount =
    database
      .select({ n: count() })
      .from(ruleActions)
      .where(and(eq(ruleActions.type, 'set_account'), eq(ruleActions.value, id)))
      .get()?.n ?? 0;

  return {
    expenses: expenseCount,
    settlements: settlementCount,
    ruleActions: ruleActionCount,
    total: expenseCount + settlementCount + ruleActionCount,
  };
}

/** Throws rather than cascading. §5: archive an account with history. */
export function deleteAccount(id: string, database: DbLike = db): void {
  writeTransaction((tx) => {
    const references = countAccountReferences(id, tx);
    if (references.total > 0) {
      throw new AccountInUseError(references.total);
    }
    tx.delete(accounts).where(eq(accounts.id, id)).run();
  }, database);
}

/** Convenience for the CSV importer, which matches on what the sheet wrote. */
export function findAccountByName(name: string, database: DbLike = db): AccountRow | null {
  const wanted = name.trim().toLowerCase();
  return listAccounts({ includeArchived: true }, database).find(
    (row) => row.name.trim().toLowerCase() === wanted,
  ) ?? null;
}

export const creditLimitOf = (row: AccountRow): Minor => row.creditLimitMinor ?? asMinor(0);
