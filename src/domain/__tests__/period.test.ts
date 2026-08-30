import {
  addPeriods,
  clampDayToMonth,
  comparePeriods,
  currentPeriod,
  dayKey,
  daysBetween,
  daysInMonth,
  formatDateLong,
  formatDayLabel,
  formatPeriodLong,
  formatPeriodShort,
  formatTime,
  isPeriodKey,
  parsePeriod,
  periodBounds,
  periodKey,
  periodOf,
  periodsBetween,
  shouldReplaceDirtyPeriod,
  startOfLocalDay,
  statementDateIn,
} from '@/domain/period';

/** Local-time constructor, so a test never has to reason about the zone offset. */
const at = (
  year: number,
  month1: number,
  day: number,
  hour = 0,
  minute = 0,
): number => new Date(year, month1 - 1, day, hour, minute).getTime();

describe('periodOf', () => {
  it('reads the local calendar, at both ends of a month', () => {
    expect(periodOf(at(2026, 3, 1, 0, 0))).toBe('2026-03');
    expect(periodOf(at(2026, 3, 1, 0, 30))).toBe('2026-03');
    expect(periodOf(at(2026, 3, 31, 23, 59))).toBe('2026-03');
    expect(periodOf(at(2026, 2, 28, 23, 59))).toBe('2026-02');
  });

  it('does not fall back a day the way toISOString would', () => {
    // The regression this module exists to prevent: east of UTC, local midnight
    // on the 1st is still the previous month in UTC.
    const firstOfMarch = at(2026, 3, 1, 0, 30);
    const naive = new Date(firstOfMarch).toISOString().slice(0, 7);
    const offsetMinutes = new Date(firstOfMarch).getTimezoneOffset();

    expect(periodOf(firstOfMarch)).toBe('2026-03');
    if (offsetMinutes < 0) {
      // Only east of UTC does the naive form actually differ — assert that it
      // does, so this test proves the hazard rather than merely surviving it.
      expect(naive).toBe('2026-02');
    }
  });
});

describe('period keys', () => {
  it('formats, parses and validates', () => {
    expect(periodKey(2026, 3)).toBe('2026-03');
    expect(periodKey(2026, 12)).toBe('2026-12');
    expect(parsePeriod('2026-03')).toEqual({ year: 2026, month: 3 });

    expect(isPeriodKey('2026-03')).toBe(true);
    expect(isPeriodKey('2026-13')).toBe(false);
    expect(isPeriodKey('2026-00')).toBe(false);
    expect(isPeriodKey('2026-3')).toBe(false);
    expect(isPeriodKey('March 2026')).toBe(false);

    expect(() => parsePeriod('2026-13')).toThrow(RangeError);
  });

  it('sorts lexicographically, which is also the SQL ordering', () => {
    expect(comparePeriods('2026-02', '2026-10')).toBe(-1);
    expect(comparePeriods('2027-01', '2026-12')).toBe(1);
    expect(comparePeriods('2026-05', '2026-05')).toBe(0);
    expect(['2026-10', '2026-02', '2025-12'].sort(comparePeriods)).toEqual([
      '2025-12',
      '2026-02',
      '2026-10',
    ]);
  });
});

describe('periodBounds', () => {
  it('is half-open, so adjacent months cannot double-count midnight', () => {
    const february = periodBounds('2026-02');
    const march = periodBounds('2026-03');

    expect(february.startMs).toBe(at(2026, 2, 1));
    expect(february.endMs).toBe(at(2026, 3, 1));
    expect(february.endMs).toBe(march.startMs);
  });

  it('covers the last instant of the month and excludes the next', () => {
    const { startMs, endMs } = periodBounds('2026-02');
    expect(at(2026, 2, 28, 23, 59)).toBeGreaterThanOrEqual(startMs);
    expect(at(2026, 2, 28, 23, 59)).toBeLessThan(endMs);
    expect(at(2026, 3, 1, 0, 0)).toBe(endMs);
  });
});

describe('addPeriods', () => {
  it('crosses year boundaries in both directions', () => {
    expect(addPeriods('2026-12', 1)).toBe('2027-01');
    expect(addPeriods('2026-01', -1)).toBe('2025-12');
    expect(addPeriods('2026-03', 0)).toBe('2026-03');
    expect(addPeriods('2026-03', 12)).toBe('2027-03');
    expect(addPeriods('2026-03', -15)).toBe('2024-12');
  });
});

describe('periodsBetween', () => {
  it('is dense and inclusive, so an empty month is still walked', () => {
    expect(periodsBetween('2026-01', '2026-04')).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
    ]);
  });

  it('spans a year boundary', () => {
    expect(periodsBetween('2025-11', '2026-02')).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  it('returns a single period, and nothing for an inverted range', () => {
    expect(periodsBetween('2026-03', '2026-03')).toEqual(['2026-03']);
    expect(periodsBetween('2026-04', '2026-01')).toEqual([]);
  });
});

