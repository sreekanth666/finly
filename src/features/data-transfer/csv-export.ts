/**
 * Exporting expenses as CSV.
 *
 * The header names are chosen so the file this writes is one the importer
 * recognises without any mapping at all — `date`, `item`, `note`, `amount`,
 * `account`, `category` are all words `guessMapping` already knows, and the date
 * is written ISO so `inferDateOrder` settles on `ymd` with confidence. That is
 * what makes M7's "exports and re-imports identically" true rather than
 * aspirational.
 */

import { db, type DbLike } from '@/db/client';
import { countExpenses, listExpensePage } from '@/db/repositories/expenses';
import { serialiseCsv } from '@/domain/csv';
import { formatMinorPlain, type Minor } from '@/domain/money';

const HEADERS = [
  'date',
  'item',
  'note',
  'amount',
  'account',
  'category',
  'counts_to_budget',
  'settled',
  'effective',
];

const PAGE = 500;

const isoDate = (ms: number): string => {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, '0');
  // Local calendar date, to match the period the expense was filed under.
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

/** A spreadsheet wants a number, not ₹1,240.50. */
const rupeeText = (minor: Minor): string => formatMinorPlain(minor);

export function buildExpensesCsv(database: DbLike = db): string {
  const total = countExpenses({}, database);
  const rows: string[][] = [];

  for (let offset = 0; offset < total; offset += PAGE) {
    for (const expense of listExpensePage({}, { limit: PAGE, offset }, database)) {
      rows.push([
        isoDate(expense.occurredAt),
        expense.item,
        expense.note ?? '',
        rupeeText(expense.amountMinor),
        expense.account?.name ?? '',
        expense.category?.name ?? '',
        expense.countsToBudget ? '1' : '0',
        rupeeText(expense.settledMinor),
        rupeeText(expense.effectiveMinor),
      ]);
    }
  }

  return serialiseCsv(HEADERS, rows);
}
