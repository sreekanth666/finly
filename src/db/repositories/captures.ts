/**
 * The review inbox's storage (D17): captured messages and what was read from
 * them.
 *
 * Nothing here writes to the budget until `confirmCandidate`, which creates an
 * ordinary expense through `createExpense` — so a confirmed alert is subject to
 * every rule an expense typed by hand is. Credits never become expenses; they
 * can only become money back against one, through `addSettlement` (D1).
 *
 * Writes compose: confirm creates the expense, remembers the account tail,
 * saves a rule and counts a rule's use in one transaction, nested through
 * savepoints, so a failure halfway leaves nothing behind.
 */

import { and, asc, between, count, desc, eq, inArray, isNull, lt, ne, or, sql } from 'drizzle-orm';

import { asMinor, type Minor } from '@/domain/money';
import {
  bodyKeyOf,
  DUPLICATE_WINDOW_MS,
  EPHEMERAL_KINDS,
  labelOf,
  looksLikeManual,
  redactCodes,
  sameTransaction,
  sourceTextOf,
  type Detection,
  type Suggestion,
} from '@/domain/txn-detect';

import { db, type DbLike } from '../client';
import { NotFoundError, ValidationError } from '../errors';
import { newId } from '../id';
import {
  accounts,
  capturedMessages,
  categories,
  detectedTransactions,
  type CandidateStatus,
  type CaptureSourceColumn,
  type DetectedTransactionRow,
} from '../schema';
import { writeTransaction } from '../transaction';
import { rememberAccountTail } from './accounts';
import {
  attachSourceText,
  createExpense,
  listLinkableExpenses,
  softDeleteExpense,
  type ExpenseInput,
} from './expenses';
import { createRule, recordRuleApplied } from './rules';
import { addSettlement } from './settlements';

const alive = isNull(detectedTransactions.deletedAt);

const RESOLVED: CandidateStatus[] = ['confirmed', 'dismissed', 'not_transaction', 'settled'];

/* -------------------------------------------------------------------------- */
/* Ingest                                                                       */
/* -------------------------------------------------------------------------- */

export type RawCapture = {
  source: CaptureSourceColumn;
  packageName: string | null;
  sender: string | null;
  title: string | null;
  body: string;
  postedAt: number;
  receivedAt: number;
};

/** A capture with the pure work already done, so the transaction only writes. */
export type PreparedCapture = RawCapture & {
  contentHash: string;
  detection: Detection;
  suggestion: Suggestion;
};

export type IngestOutcome = {
  candidateId: string;
  /** new: added. duplicate: added under the alert it repeats. seen: already stored. */
  status: 'new' | 'duplicate' | 'seen';
};

function findPrimary(item: PreparedCapture, tx: DbLike): string | null {
  const { detection } = item;
  if (detection.amountMinor === null || detection.direction === null) return null;

  const window = between(
    capturedMessages.postedAt,
    item.postedAt - DUPLICATE_WINDOW_MS,
    item.postedAt + DUPLICATE_WINDOW_MS,
  );

  const rows = tx
    .select({
      id: detectedTransactions.id,
      direction: detectedTransactions.direction,
      amountMinor: detectedTransactions.amountMinor,
      reference: detectedTransactions.reference,
      instrumentTail: detectedTransactions.instrumentTail,
      postedAt: capturedMessages.postedAt,
      packageName: capturedMessages.packageName,
      body: capturedMessages.body,
    })
    .from(detectedTransactions)
    .innerJoin(capturedMessages, eq(capturedMessages.id, detectedTransactions.messageId))
    .where(
      and(
        alive,
        ne(detectedTransactions.status, 'duplicate'),
        eq(detectedTransactions.amountMinor, detection.amountMinor),
        eq(detectedTransactions.direction, detection.direction),
        detection.reference === null ? window : or(eq(detectedTransactions.reference, detection.reference), window),
      ),
    )
    .orderBy(asc(capturedMessages.postedAt))
    .limit(20)
    .all();

  const facts = {
    direction: detection.direction,
    amountMinor: detection.amountMinor,
    reference: detection.reference,
    instrumentTail: detection.instrumentTail,
    postedAt: item.postedAt,
    packageName: item.packageName,
    bodyKey: bodyKeyOf(item.body),
  };

  const match = rows.find((row) =>
    sameTransaction(facts, {
      direction: row.direction,
      amountMinor: row.amountMinor,
      reference: row.reference,
      instrumentTail: row.instrumentTail,
      postedAt: row.postedAt,
      packageName: row.packageName,
      bodyKey: bodyKeyOf(row.body),
    }),
  );
  return match?.id ?? null;
}

