/**
 * What a detection report says about how detection has been going (D19), as
 * counts — never as values.
 *
 * The rows this reads carry amounts, dates, payees and expense items, because
 * the only way to know a misread happened is to compare what Finly read with
 * what the user confirmed. Every one of those comparisons is reduced to a yes
 * or no here, and only the counts leave this module. The report cannot leak a
 * value it never holds.
 */

import { dayKey } from '@/domain/period';
import { appHint, isSmsApp, senderHeader } from '@/domain/txn-detect/sources';

/** One detected candidate, joined to the expense it became, if any. */
export type DetectionFact = {
  kind: string;
  direction: string | null;
  confidence: string;
  status: string;
  /** JSON array, as stored. */
  reasons: string;
  parserVersion: number;
  dateConfidence: string;
  source: string;
  packageName: string | null;
  sender: string | null;
  title: string | null;
  issuer: string | null;
  createdAt: number;
  detectedAmount: number | null;
  detectedAt: number;
  detectedItem: string;
  suggestedCategoryId: string | null;
  suggestedAccountId: string | null;
  expenseSource: string | null;
  expenseAmount: number | null;
  expenseAt: number | null;
  expenseItem: string | null;
  expenseCategoryId: string | null;
  expenseAccountId: string | null;
};

export type SenderRow = {
  key: string;
  total: number;
  unknown: number;
  low: number;
  noPayee: number;
  ambiguousAmount: number;
  fallbackDate: number;
  notPayment: number;
  amountChanged: number;
};

export type DetectionSummary = {
  stored: number;
  /** Age of the oldest stored row, in whole days. Older rows went with retention. */
  oldestDays: number | null;
  byKind: Record<string, number>;
  byStatus: Record<string, number>;
  byConfidence: Record<string, number>;
  reasons: [string, number][];
  corrections: {
    confirmedAsRead: number;
    amountChanged: number;
    dayChanged: number;
    itemChanged: number;
    categoryChanged: number;
    accountChanged: number;
    linkedToTyped: number;
    rescuedFromFiltered: number;
    markedNotPayment: number;
    duplicates: number;
  };
  senders: SenderRow[];
  /** Pending rows still read by an older reader — a stuck re-read shows here. */
  readByOlderReader: number;
};

const FILTERED = new Set(['transfer', 'failed', 'upcoming', 'statement', 'otp', 'balance', 'promo', 'reminder']);
const MS_PER_DAY = 86_400_000;
const TOP_SENDERS = 15;

/**
 * Who a row came from, in words that identify a bank or an app and never a
 * person: the DLT header, then the issuer, then the app. A notification title
 * can be a contact's name, so it is only ever used through `senderHeader`,
 * which accepts nothing but a sender id.
 */
export function senderKeyOf(fact: Pick<DetectionFact, 'sender' | 'title' | 'issuer' | 'packageName' | 'source'>): string {
  const header = senderHeader(fact.sender) ?? senderHeader(fact.title);
  if (header !== null) return header;
  if (fact.issuer !== null) return fact.issuer;
  if (fact.packageName !== null) {
    if (isSmsApp(fact.packageName)) return 'SMS, no sender id';
    return appHint(fact.packageName)?.name ?? fact.packageName;
  }
  if (fact.source === 'paste') return 'Pasted';
  if (fact.source === 'share') return 'Shared';
  return 'Other';
}

/** `template:<id>` and `template:mute:<id>` carry an id that means nothing outside this phone. */
export function normaliseReason(reason: string): string {
  if (reason.startsWith('template:mute:')) return 'template:mute';
  if (reason.startsWith('template:')) return 'template';
  return reason;
}

const parseReasons = (json: string): string[] => {
  try {
    const value: unknown = JSON.parse(json);
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
  } catch {
    return [];
  }
};

const bump = (counts: Record<string, number>, key: string) => {
  counts[key] = (counts[key] ?? 0) + 1;
};

const sameText = (a: string | null, b: string | null) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

