/**
 * Mock data for the Transactions screen.
 *
 * Design-pass placeholder — grouped by day the way the repository layer will
 * return it, so swapping it for a real query is a one-file change. Amounts are
 * signed: negative is money out, positive is money in.
 */

import type { CategoryId } from './categories';

export type Transaction = {
  id: string;
  /** Free-text description — the `item` column in the schema. */
  title: string;
  categoryId: CategoryId;
  /** Signed major units. Negative is money out. */
  amount: number;
  /** Local time of day, already formatted for the row. */
  time: string;
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
      { id: 't-1', title: 'Groceries', categoryId: 'shopping', amount: -25.2, time: '11:23' },
      { id: 't-2', title: 'Frilance Project', categoryId: 'income', amount: 350, time: '09:07' },
    ],
  },
  {
    id: 'yesterday',
    label: 'Yesterday',
    transactions: [
      { id: 'y-1', title: 'Electricity Bill', categoryId: 'bills', amount: -45.6, time: '18:43' },
      { id: 'y-2', title: 'Rent', categoryId: 'housing', amount: -850, time: '14:30' },
      { id: 'y-3', title: 'Salary', categoryId: 'income', amount: 2650, time: '10:12' },
      { id: 'y-4', title: 'Metro Card Top-up', categoryId: 'transport', amount: -30, time: '08:55' },
      { id: 'y-5', title: 'Morning Coffee', categoryId: 'food', amount: -4.75, time: '08:20' },
    ],
  },
  {
    id: 'aug-24',
    label: 'Sun, 24 Aug',
    transactions: [
      { id: 'a-1', title: 'Pharmacy', categoryId: 'health', amount: -18.4, time: '19:02' },
      { id: 'a-2', title: 'Dinner Out', categoryId: 'food', amount: -62.3, time: '20:40' },
      { id: 'a-3', title: 'Internet Bill', categoryId: 'bills', amount: -55, time: '12:15' },
    ],
  },
  {
    id: 'aug-23',
    label: 'Sat, 23 Aug',
    transactions: [
      { id: 'b-1', title: 'New Headphones', categoryId: 'shopping', amount: -129.99, time: '16:27' },
      { id: 'b-2', title: 'Haircut', categoryId: 'personal', amount: -22, time: '11:05' },
    ],
  },
];
