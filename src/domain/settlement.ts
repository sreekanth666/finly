/**
 * Settlement arithmetic — §4.3 of the MVP plan, pure and storage-free.
 *
 *   settled(e)   = Σ settlements for e
 *   effective(e) = max(0, amount(e) − settled(e))
 *
 * A settlement reduces the expense in the expense's own period, even when the
 * money comes back a month later (D1) — which is why this is a derived figure
 * and never a stored one. The clamp at zero mirrors the integrity rule the
 * repository layer will enforce: settlements may not exceed the expense.
 */

import type { Settlement } from '@/data/settlements';

export type SettlementSummary = {
  /** Total returned so far. */
  settled: number;
  /** What the expense still costs, after everything returned. */
  effective: number;
  isSettled: boolean;
  isPartlySettled: boolean;
};

export const settledTotal = (settlements: Settlement[]) =>
  settlements.reduce((total, settlement) => total + settlement.amount, 0);

/**
 * @param amount the expense amount, signed as the feed stores it — only its
 * magnitude matters here, since a settlement offsets the size of the expense.
 */
export function summariseSettlements(
  amount: number,
  settlements: Settlement[]
): SettlementSummary {
  const cost = Math.abs(amount);
  const settled = Math.min(settledTotal(settlements), cost);
  const effective = Math.max(0, cost - settled);

  return {
    settled,
    effective,
    isSettled: settled > 0 && effective === 0,
    isPartlySettled: settled > 0 && effective > 0,
  };
}
