/**
 * The small fields: direction, card or account, reference, and payment rail.
 *
 * Each is one or two patterns and a tie-break rule, which is why they share a
 * file rather than getting one each.
 */

import type { Channel, Direction, InstrumentType } from './types';
import { findVerbs } from './vocabulary';

/* -------------------------------------------------------------------------- */
/* Direction                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * The first money verb decides. Banks name the user's own account first
 * ("Acct XX316 debited …; KSBC credited"), so the first verb is the one that
 * happened to the user, and the second is what happened to the other side.
 */
export function readDirection(text: string): Direction | null {
  return findVerbs(text)[0]?.direction ?? null;
}

/* -------------------------------------------------------------------------- */
/* Instrument                                                                   */
/* -------------------------------------------------------------------------- */

export type Instrument = { type: InstrumentType | null; tail: string | null };

const MASK = '(?:\\s*(?:no|number)\\.?)?\\s*[:\\-]?\\s*(?:ending(?:\\s+(?:with|in))?\\s*)?[x*.\\s]*?';

const ACCOUNT = new RegExp(`\\b(?:account|acct|a\\/c|ac\\b)${MASK}(\\d{3,6})\\b`, 'gi');
const CARD = new RegExp(`\\b[a-z]*card\\b${MASK}(\\d{4,5})\\b`, 'gi');
const WALLET = /\b(?:wallet|pay balance|paytm balance)\b/i;

/**
 * The earliest card or account the message names, skipping a loan account (an
 * EMI alert names the loan first and the account it was paid from second).
 * Tails are kept exactly as printed — ICICI prints three digits, Amex five — and
 * matched against saved accounts by suffix.
 */
export function readInstrument(text: string): Instrument {
  const found: { index: number; type: InstrumentType; tail: string }[] = [];

  const scan = (pattern: RegExp, type: InstrumentType) => {
    for (const match of text.matchAll(pattern)) {
      const before = text.slice(Math.max(0, match.index - 8), match.index).toLowerCase();
      if (/\bloan\s*$/.test(before)) continue;
      found.push({ index: match.index, type, tail: match[1] });
    }
  };
  scan(ACCOUNT, 'account');
  scan(CARD, 'card');

  found.sort((a, b) => a.index - b.index);
  const first = found[0];
  if (first !== undefined) return { type: first.type, tail: first.tail };
  if (WALLET.test(text)) return { type: 'wallet', tail: null };
  return { type: null, tail: null };
}

/* -------------------------------------------------------------------------- */
/* Reference                                                                    */
/* -------------------------------------------------------------------------- */

const REFERENCES: readonly RegExp[] = [
  /\bUPI(?:\s*(?:ref|reference)\.?(?:\s*no\.?)?)?[\s:.\-/#]*(\d{12})\b/i,
  /\bUPI\/(?:P2[MA]|DR|CR)\/(\d{12})\b/i,
  /\b(?:ref(?:erence)?|rrn|utr|txn\s*(?:id|no)|transaction\s*id)(?:\s*(?:no|number|id))?\.?[\s:.\-#]*([A-Z0-9]*\d[A-Z0-9]*)\b/i,
];

/**
 * A UPI RRN or a bank reference. Worth getting right: it is the only thing that
 * reliably says two alerts — one from the bank, one from the UPI app — describe
 * the same payment, and what ties a reversal back to what it reversed.
 */
export function readReference(text: string): string | null {
  for (const pattern of REFERENCES) {
    const match = pattern.exec(text);
    if (match !== null && match[1].length >= 6) return match[1].toUpperCase();
  }
  return null;
}

/* -------------------------------------------------------------------------- */
/* Channel                                                                      */
/* -------------------------------------------------------------------------- */

const CHANNEL_PATTERNS: readonly [RegExp, Channel][] = [
  [/\batm\b|\bcash withdrawal\b|\bwithdrawn\b/i, 'atm'],
  [/\bemi\b/i, 'emi'],
  [/\bauto-?pay\b|\bmandate\b|\bstanding instruction\b|\be-?nach\b/i, 'autopay'],
  [/\bupi\b|\bvpa\b|[\w.-]+@[a-z]{2,}\b/i, 'upi'],
  [/\bimps\b/i, 'imps'],
  [/\bneft\b/i, 'neft'],
  [/\brtgs\b/i, 'rtgs'],
  [/\bcard\b|\bpos\b/i, 'card'],
];

export function readChannel(text: string, fallback: Channel | null): Channel | null {
  for (const [pattern, channel] of CHANNEL_PATTERNS) {
    if (pattern.test(text)) return channel;
  }
  return fallback;
}
