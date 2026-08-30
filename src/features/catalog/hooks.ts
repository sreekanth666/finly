/**
 * Categories and accounts, live.
 *
 * These two lists are needed by nearly every screen — the entry form's chips,
 * the feed's filters, the rules editor's actions — and in the design pass every
 * one of them computed its options at module scope, so an archived account or a
 * renamed category never reached the UI at all. They are hooks now.
 */

import { listAccounts, listCreditCards } from '@/db/repositories/accounts';
import { listCategories } from '@/db/repositories/categories';
import { useDbQuery, type TableName } from '@/db/live';
import type { AccountRow, CategoryRow } from '@/db/schema';

const CATEGORY_TABLES: readonly TableName[] = ['categories'];
const ACCOUNT_TABLES: readonly TableName[] = ['accounts'];

export function useCategories(includeArchived = false) {
  return useDbQuery<CategoryRow[]>(
    `categories:${includeArchived}`,
    CATEGORY_TABLES,
    (database) => listCategories({ includeArchived }, database),
  );
}

export function useAccounts(includeArchived = false) {
  return useDbQuery<AccountRow[]>(
    `accounts:${includeArchived}`,
    ACCOUNT_TABLES,
    (database) => listAccounts({ includeArchived }, database),
  );
}

export function useCreditCards() {
  return useDbQuery<AccountRow[]>('credit-cards', ACCOUNT_TABLES, (database) =>
    listCreditCards(database),
  );
}

/** Chip options, which is the shape every picker in the app actually wants. */
export const toOptions = <T extends { id: string; name: string }>(rows: readonly T[]) =>
  rows.map((row) => ({ id: row.id, label: row.name }));
