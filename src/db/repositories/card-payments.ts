/**
 * Card payments — money paid toward a credit card's bill (D20).
 *
 * A payment is not spending. The purchases it pays for are expenses already,
 * each counted in the budget month it happened, so a bill payment recorded as
 * an expense counts them all a second time. That is what people did before this
 * existed, because it was the only place to put one. A payment lives here
 * instead and only ever lowers what the card owes.
 */

import { and, desc, eq, gte, isNull, sql } from 'drizzle-orm';

import { isSamePayment, PAYMENT_MATCH_WINDOW_MS } from '@/domain/card-balance';
import { asMinor, type Minor } from '@/domain/money';

import { db, type DbLike } from '../client';
import { NotFoundError, ValidationError } from '../errors';
import { newId } from '../id';
import {
  accounts,
  cardPayments,
  detectedTransactions,
  expenses,
  settlements,
  type AccountRow,
  type CardPaymentSource,
} from '../schema';
import { writeTransaction } from '../transaction';
import { restoreExpense, softDeleteExpense } from './expenses';

const alive = isNull(cardPayments.deletedAt);

export type CardPaymentInput = {
  /** The card paid. */
  accountId: string;
  amountMinor: Minor;
  paidAt: number;
  fromAccountId?: string | null;
  note?: string | null;
  source?: CardPaymentSource;
  sourceText?: string | null;
};

export type CardPaymentListItem = {
  id: string;
  amountMinor: Minor;
  paidAt: number;
  note: string | null;
  source: CardPaymentSource;
  fromAccount: { id: string; name: string } | null;
};

/** The card a payment is for: a live credit card, or nothing to pay. */
function requireCard(id: string, database: DbLike): AccountRow {
  const card = database
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, id), isNull(accounts.deletedAt)))
    .get();
  if (card === undefined) throw new NotFoundError('Account', id);
  if (card.type !== 'credit_card') {
    throw new ValidationError('card', 'Only a credit card has a bill to pay.');
  }
  return card;
}

export function listCardPayments(cardId: string, database: DbLike = db): CardPaymentListItem[] {
  return database
    .select({
      payment: cardPayments,
      fromAccount: { id: accounts.id, name: accounts.name },
    })
    .from(cardPayments)
    .leftJoin(accounts, eq(accounts.id, cardPayments.fromAccountId))
    .where(and(eq(cardPayments.accountId, cardId), alive))
    .orderBy(desc(cardPayments.paidAt), desc(cardPayments.createdAt))
    .all()
    .map((row) => ({
      id: row.payment.id,
      amountMinor: row.payment.amountMinor,
      paidAt: row.payment.paidAt,
      note: row.payment.note,
      source: row.payment.source,
      fromAccount: row.fromAccount?.id == null ? null : row.fromAccount,
    }));
}

/** Payments toward a card since a moment — the paying half of what it owes. */
export function paidSince(cardId: string, since: number, database: DbLike = db): Minor {
  const row = database
    .select({ total: sql<number>`coalesce(sum(${cardPayments.amountMinor}), 0)` })
    .from(cardPayments)
    .where(and(eq(cardPayments.accountId, cardId), alive, gte(cardPayments.paidAt, since)))
    .get();

  return asMinor(row?.total ?? 0);
}

