import { rupees } from '@/domain/money';
import { isBudgetScope, splitSpend } from '@/domain/spend';

describe('splitSpend', () => {
  it('totals the budget and off-budget sides', () => {
    // D3's own example: routine spending, and a laptop kept outside the cap.
    const split = splitSpend(rupees(3650), rupees(45000));
    expect(split.totalMinor).toBe(rupees(48650));
  });

  it('gives the budget side its share of the total', () => {
    expect(splitSpend(rupees(1000), rupees(3000)).budgetShare).toBe(0.25);
  });

  it('is all budget when nothing was spent outside it', () => {
    const split = splitSpend(rupees(3650), rupees(0));
    expect(split.totalMinor).toBe(rupees(3650));
    expect(split.budgetShare).toBe(1);
  });

  it('is all off-budget when nothing counted toward the budget', () => {
    expect(splitSpend(rupees(0), rupees(45000)).budgetShare).toBe(0);
  });

  it('has no share to report for an empty month, rather than dividing by zero', () => {
    const split = splitSpend(rupees(0), rupees(0));
    expect(split.totalMinor).toBe(0);
    expect(split.budgetShare).toBe(0);
  });
});

describe('isBudgetScope', () => {
  it('accepts the two scopes and nothing else', () => {
    expect(isBudgetScope('budget')).toBe(true);
    expect(isBudgetScope('off-budget')).toBe(true);
    expect(isBudgetScope('all')).toBe(false);
    expect(isBudgetScope(undefined)).toBe(false);
  });
});
