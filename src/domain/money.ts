/**
 * Money, in one place.
 *
 * Every amount in Finly is an integer number of paise. ₹1,240.50 is `124050`,
 * never `1240.5` — §4.1. Floats are banned outright: `0.1 + 0.2` is the reason,
 * and a budget that drifts by a paise a month is a budget nobody trusts.
 *
 * The `Minor` brand exists so the compiler can tell paise from rupees. They are
 * both `number` at runtime and would otherwise be freely interchangeable, which
 * is exactly the mistake that is invisible until a ₹5,000 budget reads ₹50.
 *
 * Formatting lives here too, and only here. No component formats money itself.
 */

/** An integer count of minor units (paise, cents, …). */
export type Minor = number & { readonly __brand: 'Minor' };

const MINOR_PER_MAJOR = 100;
const FRACTION_DIGITS = 2;

/* -------------------------------------------------------------------------- */
/* Currency                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * One display currency for the whole app.
 *
 * This is not multi-currency, which §2 lists as a non-goal: every amount is
 * still one integer in one currency, and the `currency` column still records
 * what that was. What this adds is the ability to say which one.
 *
 * Grouping is part of the currency, not decoration. ₹1,24,050 and $124,050 are
 * the same number written by different conventions, so a symbol swap alone
 * would produce Indian grouping on a dollar amount.
 */
export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP' | 'AUD' | 'CAD' | 'SGD' | 'AED';

export type Currency = {
  code: CurrencyCode;
  symbol: string;
  name: string;
  /** How the whole part is punctuated. */
  grouping: 'indian' | 'western';
  /** What the fractional unit is called, for a screen reader. */
  minorName: string;
  majorName: string;
};

export const CURRENCIES: Record<CurrencyCode, Currency> = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian rupee', grouping: 'indian', majorName: 'rupees', minorName: 'paise' },
  USD: { code: 'USD', symbol: '$', name: 'US dollar', grouping: 'western', majorName: 'dollars', minorName: 'cents' },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', grouping: 'western', majorName: 'euros', minorName: 'cents' },
  GBP: { code: 'GBP', symbol: '£', name: 'Pound sterling', grouping: 'western', majorName: 'pounds', minorName: 'pence' },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian dollar', grouping: 'western', majorName: 'dollars', minorName: 'cents' },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian dollar', grouping: 'western', majorName: 'dollars', minorName: 'cents' },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore dollar', grouping: 'western', majorName: 'dollars', minorName: 'cents' },
  AED: { code: 'AED', symbol: 'AED ', name: 'UAE dirham', grouping: 'western', majorName: 'dirhams', minorName: 'fils' },
};

export const DEFAULT_CURRENCY = CURRENCIES.INR;

export const isCurrencyCode = (value: string): value is CurrencyCode =>
  Object.prototype.hasOwnProperty.call(CURRENCIES, value);

export const toCurrency = (code: string | null | undefined): Currency =>
  code != null && isCurrencyCode(code) ? CURRENCIES[code] : DEFAULT_CURRENCY;

/**
 * The currency every unqualified format call uses.
 *
 * Module-level rather than threaded through, because it is genuinely global —
 * one setting, read once at boot — and because passing it to each of the forty
 * call sites would add noise without adding a decision anyone makes locally.
 * Tests pass it explicitly.
 */
let activeCurrency: Currency = DEFAULT_CURRENCY;

export const setActiveCurrency = (currency: Currency): void => {
  activeCurrency = currency;
};

export const getActiveCurrency = (): Currency => activeCurrency;

/**
 * The unsafe constructor. Only row mappers, this module and tests should call
 * it — everywhere else, minor units should already be minor units.
 */
export function asMinor(value: number): Minor {
  if (!Number.isInteger(value)) {
    throw new TypeError(`Expected an integer paise value, got ${value}`);
  }
  return value as Minor;
}

export const ZERO_MINOR = asMinor(0);