function ingestOne(item: PreparedCapture, parserVersion: number, tx: DbLike): IngestOutcome {
  const seen = tx
    .select({ id: detectedTransactions.id })
    .from(capturedMessages)
    .innerJoin(detectedTransactions, eq(detectedTransactions.messageId, capturedMessages.id))
    .where(eq(capturedMessages.contentHash, item.contentHash))
    .get();
  if (seen !== undefined) return { candidateId: seen.id, status: 'seen' };

  const { detection, suggestion } = item;
  const now = Date.now();
  const messageId = newId();

  tx.insert(capturedMessages)
    .values({
      id: messageId,
      source: item.source,
      packageName: item.packageName,
      sender: item.sender,
      title: item.title,
      body: detection.kind === 'otp' ? redactCodes(item.body) : item.body,
      postedAt: item.postedAt,
      receivedAt: item.receivedAt,
      contentHash: item.contentHash,
      createdAt: now,
    })
    .run();

  const primary = findPrimary(item, tx);
  const id = newId();

  tx.insert(detectedTransactions)
    .values({
      id,
      messageId,
      kind: detection.kind,
      direction: detection.direction,
      amountMinor: detection.amountMinor,
      currency: detection.currency,
      amountCandidates: JSON.stringify(detection.amountCandidates),
      occurredAt: detection.occurredAt,
      dateConfidence: detection.dateConfidence,
      counterparty: detection.counterparty,
      item: detection.item,
      instrumentType: detection.instrumentType,
      instrumentTail: detection.instrumentTail,
      issuer: detection.issuer,
      reference: detection.reference,
      channel: detection.channel,
      confidence: detection.confidence,
      reasons: JSON.stringify(detection.reasons),
      suggestedCategoryId: suggestion.categoryId,
      suggestedAccountId: suggestion.accountId,
      suggestedRuleId: suggestion.ruleId,
      status: primary === null ? 'pending' : 'duplicate',
      duplicateOf: primary,
      parserVersion,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return { candidateId: id, status: primary === null ? 'new' : 'duplicate' };
}

/**
 * Stores a batch of captures. Idempotent: a message already stored comes back
 * as `seen` with its existing candidate, which is what lets the native queue be
 * acknowledged only after this commits and simply replayed if it did not.
 */
export function ingestCaptures(
  items: readonly PreparedCapture[],
  parserVersion: number,
  database: DbLike = db,
): IngestOutcome[] {
  return writeTransaction((tx) => items.map((item) => ingestOne(item, parserVersion, tx)), database);
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                        */
/* -------------------------------------------------------------------------- */

export type CandidateCategory = { id: string; name: string; icon: string; colorToken: string };
export type CandidateAccount = { id: string; name: string; colorToken: string; last4: string | null };

export type CandidateSummary = {
  id: string;
  kind: DetectedTransactionRow['kind'];
  direction: 'debit' | 'credit' | null;
  amountMinor: Minor | null;
  currency: string | null;
  occurredAt: number;
  item: string;
  counterparty: string | null;
  confidence: DetectedTransactionRow['confidence'];
  status: CandidateStatus;
  instrumentType: string | null;
  instrumentTail: string | null;
  issuer: string | null;
  channel: string | null;
  source: CaptureSourceColumn;
  packageName: string | null;
  sender: string | null;
  category: CandidateCategory | null;
  account: CandidateAccount | null;
  /** Where else the same payment was announced — the UPI app, the bank's app. */
  alsoSeenIn: { source: CaptureSourceColumn; packageName: string | null }[];
};

const summarySelection = {
  candidate: detectedTransactions,
  source: capturedMessages.source,
  packageName: capturedMessages.packageName,
  sender: capturedMessages.sender,
  category: {
    id: categories.id,
    name: categories.name,
    icon: categories.icon,
    colorToken: categories.colorToken,
  },
  account: {
    id: accounts.id,
    name: accounts.name,
    colorToken: accounts.colorToken,
    last4: accounts.last4,
  },
};

type SummaryRow = {
  candidate: DetectedTransactionRow;
  source: CaptureSourceColumn;
  packageName: string | null;
  sender: string | null;
  category: CandidateCategory | null;
  account: CandidateAccount | null;
};

const toSummary = (
  row: SummaryRow,
  alsoSeenIn: CandidateSummary['alsoSeenIn'] = [],
): CandidateSummary => ({
  id: row.candidate.id,
  kind: row.candidate.kind,
  direction: row.candidate.direction,
  amountMinor: row.candidate.amountMinor,
  currency: row.candidate.currency,
  occurredAt: row.candidate.occurredAt,
  item: row.candidate.item,
  counterparty: row.candidate.counterparty,
  confidence: row.candidate.confidence,
  status: row.candidate.status,
  instrumentType: row.candidate.instrumentType,
  instrumentTail: row.candidate.instrumentTail,
  issuer: row.candidate.issuer,
  channel: row.candidate.channel,
  source: row.source,
  packageName: row.packageName,
  sender: row.sender,
  category: row.category?.id == null ? null : row.category,
  account: row.account?.id == null ? null : row.account,
  alsoSeenIn,
});

const summaryQuery = (database: DbLike) =>
  database
    .select(summarySelection)
    .from(detectedTransactions)
    .innerJoin(capturedMessages, eq(capturedMessages.id, detectedTransactions.messageId))
    .leftJoin(categories, eq(categories.id, detectedTransactions.suggestedCategoryId))
    .leftJoin(accounts, eq(accounts.id, detectedTransactions.suggestedAccountId));

function duplicatesOf(ids: readonly string[], database: DbLike) {
  if (ids.length === 0) return new Map<string, CandidateSummary['alsoSeenIn']>();
  const rows = database
    .select({
      primary: detectedTransactions.duplicateOf,
      source: capturedMessages.source,
      packageName: capturedMessages.packageName,
    })
    .from(detectedTransactions)
    .innerJoin(capturedMessages, eq(capturedMessages.id, detectedTransactions.messageId))
    .where(and(alive, eq(detectedTransactions.status, 'duplicate'), inArray(detectedTransactions.duplicateOf, [...ids])))
    .all();

  const byPrimary = new Map<string, CandidateSummary['alsoSeenIn']>();
  for (const row of rows) {
    if (row.primary === null) continue;
    const list = byPrimary.get(row.primary) ?? [];
    list.push({ source: row.source, packageName: row.packageName });
    byPrimary.set(row.primary, list);
  }
  return byPrimary;
}

/** Everything waiting for a decision, newest first. The screen sorts it into sections. */
export function listPendingCandidates(limit: number, database: DbLike = db): CandidateSummary[] {
  const rows = summaryQuery(database)
    .where(and(alive, eq(detectedTransactions.status, 'pending')))
    .orderBy(desc(detectedTransactions.occurredAt), desc(detectedTransactions.createdAt))
    .limit(limit)
    .all() as SummaryRow[];

  const seen = duplicatesOf(
    rows.map((row) => row.candidate.id),
    database,
  );
  return rows.map((row) => toSummary(row, seen.get(row.candidate.id)));
}

/**
 * The badge: pending candidates that might be spending. Mirrors `sectionOf`'s
 * Needs review and Maybe — not credits, not refunds, nothing filtered.
 */
export const countCandidatesToReview = (database: DbLike = db): number =>
  database
    .select({ n: count() })
    .from(detectedTransactions)
    .where(
      and(
        alive,
        eq(detectedTransactions.status, 'pending'),
        inArray(detectedTransactions.kind, ['transaction', 'unknown']),
        or(isNull(detectedTransactions.direction), eq(detectedTransactions.direction, 'debit')),
      ),
    )
    .get()?.n ?? 0;

export type CandidateDetail = CandidateSummary & {
  body: string;
  title: string | null;
  receivedAt: number;
  postedAt: number;
  reasons: string[];
  amountCandidates: Minor[];
  dateConfidence: string;
  reference: string | null;
  suggestedRuleId: string | null;
  expenseId: string | null;
  settlementId: string | null;
  duplicateOf: string | null;
  /** What a confirmed expense will keep in `source_text`. */
  sourceText: string;
  duplicates: { id: string; source: CaptureSourceColumn; packageName: string | null; body: string }[];
  /** Expenses already typed in that this alert may be. */
  linkable: { id: string; item: string; amountMinor: Minor; occurredAt: number }[];
  /** For a reversal: the payment it undoes, when that was detected too. */
  reversalOf: { candidateId: string; expenseId: string | null; item: string } | null;
};

const parseMinorList = (json: string): Minor[] => {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value)
      ? value.filter((entry): entry is number => Number.isInteger(entry) && entry > 0).map(asMinor)
      : [];
  } catch {
    return [];
  }
};

const parseStringList = (json: string): string[] => {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
};

export function getCandidateDetail(id: string, database: DbLike = db): CandidateDetail | null {
  const row = summaryQuery(database)
    .where(and(alive, eq(detectedTransactions.id, id)))
    .get() as SummaryRow | undefined;
  if (row === undefined) return null;

  const message = database
    .select()
    .from(capturedMessages)
    .where(eq(capturedMessages.id, row.candidate.messageId))
    .get();
  if (message === undefined) return null;

  const duplicates = database
    .select({
      id: detectedTransactions.id,
      source: capturedMessages.source,
      packageName: capturedMessages.packageName,
      body: capturedMessages.body,
    })
    .from(detectedTransactions)
    .innerJoin(capturedMessages, eq(capturedMessages.id, detectedTransactions.messageId))
    .where(and(alive, eq(detectedTransactions.duplicateOf, id), eq(detectedTransactions.status, 'duplicate')))
    .all();

  const candidate = row.candidate;

  const linkable =
    candidate.direction === 'debit' && candidate.amountMinor !== null && candidate.status === 'pending'
      ? listLinkableExpenses(candidate.amountMinor, candidate.occurredAt, database)
          .filter((expense) =>
            looksLikeManual(
              {
                amountMinor: candidate.amountMinor,
                occurredAt: candidate.occurredAt,
                accountId: candidate.suggestedAccountId,
              },
              expense,
            ),
          )
          .map(({ id: expenseId, item, amountMinor, occurredAt }) => ({ id: expenseId, item, amountMinor, occurredAt }))
      : [];

  let reversalOf: CandidateDetail['reversalOf'] = null;
  if (candidate.direction === 'credit' && candidate.reference !== null) {
    const original = database
      .select({
        id: detectedTransactions.id,
        expenseId: detectedTransactions.expenseId,
        item: detectedTransactions.item,
      })
      .from(detectedTransactions)
      .where(
        and(
          alive,
          eq(detectedTransactions.reference, candidate.reference),
          eq(detectedTransactions.direction, 'debit'),
        ),
      )
      .orderBy(desc(detectedTransactions.expenseId))
      .get();
    if (original !== undefined) {
      reversalOf = { candidateId: original.id, expenseId: original.expenseId, item: original.item };
    }
  }

  return {
    ...toSummary(
      row,
      duplicates.map((duplicate) => ({ source: duplicate.source, packageName: duplicate.packageName })),
    ),
    body: message.body,
    title: message.title,
    receivedAt: message.receivedAt,
    postedAt: message.postedAt,
    reasons: parseStringList(candidate.reasons),
    amountCandidates: parseMinorList(candidate.amountCandidates),
    dateConfidence: candidate.dateConfidence,
    reference: candidate.reference,
    suggestedRuleId: candidate.suggestedRuleId,
    expenseId: candidate.expenseId,
    settlementId: candidate.settlementId,
    duplicateOf: candidate.duplicateOf,
    sourceText: sourceTextOf(message),
    duplicates,
    linkable,
    reversalOf,
  };
}

/** How much is stored, for the settings screen. */
export function captureStats(database: DbLike = db): { messages: number; pending: number } {
  const messages = database.select({ n: count() }).from(capturedMessages).get()?.n ?? 0;
  const pending =
    database
      .select({ n: count() })
      .from(detectedTransactions)
      .where(and(alive, eq(detectedTransactions.status, 'pending')))
      .get()?.n ?? 0;
  return { messages, pending };
}

/* -------------------------------------------------------------------------- */
/* Decisions                                                                    */
/* -------------------------------------------------------------------------- */

function requireCandidate(id: string, tx: DbLike, statuses: CandidateStatus[] = ['pending']): DetectedTransactionRow {
  const row = tx.select().from(detectedTransactions).where(and(alive, eq(detectedTransactions.id, id))).get();
  if (row === undefined) throw new NotFoundError('Detected transaction', id);
  if (!statuses.includes(row.status)) {
    throw new ValidationError('status', 'This one has already been dealt with.');
  }
  return row;
}

function messageOf(row: DetectedTransactionRow, tx: DbLike) {
  const message = tx.select().from(capturedMessages).where(eq(capturedMessages.id, row.messageId)).get();
  if (message === undefined) throw new NotFoundError('Captured message', row.messageId);
  return message;
}

export type ConfirmInput = {
  /** The expense as the user left the form. Where it came from is filled in here. */
  expense: Omit<ExpenseInput, 'source' | 'sourceText'>;
  /** Write the detected card or account tail onto the chosen account. */
  rememberAccount: boolean;
  /** Save a rule filing this payee under this category from now on. */
  rememberCategoryId: string | null;
  /** The rule whose suggestion survived to the save, to count its use. */
  appliedRuleId: string | null;
};

/** Turns a candidate into an expense. Returns the new expense's id. */
export function confirmCandidate(id: string, input: ConfirmInput, database: DbLike = db): string {
  return writeTransaction((tx) => {
    const row = requireCandidate(id, tx);
    const message = messageOf(row, tx);
    const now = Date.now();

    const expenseId = createExpense(
      { ...input.expense, source: 'detected', sourceText: sourceTextOf(message) },
      tx,
    );

    tx.update(detectedTransactions)
      .set({ status: 'confirmed', expenseId, resolvedAt: now, updatedAt: now })
      .where(eq(detectedTransactions.id, id))
      .run();

    if (input.rememberAccount && input.expense.accountId != null && row.instrumentTail !== null) {
      rememberAccountTail(input.expense.accountId, row.instrumentTail, row.issuer, tx);
    }

    /* Only for a real payee: a rule on "UPI payment" would claim every alert
       that named nobody. */
    const label = row.counterparty === null ? null : labelOf(row.counterparty);
    if (input.rememberCategoryId !== null && label !== null) {
      createRule(
        {
          name: label,
          priority: 0,
          isEnabled: true,
          matchMode: 'all',
          conditions: [{ field: 'item', operator: 'contains', value: label.toLowerCase() }],
          actions: [{ type: 'set_category', categoryId: input.rememberCategoryId }],
        },
        tx,
      );
    }

    if (input.appliedRuleId !== null) recordRuleApplied(input.appliedRuleId, tx);

    return expenseId;
  }, database);
}

/**
 * The alert is an expense the user already typed in. It resolves the candidate
 * and keeps the alert on that expense, without creating a second one.
 */
export function linkCandidateToExpense(id: string, expenseId: string, database: DbLike = db): void {
  writeTransaction((tx) => {
    const row = requireCandidate(id, tx);
    const message = messageOf(row, tx);
    const now = Date.now();
    attachSourceText(expenseId, sourceTextOf(message), tx);
    tx.update(detectedTransactions)
      .set({ status: 'confirmed', expenseId, resolvedAt: now, updatedAt: now })
      .where(eq(detectedTransactions.id, id))
      .run();
  }, database);
}

/** Money in, recorded as money back against an expense (D1). */
export function settleCandidate(id: string, expenseId: string, database: DbLike = db): string {
  return writeTransaction((tx) => {
    const row = requireCandidate(id, tx);
    if (row.direction !== 'credit' || row.amountMinor === null) {
      throw new ValidationError('amount', 'Only money received can be settled against an expense.');
    }
    const settlementId = addSettlement(
      {
        expenseId,
        amountMinor: row.amountMinor,
        settledAt: row.occurredAt,
        accountId: row.suggestedAccountId,
        note: row.kind === 'refund' ? row.item : `From ${row.item}`,
      },
      tx,
    );
    const now = Date.now();
    tx.update(detectedTransactions)
      .set({ status: 'settled', settlementId, resolvedAt: now, updatedAt: now })
      .where(eq(detectedTransactions.id, id))
      .run();
    return settlementId;
  }, database);
}

/** Dismissed, or "not a transaction". Both undoable with `restoreCandidate`. */
export function resolveCandidate(
  id: string,
  status: 'dismissed' | 'not_transaction',
  database: DbLike = db,
): void {
  writeTransaction((tx) => {
    requireCandidate(id, tx);
    const now = Date.now();
    tx.update(detectedTransactions)
      .set({ status, resolvedAt: now, updatedAt: now })
      .where(eq(detectedTransactions.id, id))
      .run();
  }, database);
}

/**
 * The undo behind a one-tap confirm: the expense it created goes (softly, like
 * any deleted expense) and the candidate goes back to waiting.
 */
export function undoConfirm(id: string, database: DbLike = db): void {
  writeTransaction((tx) => {
    const row = requireCandidate(id, tx, ['confirmed']);
    if (row.expenseId !== null) softDeleteExpense(row.expenseId, tx);
    tx.update(detectedTransactions)
      .set({ status: 'pending', expenseId: null, resolvedAt: null, updatedAt: Date.now() })
      .where(eq(detectedTransactions.id, id))
      .run();
  }, database);
}

/** The undo behind the swipe. */
export function restoreCandidate(id: string, database: DbLike = db): void {
  writeTransaction((tx) => {
    requireCandidate(id, tx, ['dismissed', 'not_transaction']);
    tx.update(detectedTransactions)
      .set({ status: 'pending', resolvedAt: null, isEdited: true, updatedAt: Date.now() })
      .where(eq(detectedTransactions.id, id))
      .run();
  }, database);
}

/** "These are two different payments" — the duplicate becomes its own candidate. */
export function separateDuplicate(id: string, database: DbLike = db): void {
  writeTransaction((tx) => {
    requireCandidate(id, tx, ['duplicate']);
    tx.update(detectedTransactions)
      .set({ status: 'pending', duplicateOf: null, isEdited: true, updatedAt: Date.now() })
      .where(eq(detectedTransactions.id, id))
      .run();
  }, database);
}

/** Confirms a batch as it was read, all or nothing. Returns how many. */
export function confirmCandidates(
  candidates: readonly { id: string; input: ConfirmInput }[],
  database: DbLike = db,
): number {
  return writeTransaction((tx) => {
    for (const candidate of candidates) confirmCandidate(candidate.id, candidate.input, tx);
    return candidates.length;
  }, database);
}

/* -------------------------------------------------------------------------- */
/* Re-reading after a parser upgrade                                            */
/* -------------------------------------------------------------------------- */

export type ReparseTarget = RawCapture & { id: string };

/** Pending candidates read by an older parser that nobody has touched. */
export function listReparseTargets(
  belowVersion: number,
  limit: number,
  database: DbLike = db,
): ReparseTarget[] {
  return database
    .select({
      id: detectedTransactions.id,
      source: capturedMessages.source,
      packageName: capturedMessages.packageName,
      sender: capturedMessages.sender,
      title: capturedMessages.title,
      body: capturedMessages.body,
      postedAt: capturedMessages.postedAt,
      receivedAt: capturedMessages.receivedAt,
    })
    .from(detectedTransactions)
    .innerJoin(capturedMessages, eq(capturedMessages.id, detectedTransactions.messageId))
    .where(
      and(
        alive,
        eq(detectedTransactions.status, 'pending'),
        eq(detectedTransactions.isEdited, false),
        lt(detectedTransactions.parserVersion, belowVersion),
      ),
    )
    .limit(limit)
    .all();
}

export function applyReparse(
  updates: readonly { id: string; detection: Detection; suggestion: Suggestion }[],
  parserVersion: number,
  database: DbLike = db,
): void {
  writeTransaction((tx) => {
    const now = Date.now();
    for (const { id, detection, suggestion } of updates) {
      tx.update(detectedTransactions)
        .set({
          kind: detection.kind,
          direction: detection.direction,
          amountMinor: detection.amountMinor,
          currency: detection.currency,
          amountCandidates: JSON.stringify(detection.amountCandidates),
          occurredAt: detection.occurredAt,
          dateConfidence: detection.dateConfidence,
          counterparty: detection.counterparty,
          item: detection.item,
          instrumentType: detection.instrumentType,
          instrumentTail: detection.instrumentTail,
          issuer: detection.issuer,
          reference: detection.reference,
          channel: detection.channel,
          confidence: detection.confidence,
          reasons: JSON.stringify(detection.reasons),
          suggestedCategoryId: suggestion.categoryId,
          suggestedAccountId: suggestion.accountId,
          suggestedRuleId: suggestion.ruleId,
          parserVersion,
          updatedAt: now,
        })
        .where(and(eq(detectedTransactions.id, id), eq(detectedTransactions.status, 'pending')))
        .run();
    }
  }, database);
}

/* -------------------------------------------------------------------------- */
/* Retention                                                                    */
/* -------------------------------------------------------------------------- */

const messageIdsWhere = (where: ReturnType<typeof and>, database: DbLike): string[] =>
  database
    .select({ id: detectedTransactions.messageId })
    .from(detectedTransactions)
    .where(where)
    .all()
    .map((row) => row.id);

/**
 * Removes message text the user no longer needs, for real (see the schema).
 *
 * - anything decided more than `cutoffMs` ago — a confirmed expense has its
 *   own copy in `source_text`;
 * - offers, OTPs, reminders, statements, failures and balance alerts older than
 *   that, decided or not: nothing in them is money that moved;
 * - duplicates whose alert has gone.
 *
 * Pending payments, transfers and credits are never removed by age. Returns how
 * many messages went.
 */
export function purgeCaptures(cutoffMs: number, database: DbLike = db): number {
  return writeTransaction((tx) => {
    const doomed = new Set<string>([
      ...messageIdsWhere(
        and(inArray(detectedTransactions.status, RESOLVED), lt(detectedTransactions.resolvedAt, cutoffMs)),
        tx,
      ),
      ...messageIdsWhere(
        and(
          eq(detectedTransactions.status, 'pending'),
          inArray(detectedTransactions.kind, [...EPHEMERAL_KINDS]),
          lt(detectedTransactions.createdAt, cutoffMs),
        ),
        tx,
      ),
      ...messageIdsWhere(
        and(
          eq(detectedTransactions.status, 'duplicate'),
          or(
            isNull(detectedTransactions.duplicateOf),
            sql`${detectedTransactions.duplicateOf} in (select id from detected_transactions where status in ('confirmed','dismissed','not_transaction','settled') and resolved_at < ${cutoffMs})`,
          ),
        ),
        tx,
      ),
    ]);

    const ids = [...doomed];
    for (let index = 0; index < ids.length; index += 500) {
      tx.delete(capturedMessages).where(inArray(capturedMessages.id, ids.slice(index, index + 500))).run();
    }
    return ids.length;
  }, database);
}

/** Everything the inbox holds, gone. Confirmed expenses keep their own copy. */
export function clearCaptures(database: DbLike = db): void {
  writeTransaction((tx) => {
    tx.delete(detectedTransactions).run();
    tx.delete(capturedMessages).run();
  }, database);
}
