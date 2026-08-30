/**
 * CSV parsing and column mapping for the import flow (D8, M7).
 *
 * Pure and storage-free. The parser is RFC4180-shaped rather than a `split(',')`
 * because the sheet this exists to migrate has notes in it, and notes contain
 * commas — the naive version silently shifts every column after the first
 * quoted field, which is exactly the corruption an import must not produce.
 */

import { absMinor, parseMinor, type Minor } from './money';

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
const FIELD_HINTS: Record<ImportField, string[]> = {
  date: ['date', 'when', 'day'],
  item: ['item', 'items', 'description', 'merchant', 'what'],
  amount: ['amount', 'value', 'cost', 'price', 'spent'],
  account: ['from', 'account', 'paid from', 'source', 'card'],
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
  /** As written in the file, for showing the reader what was rejected. */
  rawAmount: string;
  account: string;
  category: string;
  note: string;
  /** Empty when the row is importable. */
  issues: string[];
};

const DATE_PATTERNS = [
  /^\d{4}-\d{2}-\d{2}$/, // 2026-08-24
  /^\d{1,2}\/\d{1,2}\/\d{4}$/, // 24/08/2026
  /^\d{1,2}-\d{1,2}-\d{4}$/, // 24-08-2026
];

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
export function buildRows(table: CsvTable, mapping: ColumnMapping): ImportRow[] {
  return table.rows.map((row, index) => {
    const rawAmount = cell(row, mapping.amount);
    const amount = parseAmount(rawAmount);
    const date = cell(row, mapping.date);
    const item = cell(row, mapping.item);
    const issues: string[] = [];

    if (mapping.item === null) issues.push('No column mapped to Item');
    else if (item.length === 0) issues.push('Item is empty');

    if (mapping.amount === null) issues.push('No column mapped to Amount');
    else if (amount === null) issues.push(`Amount “${rawAmount}” is not a number`);
    else if (amount === 0) issues.push('Amount is zero');

    if (mapping.date === null) issues.push('No column mapped to Date');
    else if (!DATE_PATTERNS.some((pattern) => pattern.test(date)))
      issues.push(`Date “${date}” is not a date`);

    return {
      index,
      date,
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
