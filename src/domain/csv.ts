/**
 * CSV parsing and column mapping for the import flow (D8, M7).
 *
 * Pure and storage-free. The parser is RFC4180-shaped rather than a `split(',')`
 * because the sheet this exists to migrate has notes in it, and notes contain
 * commas — the naive version silently shifts every column after the first
 * quoted field, which is exactly the corruption an import must not produce.
 */

import { absMinor, parseMinor, type Minor } from './money';
import { daysInMonth } from './period';

export type CsvTable = {
  headers: string[];
  rows: string[][];
};

/** The expense fields an import can fill. Mirrors §3's sheet-to-model mapping. */
export type ImportField = 'date' | 'item' | 'note' | 'amount' | 'account' | 'category';

export const IMPORT_FIELDS: ImportField[] = [
  'date',
  'item',
  'amount',
  'account',
  'category',
  'note',
];

export const IMPORT_FIELD_LABELS: Record<ImportField, string> = {
  date: 'Date',
  item: 'Item',
  amount: 'Amount',
  account: 'Paid from',
  category: 'Category',
  note: 'Note',
};

/** Fields an expense cannot be created without (§5: amount > 0, item NOT NULL). */
export const REQUIRED_FIELDS: ImportField[] = ['date', 'item', 'amount'];

/** Column index in the source table, or null when nothing is mapped. */
export type ColumnMapping = Record<ImportField, number | null>;

export const EMPTY_MAPPING: ColumnMapping = {
  date: null,
  item: null,
  amount: null,
  account: null,
  category: null,
  note: null,
};

/**
 * Parses a CSV document. Handles quoted fields, escaped quotes (`""`), commas
 * and newlines inside quotes, and both CRLF and LF line endings.
 */
export function parseCsv(text: string): CsvTable {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let hasField = false;

  const endField = () => {
    row.push(field);
    field = '';
    hasField = false;
  };
  const endRow = () => {
    endField();
    // A trailing newline must not invent a blank record.
    if (row.length > 1 || row[0]!.trim().length > 0) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]!;

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"' && !hasField) {
      inQuotes = true;
      hasField = true;
    } else if (char === ',') {
      endField();
    } else if (char === '\n') {
      endRow();
    } else if (char !== '\r') {
      field += char;
      hasField = true;
    }
  }

  if (field.length > 0 || row.length > 0) endRow();

  const [headers = [], ...body] = rows;

  return { headers: headers.map((header) => header.trim()), rows: body };
}

/** Header names we recognise, in the order they are tried. */
/**
 * Header words that suggest a field.
 *
 * The bank-statement vocabulary is here as well as the spreadsheet one — D8 is
 * about getting existing history across, and a statement writes "Debit" and
 * "Narration" where a hand-kept sheet writes "Amount" and "Items".
 */
const FIELD_HINTS: Record<ImportField, string[]> = {
  date: ['date', 'when', 'day', 'transaction date', 'txn date', 'value date'],
  item: [
    'item',
    'items',
    'description',
    'merchant',
    'what',
    'narration',
    'particulars',
    'details',
    'payee',
  ],
  amount: ['amount', 'value', 'cost', 'price', 'spent', 'debit', 'withdrawal', 'paid', 'charge'],
  account: ['from', 'account', 'paid from', 'source', 'card', 'account name'],
  category: ['category', 'type', 'group'],
  note: ['note', 'notes', 'comment', 'remarks'],
};

/**
 * A first guess at the mapping from the header names. Exact matches win over
 * partial ones, and a column is never assigned to two fields.
 */
export function guessMapping(headers: string[]): ColumnMapping {
  const normalised = headers.map((header) => header.trim().toLowerCase());
  const mapping: ColumnMapping = { ...EMPTY_MAPPING };
  const taken = new Set<number>();

  const claim = (field: ImportField, predicate: (header: string, hint: string) => boolean) => {
    if (mapping[field] !== null) return;

    for (const hint of FIELD_HINTS[field]) {
      const index = normalised.findIndex(
        (header, i) => !taken.has(i) && predicate(header, hint)
      );

      if (index !== -1) {
        mapping[field] = index;
        taken.add(index);

        return;
      }
    }
  };

  for (const field of IMPORT_FIELDS) claim(field, (header, hint) => header === hint);
  for (const field of IMPORT_FIELDS) claim(field, (header, hint) => header.includes(hint));

  return mapping;
}

export type ImportRow = {
  index: number;
  date: string;
  item: string;
  amount: Minor | null;
  /** Epoch ms, or null when the date could not be read. */
  occurredAt: number | null;
  /** As written in the file, for showing the reader what was rejected. */
  rawAmount: string;
  account: string;
  category: string;
  note: string;
  /** Empty when the row is importable. */
  issues: string[];
};

/**
 * Which way round a numeric date is written.
 *
 * This matters more than it looks. The design pass validated dates with a regex
 * and never parsed them, so `15/08/2026` and `08/15/2026` both passed and one of
 * them was silently filed in the wrong month — for every row in the file, with
 * nothing on screen to suggest anything had gone wrong.
 */
export type DateOrder = 'dmy' | 'mdy' | 'ymd';

export const DATE_ORDER_LABELS: Record<DateOrder, string> = {
  dmy: 'DD/MM/YYYY',
  mdy: 'MM/DD/YYYY',
  ymd: 'YYYY-MM-DD',
};

const ISO_DATE = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/;
const NUMERIC_DATE = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/;

/**
 * Reads a date in a known order, and rejects one that does not exist.
 *
 * Returns local midday rather than midnight: the instant is only ever used for
 * its calendar date, and midday cannot be pushed across a day boundary by a
 * daylight-saving shift.
 */
