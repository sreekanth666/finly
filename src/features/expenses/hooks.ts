/**
 * The expense feed, detail and entry.
 *
 * Every hook here names the tables whose writes should invalidate it, including
 * the ones it only joins to: a renamed category has to reach a feed row that
 * merely displays it, and a new settlement has to reach the row whose effective
 * amount it changes.
 */

import { groupByLocalDay, type DayGroup } from '@/domain/feed';

import { useDbQuery, type TableName } from '@/db/live';
import {
  countExpenses,
  getExpenseDetail,
  lastUsedAccountId,
  listExpensePage,
  listRecentExpenses,
  listRecentItems,
  type ExpenseDetail,
  type ExpenseFilter,
  type ExpenseListItem,
} from '@/db/repositories/expenses';
import { listSettlements, type SettlementListItem } from '@/db/repositories/settlements';

/* A feed row shows its category and account, and its amount depends on
   settlements, so all four tables invalidate it. */
const FEED_TABLES: readonly TableName[] = ['expenses', 'settlements', 'categories', 'accounts'];
const DETAIL_TABLES: readonly TableName[] = ['expenses', 'settlements', 'categories', 'accounts'];

/** Serialises a filter into the query key. Order is fixed so it stays stable. */
const filterKey = (filter: ExpenseFilter): string =>
  [
    filter.period ?? '',
    (filter.categoryIds ?? []).join('|'),
    (filter.accountIds ?? []).join('|'),
    filter.search ?? '',
    filter.budgetOnly === true ? '1' : '0',
  ].join('~');

export type ExpenseFeed = {
  groups: DayGroup<ExpenseListItem>[];
  total: number;
  /** True when there are more rows beyond the ones loaded. */
  hasMore: boolean;
};

export function useExpenseFeed(filter: ExpenseFilter, limit: number) {
  return useDbQuery<ExpenseFeed>(
    `feed:${filterKey(filter)}:${limit}`,
    FEED_TABLES,
    (database) => {
      const rows = listExpensePage(filter, { limit, offset: 0 }, database);
      const total = countExpenses(filter, database);

      return {
        groups: groupByLocalDay(rows),
        total,
        hasMore: rows.length < total,
      };
    },
  );
}

export function useRecentExpenses(limit: number) {
  return useDbQuery<ExpenseListItem[]>(`recent:${limit}`, FEED_TABLES, (database) =>
    listRecentExpenses(limit, database),
  );
}

export type ExpenseDetailView = {
  expense: ExpenseDetail;
  settlements: SettlementListItem[];
} | null;

export function useExpenseDetail(id: string) {
  return useDbQuery<ExpenseDetailView>(`expense:${id}`, DETAIL_TABLES, (database) => {
    const expense = getExpenseDetail(id, database);
    if (expense === null) return null;
    return { expense, settlements: listSettlements(id, database) };
  });
}

export type EntryDefaults = {
  /** The account the last expense was paid from (§7.2). */
  accountId: string | null;
  /** Recent descriptions, for the suggestions under the item field. */
  recentItems: string[];
};

export function useEntryDefaults(suggestionCount = 8) {
  return useDbQuery<EntryDefaults>(
    `entry-defaults:${suggestionCount}`,
    ['expenses'],
    (database) => ({
      accountId: lastUsedAccountId(database),
      recentItems: listRecentItems(suggestionCount, database),
    }),
  );
}
