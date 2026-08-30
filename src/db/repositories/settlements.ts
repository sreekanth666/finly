/**
 * Settlements — money coming back against a specific expense (D1).
 *
 * This is the canonical example of an integrity rule SQLite cannot express:
 * the *total* of an expense's settlements may not exceed the expense (§5). A
 * CHECK constraint sees one row at a time, so the rule is enforced here.
 *
 * It is enforced by reading the existing total inside the same transaction that
 * writes the new row. Reading it in the UI — which is what the sheet's
 * `outstanding` prop does — is a hint that stops the user typing too much; it is
 * not enforcement, and it loses to a double-tapped Save button. Drizzle's expo
 * driver runs a transaction body synchronously in one JS tick, so nothing can
 * interleave between the read and the insert.
 */

import { and, asc, eq, isNull, sql } from 'drizzle-orm';

import { asMinor, subMinor, type Minor } from '@/domain/money';

import { markCarryDirty } from '../carry-over';
import { db, type DbLike } from '../client';
import { NotFoundError, SettlementExceedsExpenseError, ValidationError } from '../errors';
import { newId } from '../id';
import { accounts, expenses, settlements } from '../schema';
import { writeTransaction } from '../transaction';

const alive = isNull(settlements.deletedAt);

export type SettlementInput = {
  expenseId: string;
  amountMinor: Minor;
  settledAt: number;
  /** Where the money landed. */
  accountId?: string | null;
  note?: string | null;
};

export type SettlementListItem = {
  id: string;
  amountMinor: Minor;
  settledAt: number;
  note: string | null;
  account: { id: string; name: string } | null;
};

export function listSettlements(expenseId: string, database: DbLike = db): SettlementListItem[] {
  return database
    .select({
      settlement: settlements,
      account: { id: accounts.id, name: accounts.name },
    })
    .from(settlements)
    .leftJoin(accounts, eq(accounts.id, settlements.accountId))
    .where(and(eq(settlements.expenseId, expenseId), alive))
    .orderBy(asc(settlements.settledAt))
    .all()
    .map((row) => ({
      id: row.settlement.id,
      amountMinor: row.settlement.amountMinor,
      settledAt: row.settlement.settledAt,
      note: row.settlement.note,
      account: row.account?.id == null ? null : row.account,
    }));
}

export function settledMinorFor(expenseId: string, database: DbLike = db): Minor {
  const row = database
    .select({ total: sql<number>`coalesce(sum(${settlements.amountMinor}), 0)` })
    .from(settlements)
    .where(and(eq(settlements.expenseId, expenseId), alive))
    .get();

  return asMinor(row?.total ?? 0);
}

/** What may still be settled against an expense. Drives the sheet's guard rail. */
export function outstandingFor(expenseId: string, database: DbLike = db): Minor {
  const expense = database
    .select({ amountMinor: expenses.amountMinor })
    .from(expenses)
    .where(and(eq(expenses.id, expenseId), isNull(expenses.deletedAt)))
    .get();

  if (expense === undefined) throw new NotFoundError('Expense', expenseId);

  return subMinor(expense.amountMinor, settledMinorFor(expenseId, database));
}

export function addSettlement(input: SettlementInput, database: DbLike = db): string {
  if (input.amountMinor <= 0) {
    throw new ValidationError('amount', 'A settlement needs an amount.');
  }

  const id = newId();
  const now = Date.now();
  const note = input.note?.trim() ?? '';

  writeTransaction((tx) => {
    const expense = tx
      .select({ amountMinor: expenses.amountMinor, budgetPeriod: expenses.budgetPeriod })
      .from(expenses)
      .where(and(eq(expenses.id, input.expenseId), isNull(expenses.deletedAt)))
      .get();

    if (expense === undefined) throw new NotFoundError('Expense', input.expenseId);

    const alreadySettled = settledMinorFor(input.expenseId, tx);
    const remaining = subMinor(expense.amountMinor, alreadySettled);

    if (input.amountMinor > remaining) {
      throw new SettlementExceedsExpenseError(remaining);
    }

    tx.insert(settlements)
      .values({
        id,
        expenseId: input.expenseId,
        amountMinor: input.amountMinor,
        settledAt: input.settledAt,
        accountId: input.accountId ?? null,
        note: note.length > 0 ? note : null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    /*
     * The EXPENSE's period, not the month the money came back in. A February
     * recharge repaid in March makes February ₹0 (§4.3) — that is the whole
     * point of settlements being linked records rather than edits.
     */
    markCarryDirty(expense.budgetPeriod, tx);
  }, database);

  return id;
}

export function softDeleteSettlement(id: string, database: DbLike = db): void {
  writeTransaction((tx) => {
    const row = tx
      .select({ expenseId: settlements.expenseId })
      .from(settlements)
      .where(eq(settlements.id, id))
      .get();

    if (row === undefined) throw new NotFoundError('Settlement', id);

    const expense = tx
      .select({ budgetPeriod: expenses.budgetPeriod })
      .from(expenses)
      .where(eq(expenses.id, row.expenseId))
      .get();

    tx.update(settlements)
      .set({ deletedAt: Date.now(), updatedAt: Date.now() })
      .where(eq(settlements.id, id))
      .run();

    if (expense !== undefined) markCarryDirty(expense.budgetPeriod, tx);
  }, database);
}
