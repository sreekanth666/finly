/**
 * The amount as the keypad builds it.
 *
 * Kept as a string rather than a number because "4." and "4.0" are real states
 * mid-entry that a number can't hold, and because rounding has no business
 * happening while someone is still typing.
 *
 * This module is only the state machine now. Turning an entry into money, and
 * rendering it, both live in domain/money.ts — `entryToMinor`, `minorToEntry`
 * and `formatEntry` — so there is exactly one place that knows what a rupee is.
 */

export type KeypadKey =
  | '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9'
  | '.'
  | 'backspace';

const MAX_DECIMALS = 2;
const MAX_WHOLE_DIGITS = 7;

export const EMPTY_ENTRY = '';

export function appendKey(entry: string, key: KeypadKey): string {
  if (key === 'backspace') {
    return entry.slice(0, -1);
  }

  if (key === '.') {
    if (entry.includes('.')) return entry;

    return entry.length === 0 ? '0.' : `${entry}.`;
  }

  const [whole = '', decimals] = entry.split('.');

  if (decimals !== undefined) {
    return decimals.length >= MAX_DECIMALS ? entry : `${entry}${key}`;
  }

  if (whole.length >= MAX_WHOLE_DIGITS) return entry;
  /* A leading zero is a placeholder, not a digit — "0" then "5" is 5, not 05. */
  if (whole === '0') return key;

  return `${entry}${key}`;
}
