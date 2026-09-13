/**
 * Who was paid, or who paid.
 *
 * Every bank puts the other party somewhere different: after a semicolon
 * (ICICI), on a line starting "To" (HDFC), inside a UPI narration (Axis), after
 * "to VPA", "at", "towards", or on its own line under the date. The patterns are
 * tried in order and the first *plausible* answer wins — plausible meaning it is
 * not "your account XXX789", not "UPI transfer", and not a phone number.
 *
 * Everything after the boilerplate tail ("Not you? Call …", "SMS BLOCK …") is
 * cut off first. That tail is full of "to 9264092640" and "to block UPI", which
 * look exactly like payees to a pattern.
 */

import type { Direction } from './types';

const BOILERPLATE =
  /\b(?:not you|not u\b|if not (?:you|u|done by you|initiated|made by you)|to dispute|for dispute|call\s*[-:]?\s*\d|sms block|report at|fwd this|click (?:on|here)|t&c)/i;

/**
 * A full stop glued to the next word ("PHARMACEUTI.Ref:6069…", "Unni.Not
 * you?") ends a payee as surely as ". " does — but only before words that
 * start the boilerplate, and never inside a UPI id like `shop.upi@okaxis` or a
 * name like "DR.BAL KRISHNAN".
 */
const GLUED_STOP =
  '\\.(?![\\w.-]*@)(?=(?:ref\\w*|rrn|utr|txn)\\b\\W*\\d|(?:avl|aval|avbl|avail|bal)\\w*\\W*(?:INR|\\d)|(?:not|if|call|info)\\b)';

const STOP =
  '(?=\\s*\\(|\\s+(?:on|via|ref\\w*|upi|from|using|for|with|in|by|was|is|has|avl|bal|thru|not|successful\\w*)\\b|\\.(?:\\s|$)|' +
  GLUED_STOP +
  '|,|;|\\n|$)';

