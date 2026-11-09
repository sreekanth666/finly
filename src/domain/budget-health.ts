/**
 * How close a month is to its limit, and what colour that is.
 *
 * Kept apart from the colour arithmetic in color.ts: this file knows what the
 * budget means and names tokens; that one only blends strings.
 */

import type { Minor } from './money';

/** The status tokens the home card is tinted between. */
export type HealthToken = 'success' | 'warning' | 'danger';

/**
 * Green while comfortably inside the limit, turning to amber as it closes in
 * and on to red at the limit itself. The blend is continuous between stops, so
 * the card never jumps colour on a single expense.
 */
export const healthStops: readonly { at: number; token: HealthToken }[] = [
  { at: 0, token: 'success' },
  { at: 0.5, token: 'success' },
  { at: 0.8, token: 'warning' },
  { at: 1, token: 'danger' },
];

/**
 * The share of what is available that has been spent, 0–1. Overspending is
 * always 1, and so is spending against nothing; nothing spent against nothing
 * is 0, not NaN.
 */
export function budgetUsage(spent: Minor, available: Minor): number {
  if (available <= 0) return spent > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, spent / available));
}
