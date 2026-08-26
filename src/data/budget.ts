/**
 * The monthly budget and the periods behind it.
 *
 * Design-pass placeholder for the `budgets` table in §5. `carry_over_minor` is
 * a cached column there; here it is derived on read by
 * `buildCarryOverHistory`, which is the same arithmetic without the cache.
 *
 * Amounts are still dollars — see the currency note in the Transactions work.
 * §4.1 puts the app on ₹ with Indian grouping, which lands with the money
 * module in M0/M1 and changes every screen at once rather than this one.
 */

import type { Period } from '@/domain/budget';

/** The configured monthly cap (D9 — one overall cap, no per-category budgets). */
export const monthlyBudget = 3000;

/** Oldest first, which is the order the carry-over walk needs. */
export const budgetPeriods: Period[] = [
  { period: '2026-03', label: 'March 2026', budget: monthlyBudget, spent: 2740.1 },
  { period: '2026-04', label: 'April 2026', budget: monthlyBudget, spent: 3160.4 },
  { period: '2026-05', label: 'May 2026', budget: monthlyBudget, spent: 2585.75 },
  { period: '2026-06', label: 'June 2026', budget: monthlyBudget, spent: 2910.2 },
  { period: '2026-07', label: 'July 2026', budget: monthlyBudget, spent: 3402.8 },
  { period: '2026-08', label: 'August 2026', budget: monthlyBudget, spent: 3184.6 },
];
