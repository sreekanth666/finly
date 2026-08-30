/**
 * Mock data for the Balance screen.
 *
 * Design-pass placeholder — shaped the way the real API response should be so
 * swapping it out later is a one-file change.
 *
 * Safe-to-spend is deliberately absent: it is derived from the selected month
 * by `buildCarryOverHistory` (§7.1), not a stored figure, so keeping a copy
 * here would be a second source of truth that could disagree with the ring.
 */

import type { Minor } from '@/domain/money';

export type StatCardData = {
  title: string;
  caption: string;
  amount: Minor;
};

export type BalanceOverview = {
  totalBalance: Minor;
  upcomingBills: StatCardData;
  autoSavings: StatCardData;
};

export const balanceOverview: BalanceOverview = {
  totalBalance: 298045 as Minor,
  upcomingBills: {
    title: 'Upcoming bills',
    caption: 'in 7 days',
    amount: 128029 as Minor,
  },
  autoSavings: {
    title: 'Auto Savings',
    caption: '53% of goal',
    amount: 32604 as Minor,
  },
};
