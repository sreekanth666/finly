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


import type { Minor } from '@/domain/money';
import type { ChartTone } from '@/theme/chart';

/** A category id. Free text now that categories are rows rather than a union. */
type CategoryId = string;

/**
 * Stands in for the stored monthly budget while Insights is still a fixture.
 * M6 replaces this whole file with aggregates, and the budget line on the trend
 * chart comes from the budgets table like every other figure.
 */
const monthlyBudget = 500000 as Minor;

export type CategorySpend = {
  /** 'other' is the folded tail, not the Other category. */
  id: CategoryId | 'other';
  label: string;
  amount: Minor;
  tone: ChartTone;
};

export type TrendMonth = {
  id: string;
  /** Short axis label. */
  label: string;
  spent: Minor;
};

export type CardUtilisation = {
  id: string;
  name: string;
  cycleSpend: Minor;
  creditLimit: Minor;
  daysToStatement: number;
};

export type TopItem = {
  id: string;
  item: string;
  categoryId: CategoryId;
  categoryLabel: string;
  categoryIcon: string;
  categoryTone: string;
  count: number;
  amount: Minor;
};

export type InsightsOverview = {
  period: string;
  totalSpent: Minor;
  monthlyBudget: Minor;
  byCategory: CategorySpend[];
  trend: TrendMonth[];
  cards: CardUtilisation[];
  topItems: TopItem[];
};

export const insightsOverview: InsightsOverview = {
  period: 'August 2026',
  totalSpent: 318460 as Minor,
  monthlyBudget,
  byCategory: [
    { id: 'housing', label: 'Housing', amount: 85000 as Minor, tone: 'chart-2' },
    { id: 'food', label: 'Food', amount: 74240 as Minor, tone: 'chart-3' },
    { id: 'shopping', label: 'Shopping', amount: 63115 as Minor, tone: 'chart-1' },
    { id: 'bills', label: 'Bills', amount: 52890 as Minor, tone: 'chart-5' },
    { id: 'other', label: 'Other', amount: 43215 as Minor, tone: 'chart-4' },
  ],
  trend: [
    { id: '2026-03', label: 'Mar', spent: 274010 as Minor },
    { id: '2026-04', label: 'Apr', spent: 316040 as Minor },
    { id: '2026-05', label: 'May', spent: 258575 as Minor },
    { id: '2026-06', label: 'Jun', spent: 291020 as Minor },
    { id: '2026-07', label: 'Jul', spent: 340280 as Minor },
    { id: '2026-08', label: 'Aug', spent: 318460 as Minor },
  ],
  cards: [
    { id: 'c-1', name: 'HDFC Millennia', cycleSpend: 184025 as Minor, creditLimit: 400000 as Minor, daysToStatement: 9 },
    { id: 'c-2', name: 'ICICI Amazon Pay', cycleSpend: 261050 as Minor, creditLimit: 300000 as Minor, daysToStatement: 21 },
  ],
  topItems: [
    { id: 't-1', item: 'Rent', categoryId: 'housing', categoryLabel: 'Housing', categoryIcon: 'House', categoryTone: 'iris', count: 1, amount: 85000 as Minor },
    { id: 't-2', item: 'Swiggy', categoryId: 'food', categoryLabel: 'Food', categoryIcon: 'UtensilsCrossed', categoryTone: 'accent', count: 11, amount: 38420 as Minor },
    { id: 't-3', item: 'Groceries', categoryId: 'shopping', categoryLabel: 'Shopping', categoryIcon: 'ShoppingBag', categoryTone: 'foreground', count: 6, amount: 31260 as Minor },
    { id: 't-4', item: 'Electricity Bill', categoryId: 'bills', categoryLabel: 'Bills', categoryIcon: 'Lightbulb', categoryTone: 'warning', count: 1, amount: 24540 as Minor },
    { id: 't-5', item: 'Uber', categoryId: 'transport', categoryLabel: 'Transport', categoryIcon: 'Car', categoryTone: 'foreground', count: 14, amount: 19875 as Minor },
  ],
};
