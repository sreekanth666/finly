import { flattenGroups, groupByLocalDay } from '@/domain/feed';

const at = (year: number, month1: number, day: number, hour = 12, minute = 0): number =>
  new Date(year, month1 - 1, day, hour, minute).getTime();

const NOW = at(2026, 8, 26, 18, 0);

const expense = (id: string, occurredAt: number) => ({ id, occurredAt });

describe('groupByLocalDay', () => {
  it('groups by local calendar day and labels each group', () => {
    const groups = groupByLocalDay(
      [
        expense('a', at(2026, 8, 26, 11)),
        expense('b', at(2026, 8, 26, 9)),
        expense('c', at(2026, 8, 25, 20)),
        expense('d', at(2026, 8, 24, 8)),
      ],
      NOW,
    );

    expect(groups.map((group) => [group.key, group.label, group.items.length])).toEqual([
      ['2026-08-26', 'Today', 2],
      ['2026-08-25', 'Yesterday', 1],
      ['2026-08-24', 'Mon, 24 Aug', 1],
    ]);
  });

  it('preserves the order the query returned, rather than re-sorting', () => {
    const groups = groupByLocalDay(
      [expense('a', at(2026, 8, 26, 11)), expense('b', at(2026, 8, 26, 9))],
      NOW,
    );
    expect(groups[0]!.items.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('keeps a day together across its midnight boundaries', () => {
    const groups = groupByLocalDay(
      [expense('late', at(2026, 8, 25, 23, 59)), expense('early', at(2026, 8, 25, 0, 1))],
      NOW,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.key).toBe('2026-08-25');
  });

  it('separates the same clock time on two different days', () => {
    const groups = groupByLocalDay(
      [expense('a', at(2026, 8, 25, 23, 59)), expense('b', at(2026, 8, 26, 0, 1))],
      NOW,
    );
    expect(groups.map((group) => group.key)).toEqual(['2026-08-25', '2026-08-26']);
  });

  it('takes the newest instant in a group as the group instant', () => {
    const groups = groupByLocalDay(
      [expense('a', at(2026, 8, 26, 9)), expense('b', at(2026, 8, 26, 11))],
      NOW,
    );
    expect(groups[0]!.occurredAt).toBe(at(2026, 8, 26, 11));
  });

  it('handles an empty feed', () => {
    expect(groupByLocalDay([], NOW)).toEqual([]);
  });
});

describe('flattenGroups', () => {
  it('emits one header per day followed by its rows', () => {
    const groups = groupByLocalDay(
      [
        expense('a', at(2026, 8, 26, 11)),
        expense('b', at(2026, 8, 26, 9)),
        expense('c', at(2026, 8, 25, 20)),
      ],
      NOW,
    );

    expect(flattenGroups(groups).map((row) => `${row.type}:${row.key}`)).toEqual([
      'header:h:2026-08-26',
      'row:a',
      'row:b',
      'header:h:2026-08-25',
      'row:c',
    ]);
  });

  it('gives every row a key distinct from every header key', () => {
    const rows = flattenGroups(groupByLocalDay([expense('a', at(2026, 8, 26))], NOW));
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
  });
});
