/**
 * Settlement arithmetic — §4.3 of the MVP plan, pure and storage-free.
 *
 *   settled(e)   = Σ settlements for e
 *   effective(e) = max(0, amount(e) − settled(e))
 *
 * A settlement reduces the expense in the expense's own period, even when the
 * money comes back a month later (D1) — which is why this is a derived figure
 * and never a stored one.
 *
 * The clamp at the expense amount duplicates the rule the repository enforces
 * inside a transaction. Kept as defence in depth: a restored backup or a
 * hand-edited database could carry settlements that exceed their expense, and
 * that must render as ₹0 rather than as a negative expense.
 */

import { clampMinorAtZero, minMinor, subMinor, sumMinor, type Minor } from './money';

export type SettlementSummary = {
  /** Total returned so far. */
  settledMinor: Minor;
  /** What the expense still costs, after everything returned. */
  effectiveMinor: Minor;
  isSettled: boolean;
  isPartlySettled: boolean;
};

export const settledTotal = (amounts: readonly Minor[]): Minor => sumMinor(amounts);

/**
 * @param amountMinor the expense amount. Unsigned by constraint (§5), so unlike
 * the design-pass version this takes no absolute value — a negative here would
 * be a bug worth surfacing, not something to quietly paper over.
 * @param settledMinor the total already returned. Taken as a total rather than a
 * list, because the list screen gets it from a SQL SUM and must never load an
 * expense's child rows just to render one line.
 */
export function summariseSettlements(
  amountMinor: Minor,
  settledMinor: Minor,
): SettlementSummary {
  const settled = minMinor(settledMinor, amountMinor);
  const effective = clampMinorAtZero(subMinor(amountMinor, settled));

  return {
    settledMinor: settled,
    effectiveMinor: effective,
    isSettled: settled > 0 && effective === 0,
    isPartlySettled: settled > 0 && effective > 0,
  };
}