export function addCardPayment(input: CardPaymentInput, database: DbLike = db): string {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new ValidationError('amount', 'A payment needs an amount.');
  }
  if (input.fromAccountId != null && input.fromAccountId === input.accountId) {
    throw new ValidationError('fromAccount', 'A card can’t pay its own bill.');
  }

  const id = newId();
  const now = Date.now();
  const note = input.note?.trim() ?? '';

  writeTransaction((tx) => {
    requireCard(input.accountId, tx);
    tx.insert(cardPayments)
      .values({
        id,
        accountId: input.accountId,
        amountMinor: input.amountMinor,
        paidAt: input.paidAt,
        fromAccountId: input.fromAccountId ?? null,
        note: note.length > 0 ? note : null,
        source: input.source ?? 'manual',
        sourceText: input.sourceText ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }, database);

  return id;
}

/** Soft, so the swipe that removes one can put it back. */
export function softDeleteCardPayment(id: string, database: DbLike = db): void {
  database
    .update(cardPayments)
    .set({ deletedAt: Date.now(), updatedAt: Date.now() })
    .where(eq(cardPayments.id, id))
    .run();
}

export function restoreCardPayment(id: string, database: DbLike = db): void {
  database
    .update(cardPayments)
    .set({ deletedAt: null, updatedAt: Date.now() })
    .where(eq(cardPayments.id, id))
    .run();
}

/**
 * Anchors a card to what the user says it owes right now (D20). Calling it again
 * re-anchors: "Adjust balance" is the same act, and it is how a figure that has
 * drifted from the card's own app — a fee, interest, a purchase never entered —
 * is brought back in line without inventing a record to explain the gap.
 */
export function setCardOpeningOwed(
  cardId: string,
  owedMinor: Minor,
  at: number = Date.now(),
  database: DbLike = db,
): void {
  if (!Number.isInteger(owedMinor) || owedMinor < 0) {
    throw new ValidationError('owed', 'Enter what the card owes, or zero if nothing.');
  }

  writeTransaction((tx) => {
    requireCard(cardId, tx);
    tx.update(accounts)
      .set({ openingOwedMinor: owedMinor, openingOwedAt: at, updatedAt: Date.now() })
      .where(eq(accounts.id, cardId))
      .run();
  }, database);
}

/**
 * A payment already recorded that an alert describes — the second alert for one
 * payment. Null when there is none, and the alert is a new payment.
 */
export function findMatchingPayment(
  cardId: string,
  amountMinor: Minor,
  occurredAt: number,
  database: DbLike = db,
): string | null {
  const nearby = database
    .select({ id: cardPayments.id, amountMinor: cardPayments.amountMinor, paidAt: cardPayments.paidAt })
    .from(cardPayments)
    .where(
      and(
        eq(cardPayments.accountId, cardId),
        alive,
        gte(cardPayments.paidAt, occurredAt - PAYMENT_MATCH_WINDOW_MS),
        sql`${cardPayments.paidAt} <= ${occurredAt + PAYMENT_MATCH_WINDOW_MS}`,
      ),
    )
    .all();

  return nearby.find((payment) => isSamePayment(payment, { amountMinor, occurredAt }))?.id ?? null;
}

/**
 * "This was a card bill payment": an expense someone logged because there was
 * nowhere else to put it becomes the payment it always was. One transaction —
 * the payment is written, the expense leaves spending (and the budget month it
 * sat in is marked for recompute, through the ordinary delete), and an alert it
 * was confirmed from follows it. Returns the payment's id, which is what the
 * undo needs.
 */
export function convertExpenseToCardPayment(
  expenseId: string,
  cardId: string,
  database: DbLike = db,
): string {
  return writeTransaction((tx) => {
    const expense = tx
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, expenseId), isNull(expenses.deletedAt)))
      .get();
    if (expense === undefined) throw new NotFoundError('Expense', expenseId);

    /* A payment has no money back. Carrying the settlements across would lose
       them, and leaving them on a deleted expense would hide them. */
    const settledCount =
      tx
        .select({ n: sql<number>`count(*)` })
        .from(settlements)
        .where(and(eq(settlements.expenseId, expenseId), isNull(settlements.deletedAt)))
        .get()?.n ?? 0;
    if (settledCount > 0) {
      throw new ValidationError(
        'settlements',
        'This expense has money back recorded against it. Remove that first.',
      );
    }

    const id = newId();
    const now = Date.now();
    requireCard(cardId, tx);

    tx.insert(cardPayments)
      .values({
        id,
        accountId: cardId,
        amountMinor: expense.amountMinor,
        paidAt: expense.occurredAt,
        /* Logged against the card itself, it said nothing about where the money
           came from — only which card the user had in mind. */
        fromAccountId: expense.accountId === cardId ? null : expense.accountId,
        note: expense.item,
        source: 'converted',
        sourceText: expense.sourceText,
        expenseId,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    softDeleteExpense(expenseId, tx);

    tx.update(detectedTransactions)
      .set({ cardPaymentId: id, updatedAt: now })
      .where(eq(detectedTransactions.expenseId, expenseId))
      .run();

    return id;
  }, database);
}

/** The undo behind a conversion: the expense comes back, the payment goes. */
export function undoConversion(paymentId: string, database: DbLike = db): void {
  writeTransaction((tx) => {
    const payment = tx.select().from(cardPayments).where(eq(cardPayments.id, paymentId)).get();
    if (payment === undefined) throw new NotFoundError('Card payment', paymentId);
    if (payment.expenseId === null) {
      throw new ValidationError('payment', 'This payment was not converted from an expense.');
    }

    restoreExpense(payment.expenseId, tx);
    softDeleteCardPayment(paymentId, tx);
    tx.update(detectedTransactions)
      .set({ cardPaymentId: null, updatedAt: Date.now() })
      .where(eq(detectedTransactions.cardPaymentId, paymentId))
      .run();
  }, database);
}
