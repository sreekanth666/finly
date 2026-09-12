/**
 * Matching detections against things the app already has: saved accounts,
 * other detections, and expenses the user typed in by hand.
 */

import type { Minor } from '@/domain/money';
import { dayKey } from '@/domain/period';

import type { Direction, InstrumentType } from './types';

/* -------------------------------------------------------------------------- */
/* Card and account tails                                                       */
/* -------------------------------------------------------------------------- */

const digitsOf = (value: string | null | undefined) => (value ?? '').replace(/\D/g, '');

/**
 * Whether two printed tails can be the same card or account. ICICI prints
 * "XX316" for an account whose last four are 0316 or 1316; Amex prints five.
 * So one must end with the other, and the shorter must still be three digits —
 * two digits would match one account in fifty.
 */
export function tailsMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const left = digitsOf(a);
  const right = digitsOf(b);
  const shorter = left.length <= right.length ? left : right;
  const longer = shorter === left ? right : left;
  return shorter.length >= 3 && longer.endsWith(shorter);
}

export type AccountLike = {
  id: string;
  type: string;
  issuer: string | null;
  last4: string | null;
  isArchived: boolean;
};

const TYPE_FOR: Record<InstrumentType, string> = { card: 'credit_card', account: 'bank', wallet: 'wallet' };

const foldIssuer = (value: string | null | undefined) =>
  (value ?? '').toLowerCase().replace(/\b(?:bank|ltd|limited|sfb|small finance)\b/g, '').replace(/\s+/g, ' ').trim();

/**
 * The one saved account a detected card or account tail belongs to, or null
 * when none does or more than one might. Ambiguity is narrowed by account type,
 * then issuer; a guess between two cards is worse than asking.
 */
export function matchAccount(
  instrument: { type: InstrumentType | null; tail: string | null; issuer: string | null },
  accounts: readonly AccountLike[],
): string | null {
  if (instrument.tail === null) return null;

  let pool = accounts.filter((account) => !account.isArchived && tailsMatch(account.last4, instrument.tail));
  if (pool.length > 1 && instrument.type !== null) {
    const typed = pool.filter((account) => account.type === TYPE_FOR[instrument.type!]);
    if (typed.length > 0) pool = typed;
  }
  if (pool.length > 1 && instrument.issuer !== null) {
    const wanted = foldIssuer(instrument.issuer);
    const byIssuer = pool.filter((account) => {
      const issuer = foldIssuer(account.issuer);
      return issuer.length > 0 && (issuer.includes(wanted) || wanted.includes(issuer));
    });
    if (byIssuer.length > 0) pool = byIssuer;
  }
  return pool.length === 1 ? pool[0].id : null;
}

/* -------------------------------------------------------------------------- */
/* Duplicates                                                                   */
/* -------------------------------------------------------------------------- */

/** Bank SMS and the UPI app's own alert arrive within a minute or two of each other. */
export const DUPLICATE_WINDOW_MS = 10 * 60_000;

export type DuplicateFacts = {
  direction: Direction | null;
  amountMinor: Minor | null;
  reference: string | null;
  instrumentTail: string | null;
  postedAt: number;
  packageName: string | null;
  /** The normalised body, so a re-posted notification is recognised as itself. */
  bodyKey: string;
};

/**
 * Whether two detections describe one payment.
 *
 * A shared reference settles it either way. Without one, the same app never
 * alerts twice for one payment — except by re-posting the identical text — so
 * only alerts from different apps, same amount and direction, compatible tails
 * and close together in time count as the same.
 */
export function sameTransaction(a: DuplicateFacts, b: DuplicateFacts): boolean {
  if (a.amountMinor === null || a.amountMinor !== b.amountMinor) return false;
  if (a.direction !== b.direction) return false;

  if (a.reference !== null && b.reference !== null) return a.reference === b.reference;

  const close = Math.abs(a.postedAt - b.postedAt) <= DUPLICATE_WINDOW_MS;
  if (!close) return false;
  if (a.bodyKey === b.bodyKey) return true;
  if (a.packageName !== null && a.packageName === b.packageName) return false;
  if (a.instrumentTail !== null && b.instrumentTail !== null && !tailsMatch(a.instrumentTail, b.instrumentTail)) {
    return false;
  }
  return true;
}

/**
 * Whether a detected payment is probably one the user already typed in: the
 * same amount on the same local day, from the same account or an unknown one.
 * Only ever an offer to link, never an automatic merge.
 */
export function looksLikeManual(
  candidate: { amountMinor: Minor | null; occurredAt: number; accountId: string | null },
  expense: { amountMinor: Minor; occurredAt: number; accountId: string | null },
): boolean {
  if (candidate.amountMinor === null || candidate.amountMinor !== expense.amountMinor) return false;
  if (dayKey(candidate.occurredAt) !== dayKey(expense.occurredAt)) return false;
  return candidate.accountId === null || expense.accountId === null || candidate.accountId === expense.accountId;
}