describe('formatting', () => {
  it('names months without Intl', () => {
    expect(formatPeriodLong('2026-03')).toBe('March 2026');
    expect(formatPeriodLong('2026-12')).toBe('December 2026');
    expect(formatPeriodShort('2026-03')).toBe('Mar');
    expect(formatPeriodShort('2026-09')).toBe('Sep');
  });

  it('labels days relative to now, adding the year only when it differs', () => {
    const now = at(2026, 8, 26, 10, 0);
    expect(formatDayLabel(at(2026, 8, 26, 8, 0), now)).toBe('Today');
    expect(formatDayLabel(at(2026, 8, 25, 23, 0), now)).toBe('Yesterday');
    expect(formatDayLabel(at(2026, 8, 24), now)).toBe('Mon, 24 Aug');
    expect(formatDayLabel(at(2025, 8, 24), now)).toBe('Sun, 24 Aug 2025');
  });

  it('treats "today" as a calendar day, not the last 24 hours', () => {
    const now = at(2026, 8, 26, 0, 30);
    expect(formatDayLabel(at(2026, 8, 26, 23, 0), now)).toBe('Today');
    expect(formatDayLabel(at(2026, 8, 25, 23, 55), now)).toBe('Yesterday');
  });

  it('formats a full date and a 24-hour time', () => {
    expect(formatDateLong(at(2026, 8, 25))).toBe('Tue, 25 Aug 2026');
    expect(formatTime(at(2026, 8, 25, 11, 23))).toBe('11:23');
    expect(formatTime(at(2026, 8, 25, 9, 5))).toBe('09:05');
    expect(formatTime(at(2026, 8, 25, 0, 0))).toBe('00:00');
  });
});

describe('days', () => {
  it('keys and truncates in local time', () => {
    expect(dayKey(at(2026, 8, 4, 23, 59))).toBe('2026-08-04');
    expect(startOfLocalDay(at(2026, 8, 4, 23, 59))).toBe(at(2026, 8, 4));
  });

  it('counts calendar days rather than dividing milliseconds', () => {
    expect(daysBetween(at(2026, 8, 24), at(2026, 8, 26))).toBe(2);
    expect(daysBetween(at(2026, 8, 26, 23, 0), at(2026, 8, 27, 1, 0))).toBe(1);
    expect(daysBetween(at(2026, 12, 31), at(2027, 1, 1))).toBe(1);
  });
});

describe('statement days (§4.5)', () => {
  it('knows the length of every month, leap years included', () => {
    expect(daysInMonth(2026, 1)).toBe(31);
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2000, 2)).toBe(29);
    expect(daysInMonth(1900, 2)).toBe(28);
    expect(daysInMonth(2026, 4)).toBe(30);
  });

  it('clamps a statement day the month does not have', () => {
    expect(clampDayToMonth(2026, 2, 31)).toBe(28);
    expect(clampDayToMonth(2028, 2, 31)).toBe(29);
    expect(clampDayToMonth(2026, 2, 30)).toBe(28);
    expect(clampDayToMonth(2026, 2, 29)).toBe(28);
    expect(clampDayToMonth(2026, 4, 31)).toBe(30);
    expect(clampDayToMonth(2026, 1, 31)).toBe(31);
    expect(clampDayToMonth(2026, 3, 15)).toBe(15);
  });

  it('resolves a clamped statement date to local midnight', () => {
    expect(statementDateIn(2026, 2, 31)).toBe(at(2026, 2, 28));
    expect(statementDateIn(2028, 2, 31)).toBe(at(2028, 2, 29));
    expect(statementDateIn(2026, 4, 31)).toBe(at(2026, 4, 30));
    expect(statementDateIn(2026, 5, 12)).toBe(at(2026, 5, 12));
  });
});

describe('currentPeriod', () => {
  it('is periodOf(now)', () => {
    const now = at(2026, 8, 26, 10, 0);
    expect(currentPeriod(now)).toBe('2026-08');
    expect(currentPeriod(now)).toBe(periodOf(now));
  });
});

describe('shouldReplaceDirtyPeriod', () => {
  it('records the first dirty period', () => {
    expect(shouldReplaceDirtyPeriod(null, '2026-08')).toBe(true);
  });

  it('keeps the earliest, since the recompute walks forward from it', () => {
    expect(shouldReplaceDirtyPeriod('2026-08', '2026-03')).toBe(true);
    expect(shouldReplaceDirtyPeriod('2026-03', '2026-08')).toBe(false);
    expect(shouldReplaceDirtyPeriod('2026-03', '2026-03')).toBe(false);
  });

  it('treats a blank marker as nothing recorded', () => {
    /*
     * The regression this exists for: clearing the marker by writing '' left a
     * row that reads back as a value, so the guard saw '' < any period and
     * returned early on every subsequent mark. The carry-over recompute — and
     * with it §4.3's "a past month changed" notice — silently stopped working
     * after the very first flush.
     */
    expect(shouldReplaceDirtyPeriod('', '2026-08')).toBe(true);
    expect(shouldReplaceDirtyPeriod('', '1970-01')).toBe(true);
  });
});