export function parseCsvDate(raw: string, order: DateOrder): number | null {
  const text = raw.trim();

  const iso = ISO_DATE.exec(text);
  const numeric = NUMERIC_DATE.exec(text);

  let year: number;
  let month: number;
  let day: number;

  if (iso !== null) {
    year = Number(iso[1]);
    month = Number(iso[2]);
    day = Number(iso[3]);
  } else if (numeric !== null) {
    const first = Number(numeric[1]);
    const second = Number(numeric[2]);
    year = Number(numeric[3]);
    // 'ymd' cannot apply to a d/m/yyyy shape; fall back to day-first, which is
    // what the sheet this app replaces writes.
    month = order === 'mdy' ? first : second;
    day = order === 'mdy' ? second : first;
  } else {
    return null;
  }

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  if (year < 1900 || year > 2200) return null;

  return new Date(year, month - 1, day, 12, 0).getTime();
}

export type DateOrderGuess = {
  order: DateOrder;
  /** False when the sample cannot distinguish DD/MM from MM/DD. */
  confident: boolean;
};

/**
 * Infers the order from the data itself.
 *
 * A component above 12 can only be a day, which settles it. When nothing in the
 * file is above 12 the two readings are genuinely indistinguishable, and the
 * honest answer is to say so and let the user choose — defaulting silently is
 * how every row ends up in the wrong month.
 */
export function inferDateOrder(samples: readonly string[]): DateOrderGuess {
  const values = samples.map((sample) => sample.trim()).filter((sample) => sample.length > 0);
  if (values.length === 0) return { order: 'dmy', confident: false };

  if (values.every((value) => ISO_DATE.test(value))) {
    return { order: 'ymd', confident: true };
  }

  let firstOverTwelve = false;
  let secondOverTwelve = false;

  for (const value of values) {
    const match = NUMERIC_DATE.exec(value);
    if (match === null) continue;
    if (Number(match[1]) > 12) firstOverTwelve = true;
    if (Number(match[2]) > 12) secondOverTwelve = true;
  }

  if (firstOverTwelve && !secondOverTwelve) return { order: 'dmy', confident: true };
  if (secondOverTwelve && !firstOverTwelve) return { order: 'mdy', confident: true };

  // Either both look like days (the file is inconsistent) or neither does.
  return { order: 'dmy', confident: false };
}

/**
 * Strips grouping and any currency mark, and returns paise.
 *
 * Delegates to money.ts rather than reimplementing the parse, so an imported
 * ₹1,24,050.50 lands on exactly the same integer as one typed on the keypad.
 * Sign is discarded: a spreadsheet writes money out as a negative, and §5 stores
 * every expense unsigned.
 */
export function parseAmount(raw: string): Minor | null {
  const parsed = parseMinor(raw);
  return parsed === null ? null : absMinor(parsed);
}

const cell = (row: string[], index: number | null) =>
  index === null ? '' : (row[index] ?? '').trim();

/** Applies a mapping to the table, reporting per-row problems rather than throwing. */
export function buildRows(
  table: CsvTable,
  mapping: ColumnMapping,
  dateOrder: DateOrder,
): ImportRow[] {
  return table.rows.map((row, index) => {
    const rawAmount = cell(row, mapping.amount);
    const amount = parseAmount(rawAmount);
    const date = cell(row, mapping.date);
    const occurredAt = parseCsvDate(date, dateOrder);
    const item = cell(row, mapping.item);
    const issues: string[] = [];

    if (mapping.item === null) issues.push('No column mapped to Item');
    else if (item.length === 0) issues.push('Item is empty');

    if (mapping.amount === null) issues.push('No column mapped to Amount');
    else if (amount === null) issues.push(`Amount “${rawAmount}” is not a number`);
    else if (amount === 0) issues.push('Amount is zero');

    if (mapping.date === null) issues.push('No column mapped to Date');
    else if (occurredAt === null) issues.push(`Date “${date}” is not a date`);

    return {
      index,
      date,
      occurredAt,
      item,
      amount,
      rawAmount,
      account: cell(row, mapping.account),
      category: cell(row, mapping.category),
      note: cell(row, mapping.note),
      issues,
    };
  });
}

export type ImportSummary = { total: number; ready: number; blocked: number };

export const summarise = (rows: ImportRow[]): ImportSummary => {
  const blocked = rows.filter((row) => row.issues.length > 0).length;

  return { total: rows.length, ready: rows.length - blocked, blocked };
};

/** Whether the mapping covers everything an expense cannot be created without. */
export const isMappingComplete = (mapping: ColumnMapping) =>
  REQUIRED_FIELDS.every((field) => mapping[field] !== null);

/* -------------------------------------------------------------------------- */
/* Writing                                                                      */
/* -------------------------------------------------------------------------- */

/** A field that could be read as a formula when the file is opened elsewhere. */
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Escapes one field.
 *
 * The leading apostrophe on anything that starts like a formula is not
 * decoration: this file exists to be opened in a spreadsheet, and a description
 * beginning with `=` or `+` is executed there. Quoting alone does not prevent
 * that.
 */
export function escapeCsvField(value: string): string {
  const guarded = FORMULA_START.test(value) ? `'${value}` : value;
  const needsQuotes = /[",\n\r]/.test(guarded) || guarded !== guarded.trim();

  return needsQuotes ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** Byte-order mark, so Excel opens UTF-8 without mangling the rupee sign. */
export const UTF8_BOM = '\uFEFF';

export function serialiseCsv(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const lines = [headers, ...rows].map((row) => row.map(escapeCsvField).join(','));

  // CRLF per RFC4180; every spreadsheet reads it and some older ones need it.
  return `${UTF8_BOM}${lines.join('\r\n')}\r\n`;
}
