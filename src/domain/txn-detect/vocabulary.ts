/**
 * The words that say money moved, and which way.
 *
 * Shared by the amount scorer (an amount beside one of these is the amount) and
 * the direction reader (the first of these decides the direction). Past tense
 * only: "will be debited" is a promise, not a payment, and the classifier has
 * already set those aside by the time these are consulted.
 *
 * "debit card", "credit card" and "credit limit" are names, not verbs, and are
 * excluded where they would otherwise read as one.
 */

import type { Direction } from './types';

export const DEBIT_VERBS: readonly RegExp[] = [
  /\bdebited\b/i,
  /\bdebit\b(?!\s*card)/i,
  /\bspent\b/i,
  /\bpaid\b/i,
  /\bsent\b/i,
  /\bwithdrawn\b/i,
  /\bdeducted\b/i,
  /\bcharged\b/i,
  /\bpurchase\b/i,
  /\bused\s+(?:for|at)\b/i,
  /\b(?:txn|transaction)\s+of\b/i,
  /\btrf\s+to\b/i,
  /\btransferred\s+(?:from|to)\b(?!\s+(?:your|ur)\b)/i,
  /\bpayment\s+(?:of|to|made)\b/i,
  /* Bank of Baroda: "Rs.3000.00 Dr. from A/C …". Only before an account or a
     UPI id, so "Dr. Sharma" stays a name. */
  /\bDr\.?\s+(?:from|to)\s+(?:your\s+)?(?:a\/c|ac\b|acct|account|card|vpa\b|[\w.-]+@)/i,
];

export const CREDIT_VERBS: readonly RegExp[] = [
  /\bcredited\b/i,
  /\bcredit\b(?!\s*(?:card|limit|score|line|facility))/i,
  /\breceived\b/i,
  /\bdeposited\b/i,
  /\brefunded\b/i,
  /\breversed\b/i,
  /\breversal\b/i,
  /\badded\s+to\b/i,
  /\btransferred\s+to\s+(?:your|ur)\b/i,
  /* "… Cr. to 98765@ptyes". Only before an account, a UPI id or a long number:
     PNB writes a credit balance as "Bal INR 539.25 CR.", and "1 Cr" is a crore. */
  /\bCr\.?\s+(?:to|in)\s+(?:your\s+)?(?:a\/c|ac\b|acct|account|vpa\b|[\w.-]+@|\d{6,})/i,
  /* Fi: "We've added INR 242.00 as interest to your account". A figure must
     follow, so "added a new feature to your account" is not money. */
  /\badded\b(?=\s+(?:INR|USD|EUR|GBP|AED|SGD|AUD|CAD) [0-9][0-9,]*(?:\.[0-9]+)?\s+(?:as\s+(?:[a-z]+\s+){1,3})?to\s+(?:your|ur)\s+(?:[a-z]+\s+)?(?:account|a\/c|acct)\b)/i,
];

export type VerbHit = { index: number; end: number; direction: Direction };

/** Every money verb in the text, in order of appearance. */
export function findVerbs(text: string): VerbHit[] {
  const hits: VerbHit[] = [];
  const collect = (patterns: readonly RegExp[], direction: Direction) => {
    for (const pattern of patterns) {
      const global = new RegExp(pattern.source, 'gi');
      for (const match of text.matchAll(global)) {
        hits.push({ index: match.index, end: match.index + match[0].length, direction });
      }
    }
  };
  collect(DEBIT_VERBS, 'debit');
  collect(CREDIT_VERBS, 'credit');
  return hits.sort((a, b) => a.index - b.index);
}

/** A verb that says something has already happened to someone's money. */
export const PAST_MONEY_VERB =
  /\b(?:debited|credited|spent|paid|sent|withdrawn|received|deducted|charged|transferred|refunded|reversed|used\s+(?:for|at)|debit\s+of|(?:txn|transaction)\s+of)\b/i;
