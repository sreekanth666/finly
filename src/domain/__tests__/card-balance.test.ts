import { cardBalance, cardOwed, isSamePayment, PAYMENT_MATCH_WINDOW_MS } from '@/domain/card-balance';
import { rupees } from '@/domain/money';

const LIMIT = rupees(40000);

describe('cardOwed', () => {
  it('is what was owed at the anchor, plus spending since, minus payments since', () => {
    const anchor = { owedMinor: rupees(18450), at: 0 };
    expect(cardOwed(anchor, rupees(3200), rupees(18450))).toBe(rupees(3200));
  });

  it('goes negative when more was paid than owed — the card is in credit', () => {
    const anchor = { owedMinor: rupees(1000), at: 0 };
    expect(cardOwed(anchor, rupees(0), rupees(1500))).toBe(rupees(-500));
  });
});

describe('cardBalance', () => {
  it('measures a card that is not tracked by its cycle spend, exactly as D6 did', () => {
    const balance = cardBalance({
      creditLimitMinor: LIMIT,
      cycleSpendMinor: rupees(24000),
      anchor: null,
      spentSinceMinor: rupees(99999),
      paidSinceMinor: rupees(99999),
    });

    expect(balance.owedMinor).toBeNull();
    expect(balance.usedMinor).toBe(rupees(24000));
    expect(balance.utilisation).toBe(0.6);
    expect(balance.band).toBe('high');
  });

  it('measures a tracked card by what it owes, not by what the cycle spent', () => {
    const balance = cardBalance({
      creditLimitMinor: LIMIT,
      cycleSpendMinor: rupees(24000),
      anchor: { owedMinor: rupees(30000), at: 0 },
      spentSinceMinor: rupees(9800),
      paidSinceMinor: rupees(22000),
    });

    expect(balance.owedMinor).toBe(rupees(17800));
    expect(balance.usedMinor).toBe(rupees(17800));
    expect(balance.band).toBe('healthy');
  });

  it('uses none of the limit while the card is in credit', () => {
    const balance = cardBalance({
      creditLimitMinor: LIMIT,
      cycleSpendMinor: rupees(0),
      anchor: { owedMinor: rupees(0), at: 0 },
      spentSinceMinor: rupees(0),
      paidSinceMinor: rupees(500),
    });

    expect(balance.owedMinor).toBe(rupees(-500));
    expect(balance.usedMinor).toBe(0);
    expect(balance.utilisation).toBe(0);
    expect(balance.band).toBe('healthy');
  });

  it('keeps the utilisation bands, so a card near its limit still reads as critical', () => {
    const balance = cardBalance({
      creditLimitMinor: LIMIT,
      cycleSpendMinor: rupees(0),
      anchor: { owedMinor: rupees(36000), at: 0 },
      spentSinceMinor: rupees(0),
      paidSinceMinor: rupees(0),
    });

    expect(balance.band).toBe('critical');
  });
});

describe('isSamePayment', () => {
  const day = 86_400_000;
  const recorded = { amountMinor: rupees(22000), paidAt: 10 * day };

  it('matches the second alert for one payment', () => {
    expect(isSamePayment(recorded, { amountMinor: rupees(22000), occurredAt: 11 * day })).toBe(true);
  });

  it('matches at the edge of the window and not past it', () => {
    expect(
      isSamePayment(recorded, { amountMinor: rupees(22000), occurredAt: 10 * day + PAYMENT_MATCH_WINDOW_MS }),
    ).toBe(true);
    expect(
      isSamePayment(recorded, { amountMinor: rupees(22000), occurredAt: 10 * day + PAYMENT_MATCH_WINDOW_MS + 1 }),
    ).toBe(false);
  });

  it('does not match a different amount', () => {
    expect(isSamePayment(recorded, { amountMinor: rupees(21999), occurredAt: 10 * day })).toBe(false);
  });
});
