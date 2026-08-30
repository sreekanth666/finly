/**
 * Grouping the transaction feed into days.
 *
 * Done in JavaScript rather than in SQL on purpose. SQLite can group by
 * `date(occurred_at / 1000, 'unixepoch', 'localtime')`, but 'localtime' reads
 * the OS zone through the platform's C library — which is not reliably the same
 * zone JavaScript sees on a React Native device — and wrapping the column in a
 * function defeats `idx_expenses_occurred` on the way past. One local-time
 * authority (domain/period.ts) is worth more than the grouping being free.
 */

import { dayKey, formatDayLabel } from './period';

export type DayGroup<T> = {
  /** 'YYYY-MM-DD' in local time. Stable across re-renders, so it is the list key. */
  key: string;
  /** 'Today' | 'Yesterday' | 'Sun, 24 Aug' */
  label: string;
  /** The newest instant in the group, for ordering. */
  occurredAt: number;
  items: T[];
};

/**
 * @param items newest first, as the query returns them. Order is preserved
 * inside each group rather than re-sorted, so the caller's ORDER BY stays the
 * single source of truth for what "newest" means when two rows share a moment.
 */
export function groupByLocalDay<T extends { occurredAt: number }>(
  items: readonly T[],
  now: number = Date.now(),
): DayGroup<T>[] {
  const groups: DayGroup<T>[] = [];
  const byKey = new Map<string, DayGroup<T>>();

  for (const item of items) {
    const key = dayKey(item.occurredAt);
    const existing = byKey.get(key);

    if (existing === undefined) {
      const group: DayGroup<T> = {
        key,
        label: formatDayLabel(item.occurredAt, now),
        occurredAt: item.occurredAt,
        items: [item],
      };
      byKey.set(key, group);
      groups.push(group);
      continue;
    }

    existing.items.push(item);
    if (item.occurredAt > existing.occurredAt) existing.occurredAt = item.occurredAt;
  }

  return groups;
}

export type FeedRow<T> =
  | { type: 'header'; key: string; label: string }
  | { type: 'row'; key: string; item: T };

/**
 * Flattens the groups into one list of fixed-height rows.
 *
 * A FlatList of variable-height day groups cannot supply `getItemLayout`, which
 * is what leaves blank space behind during a fast scroll. One level of
 * uniformly-sized items can, so the feed stays smooth past a couple of thousand
 * expenses.
 */
export function flattenGroups<T extends { id: string }>(
  groups: readonly DayGroup<T>[],
): FeedRow<T>[] {
  const rows: FeedRow<T>[] = [];

  for (const group of groups) {
    rows.push({ type: 'header', key: `h:${group.key}`, label: group.label });
    for (const item of group.items) {
      rows.push({ type: 'row', key: item.id, item });
    }
  }

  return rows;
}
