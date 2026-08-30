/**
 * Mock data for the Transactions screen.
 *
 * Design-pass placeholder — grouped by day the way the repository layer will
 * return it, so swapping it for a real query is a one-file change.
 *
 * Amounts are unsigned integer paise, matching `CHECK (amount_minor > 0)` in §5.
 * Direction is not a property of an expense: there is no income ledger (D4), so
 * everything here is money going out. The figures are the design pass's own,
 * scaled into paise — placeholders, replaced by the user's imported history.
 */

import type { Minor } from '@/domain/money';

import type { CategoryId } from './categories';

export type Transaction = {
  id: string;
  /** Free-text description — the `item` column in the schema. */
  title: string;
  categoryId: CategoryId;
  /** Unsigned integer paise. */
  amountMinor: Minor;
  /** Local time of day, already formatted for the row. */
  time: string;
  /** Free text, when one was added. */
  note?: string;
  /** Account name — the join key until accounts get ids in M3. */
  accountName?: string;
  /** Whether it counts toward the monthly budget (D3). Absent means it does. */
  countsToBudget?: boolean;
};

export type TransactionDay = {
  id: string;
  /** 'Today', 'Yesterday', or a formatted date once the feed goes back further. */
  label: string;
  transactions: Transaction[];
};

export const transactionDays: TransactionDay[] = [
  {
    id: 'today',
    label: 'Today',
    transactions: [
      {
        id: 't-1',
        title: 'Groceries',
        categoryId: 'shopping',
        amountMinor: 2520 as Minor,
        time: '11:23',
        accountName: 'HDFC Millennia',
        note: 'Weekly shop',
      },
    ],
  },
  {
    id: 'yesterday',
    label: 'Yesterday',
    transactions: [
      {
        id: 'y-1',
        title: 'Electricity Bill',
        categoryId: 'bills',
        amountMinor: 4560 as Minor,
        time: '18:43',
        accountName: 'ICICI Bank',
      },
      {
        id: 'y-2',
        title: 'Rent',
        categoryId: 'housing',
        amountMinor: 85000 as Minor,
        time: '14:30',
        accountName: 'ICICI Bank',
      },
      { id: 'y-4', title: 'Metro Card Top-up', categoryId: 'transport', amountMinor: 3000 as Minor, time: '08:55' },
      { id: 'y-5', title: 'Morning Coffee', categoryId: 'food', amountMinor: 475 as Minor, time: '08:20' },
    ],
  },
  {
    id: 'aug-24',
    label: 'Sun, 24 Aug',
    transactions: [
      { id: 'a-1', title: 'Pharmacy', categoryId: 'health', amountMinor: 1840 as Minor, time: '19:02' },
      { id: 'a-2', title: 'Dinner Out', categoryId: 'food', amountMinor: 6230 as Minor, time: '20:40' },
      { id: 'a-3', title: 'Internet Bill', categoryId: 'bills', amountMinor: 5500 as Minor, time: '12:15' },
    ],
  },
  {
    id: 'aug-23',
    label: 'Sat, 23 Aug',
    transactions: [
      {
        id: 'b-1',
        title: 'New Headphones',
        categoryId: 'shopping',
        amountMinor: 12999 as Minor,
        time: '16:27',
        accountName: 'HDFC Millennia',
        countsToBudget: false,
        note: 'one-off purchase',
      },
      { id: 'b-2', title: 'Haircut', categoryId: 'personal', amountMinor: 2200 as Minor, time: '11:05' },
    ],
  },
];

/** A transaction together with the day it belongs to, for the edit form. */
export type TransactionLookup = {
  transaction: Transaction;
  day: TransactionDay;
};

export function findTransaction(id: string): TransactionLookup | undefined {
  for (const day of transactionDays) {
    const transaction = day.transactions.find((candidate) => candidate.id === id);

    if (transaction) return { transaction, day };
  }

  return undefined;
}