export const addMinor = (a: Minor, b: Minor): Minor => (a + b) as Minor;
export const subMinor = (a: Minor, b: Minor): Minor => (a - b) as Minor;
export const negateMinor = (value: Minor): Minor => -value as Minor;
export const absMinor = (value: Minor): Minor => Math.abs(value) as Minor;
export const maxMinor = (a: Minor, b: Minor): Minor => (a > b ? a : b);
export const minMinor = (a: Minor, b: Minor): Minor => (a < b ? a : b);
export const clampMinorAtZero = (value: Minor): Minor => (value > 0 ? value : ZERO_MINOR);

export const sumMinor = (values: readonly Minor[]): Minor =>
  values.reduce<Minor>((total, value) => addMinor(total, value), ZERO_MINOR);

/** Guarded division, because a card with no limit must not produce Infinity. */
export const ratio = (part: Minor, whole: Minor): number => (whole > 0 ? part / whole : 0);

/**
 * Indian digit grouping: the last three digits, then pairs.
 * `124050` → `1,24,050`; `12345678` → `1,23,45,678`.
 */
export const groupIndian = (digits: string): string =>
  digits.replace(/(\d)(?=(\d\d)+\d$)/g, '$1,');

/** Groups of three throughout: `124050` → `124,050`. */
export const groupWestern = (digits: string): string =>
  digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

export const groupFor = (currency: Currency): ((digits: string) => string) =>
  currency.grouping === 'indian' ? groupIndian : groupWestern;

/**
 * Splits a string of digits into whole and fractional halves without ever
 * building a float. `'124050'` → `{ whole: '1240', fraction: '50' }`.
 */
function splitDigits(digits: string): { whole: string; fraction: string } {
  const padded = digits.padStart(FRACTION_DIGITS + 1, '0');
  return {
    whole: padded.slice(0, -FRACTION_DIGITS),
    fraction: padded.slice(-FRACTION_DIGITS),
  };
}

export type MoneySign = 'never' | 'negative' | 'always';

export type MoneyFormatOptions = {
  /** Drop the paise entirely — whole-rupee figures in the design do. */
  showFraction?: boolean;
  /** `negative` shows a leading − only when negative; `always` also shows +. */
  sign?: MoneySign;
  /** Set false for a bare number, e.g. inside a sentence that already said ₹. */
  symbol?: boolean;
  /** Defaults to the app's active currency; tests and previews pass it. */
  currency?: Currency;
};

export type MoneyParts = {
  sign: string;
  symbol: string;
  whole: string;
  fraction: string;
};

/**
 * The split form, so a component can render the paise a step smaller than the
 * rupees without knowing anything about how either was produced.
 */
export function formatMinorParts(
  value: Minor,
  {
    showFraction = true,
    sign = 'negative',
    symbol = true,
    currency = activeCurrency,
  }: MoneyFormatOptions = {},
): MoneyParts {
  const magnitude = Math.abs(value);
  const { whole, fraction } = splitDigits(String(magnitude));

  let signText = '';
  if (value < 0) {
    signText = sign === 'never' ? '' : '−';
  } else if (value > 0 && sign === 'always') {
    signText = '+';
  }

  return {
    sign: signText,
    symbol: symbol ? currency.symbol : '',
    whole: groupFor(currency)(whole),
    fraction: showFraction ? fraction : '',
  };
}

export function formatMinor(value: Minor, options: MoneyFormatOptions = {}): string {
  const { sign, symbol, whole, fraction } = formatMinorParts(value, options);
  return `${sign}${symbol}${whole}${fraction === '' ? '' : `.${fraction}`}`;
}

/** What a screen reader should say. `₹1,24,050.50` reads as rupees and paise. */
export function speakMinor(value: Minor, currency: Currency = activeCurrency): string {
  const { whole, fraction } = splitDigits(String(Math.abs(value)));
  const major = `${value < 0 ? 'minus ' : ''}${groupFor(currency)(whole)} ${currency.majorName}`;
  return fraction === '00' ? major : `${major} ${Number(fraction)} ${currency.minorName}`;
}

