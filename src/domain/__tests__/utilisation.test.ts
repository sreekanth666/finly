import { rupees } from '@/domain/money';
import { cycleWindow, utilisation, utilisationBand } from '@/domain/utilisation';

const at = (year: number, month1: number, day: number, hour = 12): number =>
  new Date(year, month1 - 1, day, hour).getTime();

describe('cycleWindow', () => {
  it('runs from the last statement day to the next', () => {
    const window = cycleWindow(15, at(2026, 8, 20));
    expect(window.startMs).toBe(at(2026, 8, 15, 0));
    expect(window.endMs).toBe(at(2026, 9, 15, 0));
  });

  it('reaches back into the previous month before the statement day', () => {
    const window = cycleWindow(15, at(2026, 8, 10));
    expect(window.startMs).toBe(at(2026, 7, 15, 0));
    expect(window.endMs).toBe(at(2026, 8, 15, 0));
  });

  it('restarts the cycle on the statement day itself', () => {
    // "On or before today" — so a card reads near-zero on its statement day.
    const window = cycleWindow(15, at(2026, 8, 15));
    expect(window.startMs).toBe(at(2026, 8, 15, 0));
    expect(window.daysToStatement).toBe(31);
  });

  it('shifts by exactly one day either side of the statement day', () => {
    const before = cycleWindow(15, at(2026, 8, 14));
    const on = cycleWindow(15, at(2026, 8, 15));
    const after = cycleWindow(15, at(2026, 8, 16));

    expect(before.endMs).toBe(at(2026, 8, 15, 0));
    expect(on.startMs).toBe(at(2026, 8, 15, 0));
    expect(after.startMs).toBe(at(2026, 8, 15, 0));
    expect(before.daysToStatement).toBe(1);
    expect(after.daysToStatement).toBe(30);
  });

  it('clamps a 31st statement day into February', () => {
    // Mid-February, the cycle that started on 31 January runs to 28 February.
    const window = cycleWindow(31, at(2026, 2, 14));
    expect(window.startMs).toBe(at(2026, 1, 31, 0));
    expect(window.endMs).toBe(at(2026, 2, 28, 0));
  });

  it('clamps a 31st statement day into a leap February', () => {
    const window = cycleWindow(31, at(2028, 2, 14));
    expect(window.endMs).toBe(at(2028, 2, 29, 0));
  });

  it('clamps a 31st statement day into a 30-day month', () => {
    const window = cycleWindow(31, at(2026, 4, 14));
    expect(window.startMs).toBe(at(2026, 3, 31, 0));
    expect(window.endMs).toBe(at(2026, 4, 30, 0));
  });

  it('clamps at both ends of the same window', () => {
    // Late February with a 31st statement day: the window must start on the
    // clamped 28th, not on a 31 February that does not exist.
    const window = cycleWindow(31, at(2026, 3, 15));
    expect(window.startMs).toBe(at(2026, 2, 28, 0));
    expect(window.endMs).toBe(at(2026, 3, 31, 0));
  });

  it('crosses a year boundary', () => {
    const window = cycleWindow(5, at(2026, 12, 20));
    expect(window.startMs).toBe(at(2026, 12, 5, 0));
    expect(window.endMs).toBe(at(2027, 1, 5, 0));
  });

  it('always produces a window that contains today', () => {
    for (const day of [1, 5, 15, 28, 29, 30, 31]) {
      for (const month of [1, 2, 3, 4, 12]) {
        const now = at(2026, month, 14);
        const window = cycleWindow(day, now);
        expect(window.startMs).toBeLessThanOrEqual(now);
        expect(window.endMs).toBeGreaterThan(now);
      }
    }
  });
});

describe('utilisationBand', () => {
  it('bands at 60% and 85%', () => {
    expect(utilisationBand(0)).toBe('healthy');
    expect(utilisationBand(0.59)).toBe('healthy');
    expect(utilisationBand(0.6)).toBe('high');
    expect(utilisationBand(0.84)).toBe('high');
    expect(utilisationBand(0.85)).toBe('critical');
    expect(utilisationBand(1.4)).toBe('critical');
  });
});

describe('utilisation', () => {
  it('is spend over limit', () => {
    expect(utilisation(rupees(1000), rupees(4000))).toBe(0.25);
  });

  it('is zero when there is no limit, rather than Infinity', () => {
    expect(utilisation(rupees(1000), rupees(0))).toBe(0);
  });
});
