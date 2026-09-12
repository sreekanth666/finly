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
