import { rupees, ZERO_MINOR } from '@/domain/money';
import { settledTotal, summariseSettlements } from '@/domain/settlement';

describe('settledTotal', () => {
  it('sums, and is zero for nothing', () => {
    expect(settledTotal([rupees(100), rupees(250)])).toBe(rupees(350));
    expect(settledTotal([])).toBe(ZERO_MINOR);
  });
});

describe('summariseSettlements', () => {
  it('leaves an unsettled expense alone', () => {
    const summary = summariseSettlements(rupees(500), ZERO_MINOR);
    expect(summary).toEqual({
      settledMinor: ZERO_MINOR,
      effectiveMinor: rupees(500),
      isSettled: false,
      isPartlySettled: false,
    });
  });

  it('reduces an expense by a partial return', () => {
    const summary = summariseSettlements(rupees(500), rupees(200));
    expect(summary.effectiveMinor).toBe(rupees(300));
    expect(summary.isPartlySettled).toBe(true);
    expect(summary.isSettled).toBe(false);
  });

  it('reads as zero once fully returned — the recharge case (§4.3)', () => {
    const summary = summariseSettlements(rupees(500), rupees(500));
    expect(summary.effectiveMinor).toBe(ZERO_MINOR);
    expect(summary.isSettled).toBe(true);
    expect(summary.isPartlySettled).toBe(false);
  });

  it('clamps an over-settled expense rather than going negative', () => {
    // The repository forbids this, but a restored backup could still carry it.
    const summary = summariseSettlements(rupees(500), rupees(900));
    expect(summary.settledMinor).toBe(rupees(500));
    expect(summary.effectiveMinor).toBe(ZERO_MINOR);
    expect(summary.isSettled).toBe(true);
  });

  it('is exact to the paise', () => {
    expect(summariseSettlements(rupees(0.05), rupees(0.02)).effectiveMinor).toBe(rupees(0.03));
  });
});
