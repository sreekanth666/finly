/**
 * Budget and carry-over — §4.4 of the MVP plan, pure and storage-free.
 *
 *   carryOver(P) = max(0, spent(P−1) − available(P−1))   // overspend only
 *   available(P) = budget(P) − carryOver(P)
 *   remaining(P) = available(P) − spent(P)
 *
 * Two properties this encodes deliberately, because both are easy to get wrong:
 *
 * - Carry-over is **overspend only** (D2). An underspent month banks nothing, so
 *   a frugal January can't license a blowout in February.
 * - It **compounds**. `available(P−1)` already carries its own deduction, so two
 *   bad months in a row bite twice.
 */

export type Period = {
  /** 'YYYY-MM'. */
  period: string;
  label: string;
  budget: number;
  spent: number;
};

export type PeriodResult = Period & {
  /** Overspend inherited from the month before. */
  carryOver: number;
  /** What there was to spend: budget less the carry-over. */
  available: number;
  /** What was left. Negative means this month overspent in turn. */
  remaining: number;
  isOverspent: boolean;
};

/**
 * @param periods oldest first. The first period ever recorded carries nothing.
 */
export function buildCarryOverHistory(periods: Period[]): PeriodResult[] {
  let carryOver = 0;

  return periods.map((period) => {
    const available = period.budget - carryOver;
    const remaining = available - period.spent;
    const result: PeriodResult = {
      ...period,
      carryOver,
      available,
      remaining,
      isOverspent: remaining < 0,
    };

    carryOver = Math.max(0, period.spent - available);

    return result;
  });
}
