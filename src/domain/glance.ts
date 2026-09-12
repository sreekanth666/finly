/**
 * The month at a glance — what the home-screen widget shows.
 *
 * "Used" is measured against `available`, not the raw budget, so the widget
 * always agrees with the ring on the Balance screen: carry-over from an
 * overspent month shrinks both by the same amount (§4.4).
 *
 * The bands are card utilisation's, deliberately. Two amber thresholds that
 * disagree by a few percent would read as a bug.
 */

import type { Minor } from './money';
import { utilisationBand, type UtilisationBand } from './utilisation';

export type GlanceTone = UtilisationBand | 'over';

export type MonthGlance = {
  spent: Minor;
  available: Minor;
  /**
   * Whole percent of `available` spent, rounded down so the widget never says
   * 100% before the budget is actually reached. Null when nothing is available
   * to measure against and money still went out — there is no honest figure.
   */
  percent: number | null;
  /** How much of the line to fill, 0–1. */
  fill: number;
  tone: GlanceTone;
};

export function toMonthGlance({
  spent,
  available,
}: {
  spent: Minor;
  available: Minor;
}): MonthGlance {
  if (available <= 0) {
    return spent > 0
      ? { spent, available, percent: null, fill: 1, tone: 'over' }
      : { spent, available, percent: 0, fill: 0, tone: 'healthy' };
  }

  const used = Math.max(0, spent) / available;

  return {
    spent,
    available,
    /* Integer arithmetic before the divide: `0.29 * 100` is 28.999…, and a floor
       of that shows one point less than was spent. */
    percent: Math.floor((Math.max(0, spent) * 100) / available),
    fill: Math.min(1, used),
    tone: spent > available ? 'over' : utilisationBand(used),
  };
}
