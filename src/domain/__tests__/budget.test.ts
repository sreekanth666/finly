import { buildCarryOverHistory, type Period } from '@/domain/budget';
import { asMinor, rupees, type Minor } from '@/domain/money';

const period = (key: string, budget: number, spent: number): Period => ({
  period: key,
  budget: rupees(budget),
  spent: rupees(spent),
});

const shape = (result: { period: string; carryOver: Minor; available: Minor; remaining: Minor }) => ({
  period: result.period,
  carryOver: result.carryOver,
  available: result.available,
  remaining: result.remaining,
});

describe('buildCarryOverHistory', () => {
  it('reproduces the worked example in §4.4', () => {
    // Jan budget 5,000 spent 5,800 → over 800
    // Feb available 5,000 − 800 = 4,200, spent 4,600 → over 400
    // Mar available 5,000 − 400 = 4,600
    const history = buildCarryOverHistory([
      period('2026-01', 5000, 5800),
      period('2026-02', 5000, 4600),
      period('2026-03', 5000, 0),
    ]);

    expect(history.map(shape)).toEqual([
      { period: '2026-01', carryOver: rupees(0), available: rupees(5000), remaining: rupees(-800) },
      { period: '2026-02', carryOver: rupees(800), available: rupees(4200), remaining: rupees(-400) },
      { period: '2026-03', carryOver: rupees(400), available: rupees(4600), remaining: rupees(4600) },
    ]);
  });

  it('carries nothing in the first period ever recorded', () => {
    const [first] = buildCarryOverHistory([period('2026-01', 5000, 9999)]);
    expect(first!.carryOver).toBe(0);
    expect(first!.available).toBe(rupees(5000));
  });

  it('banks nothing when a month underspends (D2)', () => {
    const history = buildCarryOverHistory([
      period('2026-01', 5000, 1000),
      period('2026-02', 5000, 0),
    ]);
    // 4,000 left over in January buys nothing in February.
    expect(history[1]!.carryOver).toBe(0);
    expect(history[1]!.available).toBe(rupees(5000));
  });

  it('compounds, so two bad months in a row bite twice', () => {
    const history = buildCarryOverHistory([
      period('2026-01', 5000, 6000), // over 1,000
      period('2026-02', 5000, 5000), // available 4,000, over 1,000 again
      period('2026-03', 5000, 0), // available 4,000
    ]);

    expect(history.map((result) => result.carryOver)).toEqual([
      rupees(0),
      rupees(1000),
      rupees(1000),
    ]);
    expect(history[2]!.available).toBe(rupees(4000));
  });

  it('walks an empty month rather than skipping it', () => {
    // The hazard a sparse list creates: if February is dropped because nothing
    // was spent, January's overspend lands on March at full strength instead of
    // being absorbed by February's untouched budget.
    const dense = buildCarryOverHistory([
      period('2026-01', 5000, 6000),
      period('2026-02', 5000, 0),
      period('2026-03', 5000, 0),
    ]);
    const sparse = buildCarryOverHistory([period('2026-01', 5000, 6000), period('2026-03', 5000, 0)]);

    expect(dense[2]!.available).toBe(rupees(5000));
    expect(sparse[1]!.available).toBe(rupees(4000));
    expect(dense[2]!.available).not.toBe(sparse[1]!.available);
  });

  it('flags overspend only when the month actually went over', () => {
    const history = buildCarryOverHistory([
      period('2026-01', 5000, 5000),
      period('2026-02', 5000, 5001),
    ]);
    expect(history[0]!.isOverspent).toBe(false);
    expect(history[1]!.isOverspent).toBe(true);
  });

  it('stays exact in paise over a long run', () => {
    const months = Array.from({ length: 24 }, (_, index) =>
      period(`2026-${String((index % 12) + 1).padStart(2, '0')}`, 5000, 5000.1),
    );
    const history = buildCarryOverHistory(months);

    // 10 paise over, every month, compounding — and every figure a clean integer.
    expect(history[1]!.carryOver).toBe(asMinor(10));
    expect(history[2]!.carryOver).toBe(asMinor(20));
    expect(history.every((result) => Number.isInteger(result.carryOver))).toBe(true);
  });

  it('handles an empty history', () => {
    expect(buildCarryOverHistory([])).toEqual([]);
  });
});
