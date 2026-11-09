/**
 * How close a month is to its limit, and what colour that is.
 *
 * Kept apart from the colour arithmetic in color.ts: this file knows what the
 * budget means and names tokens; that one only blends strings.
 */

import type { Minor } from './money';

/**
 * The three standings a month can be in. A role, not a colour: the card turns
 * each into a deep ground and a light line, and which tokens those are is the
 * theme's business.
 */
export type HealthRole = 'good' | 'watch' | 'over';

/**
 * Good while comfortably inside the limit, turning to watch as it closes in
 * and on to over at the limit itself. The blend is continuous between stops, so
 * the card never jumps colour on a single expense.
 */
export const healthStops: readonly { at: number; role: HealthRole }[] = [
  { at: 0, role: 'good' },
  { at: 0.5, role: 'good' },
  { at: 0.8, role: 'watch' },
  { at: 1, role: 'over' },
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
