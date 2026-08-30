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
import type { Minor } from '@/domain/money';

/** The configured monthly cap (D9 — one overall cap, no per-category budgets). */
export const monthlyBudget = 300000 as Minor;

/** Oldest first, which is the order the carry-over walk needs. */
export const budgetPeriods: Period[] = [
  { period: '2026-03', budget: monthlyBudget, spent: 274010 as Minor },
  { period: '2026-04', budget: monthlyBudget, spent: 316040 as Minor },
  { period: '2026-05', budget: monthlyBudget, spent: 258575 as Minor },
  { period: '2026-06', budget: monthlyBudget, spent: 291020 as Minor },
  { period: '2026-07', budget: monthlyBudget, spent: 340280 as Minor },
  { period: '2026-08', budget: monthlyBudget, spent: 318460 as Minor },
];
