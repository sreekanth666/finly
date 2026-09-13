/**
 * What a detection report is built from (D19). SQL only.
 *
 * These reads return values — amounts, items, payees — because telling a
 * misread from a good read means comparing what was detected with what was
 * confirmed. `summariseDetections` in src/domain/support reduces them to
 * counts before anything is shown or sent.
 */

import { and, desc, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';

import type { DetectionFact } from '@/domain/support/diagnostics';
import type { TemplateFact } from '@/domain/support/report';

import { db, type DbLike } from '../client';
import { capturedMessages, captureTemplates, detectedTransactions, expenses } from '../schema';

const alive = isNull(detectedTransactions.deletedAt);

/** Stored candidates, newest first, each with the expense it became. */
export function listDetectionFacts(limit: number, database: DbLike = db): DetectionFact[] {
  return database
    .select({
      kind: detectedTransactions.kind,
      direction: detectedTransactions.direction,
      confidence: detectedTransactions.confidence,
      status: detectedTransactions.status,
      reasons: detectedTransactions.reasons,
      parserVersion: detectedTransactions.parserVersion,
      dateConfidence: detectedTransactions.dateConfidence,
      source: capturedMessages.source,
      packageName: capturedMessages.packageName,
      sender: capturedMessages.sender,
      title: capturedMessages.title,
      issuer: detectedTransactions.issuer,
      createdAt: detectedTransactions.createdAt,
      detectedAmount: detectedTransactions.amountMinor,
      detectedAt: detectedTransactions.occurredAt,
      detectedItem: detectedTransactions.item,
      suggestedCategoryId: detectedTransactions.suggestedCategoryId,
      suggestedAccountId: detectedTransactions.suggestedAccountId,
      expenseSource: expenses.source,
      expenseAmount: expenses.amountMinor,
      expenseAt: expenses.occurredAt,
      expenseItem: expenses.item,
      expenseCategoryId: expenses.categoryId,
      expenseAccountId: expenses.accountId,
    })
    .from(detectedTransactions)
    .innerJoin(capturedMessages, eq(capturedMessages.id, detectedTransactions.messageId))
    .leftJoin(expenses, and(eq(expenses.id, detectedTransactions.expenseId), isNull(expenses.deletedAt)))
    .where(alive)
    .orderBy(desc(detectedTransactions.createdAt))
    .limit(limit)
    .all();
}

/** Taught formats, without their names, segments or samples. */
export function listTemplateFacts(database: DbLike = db): TemplateFact[] {
  return database
    .select({
      senderKey: captureTemplates.senderKey,
      packageName: captureTemplates.packageName,
      issuer: captureTemplates.issuer,
      outcome: captureTemplates.outcome,
      direction: captureTemplates.direction,
      overridesGate: captureTemplates.overridesGate,
      timesMatched: captureTemplates.timesMatched,
      isEnabled: captureTemplates.isEnabled,
    })
    .from(captureTemplates)
    .where(isNull(captureTemplates.deletedAt))
    .all();
}

export type ProblemMessage = {
  body: string;
  sender: string | null;
  title: string | null;
  packageName: string | null;
  source: string;
  issuer: string | null;
  kind: string;
  confidence: string;
  reasons: string;
};

/**
 * Messages Finly had trouble with: unread, unsure, marked not a payment,
 * rescued from Filtered, or confirmed with a different amount. Only read when
 * the user asks to include message shapes, and then only turned into
 * skeletons — never sent as they are.
 */
export function listProblemMessages(limit: number, database: DbLike = db): ProblemMessage[] {
  return database
    .select({
      body: capturedMessages.body,
      sender: capturedMessages.sender,
      title: capturedMessages.title,
      packageName: capturedMessages.packageName,
      source: capturedMessages.source,
      issuer: detectedTransactions.issuer,
      kind: detectedTransactions.kind,
      confidence: detectedTransactions.confidence,
      reasons: detectedTransactions.reasons,
    })
    .from(detectedTransactions)
    .innerJoin(capturedMessages, eq(capturedMessages.id, detectedTransactions.messageId))
    .leftJoin(expenses, and(eq(expenses.id, detectedTransactions.expenseId), isNull(expenses.deletedAt)))
    .where(
      and(
        alive,
        ne(detectedTransactions.kind, 'otp'),
        or(
          eq(detectedTransactions.kind, 'unknown'),
          eq(detectedTransactions.confidence, 'low'),
          eq(detectedTransactions.status, 'not_transaction'),
          and(
            inArray(detectedTransactions.kind, ['transfer', 'failed', 'upcoming', 'statement', 'balance', 'promo', 'reminder']),
            inArray(detectedTransactions.status, ['confirmed', 'settled']),
          ),
          and(
            eq(expenses.source, 'detected'),
            sql`${expenses.amountMinor} is not ${detectedTransactions.amountMinor}`,
          ),
        ),
      ),
    )
    .orderBy(desc(detectedTransactions.createdAt))
    .limit(limit)
    .all();
}