const DEBIT_PATTERNS: readonly RegExp[] = [
  /;\s*([^;\n]+?)\s+credited\b/i,
  /\bUPI\/(?:P2[MA]|DR|CR)\/\d+\/([^/\n]+)/i,
  /(?:^|\n)To[:\s]+([^\n]+)/,
  /\bon\s+\d{1,2}[-/ ]?[A-Za-z]{3,9}[-/ ]?\d{2,4}\s+on\s+(.+?)(?=\.(?:\s|$)|,|;|\n|$)/i,
  /* A dot only when no space follows, so "NETFLIX.COM" survives and "FOR
     APR-26. The curr bal is" does not become a payee. */
  /\bfor\s+([A-Za-z](?:[A-Za-z0-9 &'\-]|\.(?=\S))*?)\s+(?:has|is|was|will)\b/i,
  /* "at 18:11:09" is when, not where. A digit alone is allowed: "at 1MG". */
  new RegExp(`\\bat\\s+(?!\\d{1,2}[:.]\\d{2})(.+?)${STOP}`, 'i'),
  new RegExp(`\\b(?:trf to|towards|to)\\s+(?:vpa\\s+|beneficiary\\s+)?(.+?)${STOP}`, 'i'),
];

const CREDIT_PATTERNS: readonly RegExp[] = [
  new RegExp(`\\bfrom\\s+(?:vpa\\s+)?(.+?)${STOP.replace('from|', 'to|')}`, 'i'),
  /\bvpa\s+([\w.-]+@[\w.-]+)/i,
  /* AU and others name the payer only inside the narration. Last, so "from"
     and "VPA" still win when they are there. */
  /\bUPI\/(?:P2[MA]|DR|CR)\/\d+\/([^/\n]+)/i,
];

const CURRENCY_WORD = /\b(?:INR|USD|EUR|GBP|AED|SGD|AUD|CAD)\b/;
const OWN_INSTRUMENT = /\b(?:your|ur|a\/c|acct|account|card|wallet|balance)\b/i;

/** Words that, on their own, name a rail or a form field rather than a party. */
const GENERIC = new Set([
  'upi', 'transfer', 'neft', 'imps', 'rtgs', 'payment', 'txn', 'transaction', 'fund', 'funds',
  'pos', 'bank', 'mob', 'bk', 'net', 'banking', 'the', 'a', 'block', 'self', 'you', 'mobile',
  'merchant',
]);

function plausible(raw: string): string | null {
  const value = raw.replace(/^[\s:'"-]+|[\s.,;:'"-]+$/g, '').replace(/\s+/g, ' ');
  if (value.length === 0 || value.length > 60) return null;
  if (CURRENCY_WORD.test(value) || OWN_INSTRUMENT.test(value)) return null;
  /* A clock time is never part of a name. */
  if (/\b\d{1,2}:\d{2}\b/.test(value)) return null;
  if (/^[\d\s\-/.:]+$/.test(value)) return null;
  const words = value.toLowerCase().split(/[\s/]+/).filter((word) => word.length > 0);
  if (words.every((word) => GENERIC.has(word) || /\d/.test(word))) return null;
  if (labelOf(value) === null) return null;
  return value;
}

function firstPlausible(text: string, patterns: readonly RegExp[]): string | null {
  for (const pattern of patterns) {
    const global = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`);
    for (const match of text.matchAll(global)) {
      const value = plausible(match[1]);
      if (value !== null) return value;
    }
  }
  return null;
}

/**
 * The line under a line that is nothing but a date and time — Axis's card alert
 * puts the merchant there and nowhere else.
 */
function lineAfterDate(text: string): string | null {
  const lines = text.split('\n');
  for (let index = 0; index < lines.length - 1; index += 1) {
    if (/^\d{1,2}[-/]\d{1,2}[-/]\d{2,4}(?:[ ,]+\d{1,2}:\d{2}(?::\d{2})?)?$/.test(lines[index].trim())) {
      const next = plausible(lines[index + 1]);
      if (next !== null && !/^(?:avl|bal|upi\/)/i.test(next)) return next;
    }
  }
  return null;
}

export function readCounterparty(text: string, direction: Direction | null): string | null {
  const cut = BOILERPLATE.exec(text);
  const body = cut === null ? text : text.slice(0, cut.index);

  if (direction === 'credit') return firstPlausible(body, CREDIT_PATTERNS);
  if (direction === 'debit') return firstPlausible(body, DEBIT_PATTERNS) ?? lineAfterDate(body);
  return null;
}

/* -------------------------------------------------------------------------- */
/* Labels                                                                       */
/* -------------------------------------------------------------------------- */

const ACRONYMS = new Set(['SBI', 'HDFC', 'ICICI', 'IRCTC', 'KSRTC', 'BSNL', 'LIC', 'UPI', 'ATM', 'EMI', 'KSEB']);
const SUFFIXES: Record<string, string> = { PVT: 'Pvt', LTD: 'Ltd', LLP: 'LLP', CO: 'Co' };

const titleWord = (word: string): string => {
  if (ACRONYMS.has(word)) return word;
  if (SUFFIXES[word] !== undefined) return SUFFIXES[word];
  if (word.length <= 1 || !/[AEIOU]/.test(word)) return word;
  return word.charAt(0) + word.slice(1).toLowerCase();
};

/**
 * What to call the other party on an expense: "swiggy@axisbank" → "Swiggy",
 * "KSBC FL017040 P" → "KSBC P", "MEERA  K S" → "Meera K S". Tokens with digits
 * in them are terminal ids and store codes, never part of a name. A string that
 * already has lower-case letters was written by a person and is left alone.
 * Null when nothing name-like is left — a VPA that is only a phone number.
 */
export function labelOf(raw: string): string | null {
  let value = raw.trim();
  if (value.includes('@')) value = value.slice(0, value.indexOf('@')).replace(/[._-]+/g, ' ');

  const words = value
    .replace(/[*#"()]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0 && !/\d/.test(word));
  if (words.length === 0) return null;

  const joined = words.join(' ');
  if (!/[a-z]/i.test(joined)) return null;

  if (joined === joined.toLowerCase()) {
    return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }
  if (/[a-z]/.test(joined)) return joined;
  return words.map(titleWord).join(' ');
}