export function summariseDetections(
  facts: readonly DetectionFact[],
  options: { parserVersion: number; now?: number },
): DetectionSummary {
  const now = options.now ?? Date.now();
  const byKind: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byConfidence: Record<string, number> = {};
  const reasonCounts: Record<string, number> = {};
  const senders = new Map<string, SenderRow>();
  const corrections: DetectionSummary['corrections'] = {
    confirmedAsRead: 0,
    amountChanged: 0,
    dayChanged: 0,
    itemChanged: 0,
    categoryChanged: 0,
    accountChanged: 0,
    linkedToTyped: 0,
    rescuedFromFiltered: 0,
    markedNotPayment: 0,
    duplicates: 0,
  };
  let oldest: number | null = null;
  let readByOlderReader = 0;

  for (const fact of facts) {
    bump(byKind, fact.kind);
    bump(byStatus, fact.status);
    bump(byConfidence, fact.confidence);
    oldest = oldest === null ? fact.createdAt : Math.min(oldest, fact.createdAt);
    if (fact.status === 'pending' && fact.parserVersion < options.parserVersion) readByOlderReader += 1;

    const reasons = parseReasons(fact.reasons).map(normaliseReason);
    for (const reason of new Set(reasons)) bump(reasonCounts, reason);

    const key = senderKeyOf(fact);
    const row = senders.get(key) ?? {
      key,
      total: 0,
      unknown: 0,
      low: 0,
      noPayee: 0,
      ambiguousAmount: 0,
      fallbackDate: 0,
      notPayment: 0,
      amountChanged: 0,
    };
    row.total += 1;
    if (fact.kind === 'unknown') row.unknown += 1;
    if (fact.confidence === 'low') row.low += 1;
    if (reasons.includes('counterparty:none')) row.noPayee += 1;
    if (reasons.includes('amount:ambiguous')) row.ambiguousAmount += 1;
    if (fact.dateConfidence === 'fallback_received') row.fallbackDate += 1;
    if (fact.status === 'not_transaction') {
      row.notPayment += 1;
      corrections.markedNotPayment += 1;
    }
    if (fact.status === 'duplicate') corrections.duplicates += 1;
    if ((fact.status === 'confirmed' || fact.status === 'settled') && FILTERED.has(fact.kind)) {
      corrections.rescuedFromFiltered += 1;
    }

    if (fact.status === 'confirmed' && fact.expenseSource === 'manual') corrections.linkedToTyped += 1;
    if (fact.status === 'confirmed' && fact.expenseSource === 'detected') {
      const amountChanged = fact.expenseAmount !== fact.detectedAmount;
      const dayChanged = fact.expenseAt !== null && dayKey(fact.expenseAt) !== dayKey(fact.detectedAt);
      const itemChanged = !sameText(fact.expenseItem, fact.detectedItem);
      const categoryChanged = fact.expenseCategoryId !== fact.suggestedCategoryId;
      const accountChanged = fact.expenseAccountId !== fact.suggestedAccountId;
      if (amountChanged) {
        corrections.amountChanged += 1;
        row.amountChanged += 1;
      }
      if (dayChanged) corrections.dayChanged += 1;
      if (itemChanged) corrections.itemChanged += 1;
      if (categoryChanged) corrections.categoryChanged += 1;
      if (accountChanged) corrections.accountChanged += 1;
      if (!amountChanged && !dayChanged && !itemChanged && !categoryChanged && !accountChanged) {
        corrections.confirmedAsRead += 1;
      }
    }
    senders.set(key, row);
  }

  return {
    stored: facts.length,
    oldestDays: oldest === null ? null : Math.floor((now - oldest) / MS_PER_DAY),
    byKind,
    byStatus,
    byConfidence,
    reasons: Object.entries(reasonCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    corrections,
    senders: [...senders.values()].sort((a, b) => b.total - a.total || a.key.localeCompare(b.key)).slice(0, TOP_SENDERS),
    readByOlderReader,
  };
}