/**
 * Parses free text into paise — the CSV import path, and anywhere a human typed
 * a figure. Tolerates the currency mark, grouping separators of either flavour,
 * spaces, and accounting-style parentheses for negatives.
 *
 * Returns null rather than throwing: an unparseable cell is a row the importer
 * reports, not an exception.
 *
 * Never goes through parseFloat. `parseFloat('1240.50') * 100` is not reliably
 * `124050`, and that is precisely the drift this whole module exists to avoid.
 */
export function parseMinor(input: string): Minor | null {
  const trimmed = input.trim();
  if (trimmed === '') return null;

  const isParenthesised = /^\(.*\)$/.test(trimmed);
  const body = isParenthesised ? trimmed.slice(1, -1) : trimmed;

  // Strip everything that isn't a digit, a separator or a leading sign.
  const cleaned = body.replace(/[^\d.,\-+]/g, '');
  const isNegative = isParenthesised || cleaned.startsWith('-');
  const unsigned = cleaned.replace(/[-+]/g, '');
  if (unsigned === '') return null;

  // The last '.' is the decimal point; every ',' is grouping. A trailing ','
  // used as a decimal comma is out of scope — the app is INR and writes '.'.
  const lastDot = unsigned.lastIndexOf('.');
  const wholeText = (lastDot === -1 ? unsigned : unsigned.slice(0, lastDot)).replace(/[.,]/g, '');
  const fractionText = lastDot === -1 ? '' : unsigned.slice(lastDot + 1).replace(/[.,]/g, '');

  if (!/^\d*$/.test(wholeText) || !/^\d*$/.test(fractionText)) return null;
  if (wholeText === '' && fractionText === '') return null;

  const fraction = fractionText.slice(0, FRACTION_DIGITS).padEnd(FRACTION_DIGITS, '0');
  const magnitude = Number(`${wholeText === '' ? '0' : wholeText}${fraction}`);
  if (!Number.isSafeInteger(magnitude)) return null;

  return asMinor(isNegative ? -magnitude : magnitude);
}

/**
 * Keypad entry → paise. The entry is the raw string the keypad holds, so `'4.'`
 * and `'4.0'` are real mid-typing states and both mean ₹4.00.
 */
export function entryToMinor(entry: string): Minor {
  if (entry === '') return ZERO_MINOR;
  const [whole = '', fraction = ''] = entry.split('.');
  const padded = fraction.slice(0, FRACTION_DIGITS).padEnd(FRACTION_DIGITS, '0');
  return asMinor(Number(`${whole === '' ? '0' : whole}${padded}`));
}

/** The inverse, for loading an existing amount back into the keypad. */
export function minorToEntry(value: Minor): string {
  if (value === 0) return '';
  const { whole, fraction } = splitDigits(String(Math.abs(value)));
  return `${whole}.${fraction}`;
}

/**
 * The live keypad display. Groups the rupees the Indian way and keeps a
 * trailing '.' the user typed, so the caret doesn't appear to swallow it.
 */
export function formatEntry(entry: string, currency: Currency = activeCurrency): string {
  const { symbol } = currency;
  if (entry === '') return `${symbol}0`;

  const [whole = '', fraction] = entry.split('.');
  const grouped = groupFor(currency)(whole === '' ? '0' : whole);
  if (fraction === undefined) return `${symbol}${grouped}`;
  return `${symbol}${grouped}.${fraction}`;
}

/**
 * Plain decimal rupees: `124050` → `'1240.50'`.
 *
 * No symbol and no grouping, because this is for a machine — a CSV cell that a
 * spreadsheet has to read back as a number. Built from the digits rather than by
 * dividing, so it cannot drift.
 */
export function formatMinorPlain(value: Minor): string {
  const { whole, fraction } = splitDigits(String(Math.abs(value)));
  return `${value < 0 ? '-' : ''}${whole}.${fraction}`;
}

/** Major units in, paise out. For seeds and fixtures only — never user input. */
export const rupees = (major: number): Minor => asMinor(Math.round(major * MINOR_PER_MAJOR));
