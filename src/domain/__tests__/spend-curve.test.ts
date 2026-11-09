import { asMinor, type Minor } from '@/domain/money';
import { cumulativeDailySpend, compareToSameDay } from '@/domain/spend-curve';

/** Local-time constructor, so a test never has to reason about the zone offset. */
const at = (year: number, month1: number, day: number, hour = 12): number =>
  new Date(year, month1 - 1, day, hour).getTime();

const entry = (ms: number, minor: number) => ({
  occurredAt: ms,
  effectiveMinor: asMinor(minor),
});

describe('cumulativeDailySpend', () => {
  it('has one slot per day for 28, 29, 30 and 31 day months', () => {
    const now = at(2030, 1, 1);
    expect(cumulativeDailySpend([], '2026-02', now)).toHaveLength(28);
    expect(cumulativeDailySpend([], '2028-02', now)).toHaveLength(29);
    expect(cumulativeDailySpend([], '2026-04', now)).toHaveLength(30);
    expect(cumulativeDailySpend([], '2026-08', now)).toHaveLength(31);
  });

  it('keeps a running total across days with no spend', () => {
    const now = at(2026, 11, 30);
    const curve = cumulativeDailySpend(
      [entry(at(2026, 11, 2), 100), entry(at(2026, 11, 2, 18), 50), entry(at(2026, 11, 5), 25)],
      '2026-11',
      now,
    );
    expect(curve.slice(0, 6)).toEqual([0, 150, 150, 150, 175, 175]);
    expect(curve[29]).toBe(175);
  });

  it('stops at today in the current month, leaving the rest null', () => {
    const now = at(2026, 11, 9, 8);
    const curve = cumulativeDailySpend([entry(at(2026, 11, 3), 40)], '2026-11', now);
    expect(curve).toHaveLength(30);
    expect(curve[8]).toBe(40);
    expect(curve[9]).toBeNull();
    expect(curve.slice(9).every((value) => value === null)).toBe(true);
  });

  it('shows a value on day 1 of the current month', () => {
    const now = at(2026, 11, 1, 0);
    const curve = cumulativeDailySpend([entry(at(2026, 11, 1, 0), 10)], '2026-11', now);
    expect(curve[0]).toBe(10);
    expect(curve[1]).toBeNull();
  });

  it('fills a past month to the end', () => {
    const now = at(2026, 11, 9);
    const curve = cumulativeDailySpend([entry(at(2026, 10, 3), 70)], '2026-10', now);
    expect(curve).toHaveLength(31);
    expect(curve.every((value) => value === 70 || value === 0)).toBe(true);
    expect(curve[30]).toBe(70);
  });

  it('is all null for a month that has not started', () => {
    const curve = cumulativeDailySpend([], '2026-12', at(2026, 11, 9));
    expect(curve).toHaveLength(31);
    expect(curve.every((value) => value === null)).toBe(true);
  });

  it('ignores entries outside the month, including the midnight boundaries', () => {
    const now = at(2026, 11, 30);
    const curve = cumulativeDailySpend(
      [
        entry(at(2026, 10, 31, 23), 999),
        entry(at(2026, 12, 1, 0), 999),
        entry(at(2026, 11, 1, 0), 5),
        entry(at(2026, 11, 30, 23), 7),
      ],
      '2026-11',
      now,
    );
    expect(curve[0]).toBe(5);
    expect(curve[29]).toBe(12);
  });

  it('buckets by the local day, not the UTC day', () => {
    // 00:30 local on the 1st is the previous UTC day in any zone east of UTC.
    const now = at(2026, 11, 20);
    const curve = cumulativeDailySpend([entry(at(2026, 11, 1, 0) + 30 * 60_000, 9)], '2026-11', now);
    expect(curve[0]).toBe(9);
  });
});

describe('compareToSameDay', () => {
  const series = (...values: (number | null)[]): (Minor | null)[] =>
    values.map((value) => (value === null ? null : asMinor(value)));

  it('reports spending less than the same day last month', () => {
    const current = series(0, 70);
    const previous = series(0, 100, 150);
    expect(compareToSameDay(current, previous, 1)).toEqual({ deltaPercent: 30, direction: 'less' });
  });

  it('reports spending more', () => {
    expect(compareToSameDay(series(130), series(100), 0)).toEqual({
      deltaPercent: 30,
      direction: 'more',
    });
  });

  it('rounds to an integer', () => {
    // 2/3 less -> 66.67 -> 67
    expect(compareToSameDay(series(100), series(300), 0)).toEqual({
      deltaPercent: 67,
      direction: 'less',
    });
  });

  it('calls anything within 2 percent the same', () => {
    expect(compareToSameDay(series(102), series(100), 0).direction).toBe('same');
    expect(compareToSameDay(series(98), series(100), 0).direction).toBe('same');
    expect(compareToSameDay(series(103), series(100), 0).direction).toBe('more');
    expect(compareToSameDay(series(97), series(100), 0).direction).toBe('less');
    expect(compareToSameDay(series(100), series(100), 0)).toEqual({
      deltaPercent: 0,
      direction: 'same',
    });
  });

  it('clamps to the last day of a shorter previous month', () => {
    // 31 days this month against a 30 day last month: day 31 compares with day 30.
    const current = series(...Array.from({ length: 31 }, () => 200));
    const previous = series(...Array.from({ length: 30 }, () => 100));
    expect(compareToSameDay(current, previous, 30)).toEqual({ deltaPercent: 100, direction: 'more' });
  });

  it('has no figure when last month had spent nothing by then', () => {
    expect(compareToSameDay(series(50), series(0), 0)).toEqual({
      deltaPercent: null,
      direction: 'same',
    });
  });

  it('has no figure without a previous month', () => {
    expect(compareToSameDay(series(50), null, 0).deltaPercent).toBeNull();
    expect(compareToSameDay(series(50), [], 0).deltaPercent).toBeNull();
  });

  it('has no figure when today is not on the current curve', () => {
    expect(compareToSameDay(series(50, null), series(10, 20), 1).deltaPercent).toBeNull();
    expect(compareToSameDay(series(50), series(10, 20), 5).deltaPercent).toBeNull();
  });
});
