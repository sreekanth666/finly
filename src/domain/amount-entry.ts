/**
 * The amount as the user is typing it.
 *
 * Kept as a string rather than a number because "4." and "4.0" are real states
 * mid-entry that a number can't hold, and because rounding has no business
 * happening while someone is still typing.
 *
 * The in-app keypad this used to drive could only append one key at a time. The
 * system number pad hands over the whole field instead — after a paste, a
 * select-all, a caret moved into the middle — so this cleans what it is given
 * rather than building it up.
 *
 * Turning an entry into money lives in domain/money.ts — `entryToMinor` and
 * `minorToEntry` — so there is exactly one place that knows what a rupee is.
 */

const MAX_DECIMALS = 2;
const MAX_WHOLE_DIGITS = 7;

export const EMPTY_ENTRY = '';

/**
 * What the field holds once `typed` replaces `previous`.
 *
 * A comma is grouping, as it is to `parseMinor`: the number pad has a comma key,
 * and in this app a comma is never a decimal point. Anything the field cannot
 * hold — a second point, an eighth whole digit, a third decimal — keeps
 * `previous`, so the key simply does nothing. Moving the point instead would
 * change the amount without saying so.
 */
export function acceptEntry(previous: string, typed: string): string {
  const cleaned = typed.replace(/[^\d.]/g, '');
  const [rawWhole = '', decimals, ...extra] = cleaned.split('.');

  if (extra.length > 0) return previous;
  if (decimals !== undefined && decimals.length > MAX_DECIMALS) return previous;

  /* A leading zero is a placeholder, not a digit — "0" then "5" is 5, not 05. */
  const whole = rawWhole.replace(/^0+(?=\d)/, '');
  if (whole.length > MAX_WHOLE_DIGITS) return previous;

  if (decimals === undefined) return whole;
  return `${whole === '' ? '0' : whole}.${decimals}`;
}
