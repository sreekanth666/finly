import { toMonthGlance } from '@/domain/glance';
import { asMinor, rupees } from '@/domain/money';

const glance = (spent: number, available: number) =>
  toMonthGlance({ spent: rupees(spent), available: rupees(available) });

describe('toMonthGlance', () => {
  it('is empty and healthy before anything is spent', () => {
    expect(glance(0, 25000)).toMatchObject({ percent: 0, fill: 0, tone: 'healthy' });
  });

  it('rounds the percentage down, so it never claims more than was spent', () => {
    expect(glance(18725, 25000)).toMatchObject({ percent: 74, fill: 0.749 });
    // 99.996% is not yet the whole budget.
    expect(toMonthGlance({ spent: asMinor(99_996), available: asMinor(100_000) }).percent).toBe(99);
  });

  it('does not lose a point to floating point', () => {
    // 0.29 * 100 is 28.999999999999996 — a naive floor reads 28.
    expect(toMonthGlance({ spent: asMinor(29), available: asMinor(100) }).percent).toBe(29);
    expect(toMonthGlance({ spent: asMinor(57), available: asMinor(100) }).percent).toBe(57);
  });

  it('shares its bands with card utilisation', () => {
    expect(glance(5999, 10000).tone).toBe('healthy');
    expect(glance(6000, 10000).tone).toBe('high');
    expect(glance(8499, 10000).tone).toBe('high');
    expect(glance(8500, 10000).tone).toBe('critical');
  });

  it('is critical, not over, at exactly the budget', () => {
    expect(glance(25000, 25000)).toMatchObject({ percent: 100, fill: 1, tone: 'critical' });
  });

  it('reports the real percentage past the budget with the line full', () => {
    expect(glance(28000, 25000)).toMatchObject({ percent: 112, fill: 1, tone: 'over' });
  });

  it('has no percentage when carry-over has eaten the whole budget and money went out', () => {
    expect(glance(1200, 0)).toMatchObject({ percent: null, fill: 1, tone: 'over' });
    expect(glance(1200, -800)).toMatchObject({ percent: null, fill: 1, tone: 'over' });
  });

  it('is empty when nothing is available and nothing was spent', () => {
    expect(glance(0, 0)).toMatchObject({ percent: 0, fill: 0, tone: 'healthy' });
  });

  it('carries the figures it was given through untouched', () => {
    expect(glance(18725, 25000)).toMatchObject({
      spent: rupees(18725),
      available: rupees(25000),
    });
  });
});
