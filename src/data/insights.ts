/**
 * Mock data for the Insights screen — the four views D13 commits to: spend by
 * category, month-over-month against the budget, card utilisation, and the
 * month's top items.
 *
 * Design-pass placeholder, shaped the way the M6 queries will return it.
 *
 * `byCategory` arrives already folded to five buckets, because five is the
 * ceiling the chart palette validates at (see tokens.css). Each bucket carries
 * its own tone so colour follows the entity rather than its rank — a category
 * must not change colour just because a quieter month reorders the list.
 *
 * Open question for M6: when the top-4 set itself changes between months, a
 * category entering the chart needs the tone it had last time, which means
 * pinning tones per category in the repository rather than per response.
 */

import type { CategoryId } from './categories';

import type { ChartTone } from '@/theme/chart';

export type CategorySpend = {
  /** 'other' is the folded tail, not the Other category. */
  id: CategoryId | 'other';
  label: string;
  amount: number;
  tone: ChartTone;
};

export type TrendMonth = {
  id: string;
  /** Short axis label. */
  label: string;
  spent: number;
};

export type CardUtilisation = {
  id: string;
  name: string;
  cycleSpend: number;
  creditLimit: number;
  daysToStatement: number;
};

export type TopItem = {
  id: string;
  item: string;
  categoryId: CategoryId;
  count: number;
  amount: number;
};

export type InsightsOverview = {
  period: string;
  totalSpent: number;
  monthlyBudget: number;
  byCategory: CategorySpend[];
  trend: TrendMonth[];
  cards: CardUtilisation[];
  topItems: TopItem[];
};

export const insightsOverview: InsightsOverview = {
  period: 'August 2026',
  totalSpent: 3184.6,
  monthlyBudget: 3000,
  byCategory: [
    { id: 'housing', label: 'Housing', amount: 850, tone: 'chart-2' },
    { id: 'food', label: 'Food', amount: 742.4, tone: 'chart-3' },
    { id: 'shopping', label: 'Shopping', amount: 631.15, tone: 'chart-1' },
    { id: 'bills', label: 'Bills', amount: 528.9, tone: 'chart-5' },
    { id: 'other', label: 'Other', amount: 432.15, tone: 'chart-4' },
  ],
  trend: [
    { id: '2026-03', label: 'Mar', spent: 2740.1 },
    { id: '2026-04', label: 'Apr', spent: 3160.4 },
    { id: '2026-05', label: 'May', spent: 2585.75 },
    { id: '2026-06', label: 'Jun', spent: 2910.2 },
    { id: '2026-07', label: 'Jul', spent: 3402.8 },
    { id: '2026-08', label: 'Aug', spent: 3184.6 },
  ],
  cards: [
    { id: 'c-1', name: 'HDFC Millennia', cycleSpend: 1840.25, creditLimit: 4000, daysToStatement: 9 },
    { id: 'c-2', name: 'ICICI Amazon Pay', cycleSpend: 2610.5, creditLimit: 3000, daysToStatement: 21 },
  ],
  topItems: [
    { id: 't-1', item: 'Rent', categoryId: 'housing', count: 1, amount: 850 },
    { id: 't-2', item: 'Swiggy', categoryId: 'food', count: 11, amount: 384.2 },
    { id: 't-3', item: 'Groceries', categoryId: 'shopping', count: 6, amount: 312.6 },
    { id: 't-4', item: 'Electricity Bill', categoryId: 'bills', count: 1, amount: 245.4 },
    { id: 't-5', item: 'Uber', categoryId: 'transport', count: 14, amount: 198.75 },
  ],
};
