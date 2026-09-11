/**
 * Categories and accounts, live.
 *
 * These two lists are needed by nearly every screen — the entry form's chips,
 * the feed's filters, the rules editor's actions — and in the design pass every
 * one of them computed its options at module scope, so an archived account or a
 * renamed category never reached the UI at all. They are hooks now.
 */

import { listAccounts, listCreditCards } from '@/db/repositories/accounts';
import { categoriesByUse } from '@/db/repositories/expenses';
import { createOrRestoreCategory, listCategories } from '@/db/repositories/categories';
import { useDbQuery, type TableName } from '@/db/live';
import type { AccountRow, CategoryRow } from '@/db/schema';
import { useAction } from '@/db/use-action';

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

/**
 * Adding a category from anywhere — Settings, or the "New" pill in a picker.
 *
 * A name and an icon are all a person chooses. The colour and chart tone are
 * the neutral pair every user-made category has had since Settings first
 * allowed it; the seeded palette is reserved for the seeded rows. Reuses a
 * category of the same name rather than making a second one (see
 * `createOrRestoreCategory`), so `value.id` is always the one to select.
 */
export function useCreateCategory() {
  return useAction((name: string, icon: string) =>
    createOrRestoreCategory({ name, icon, colorToken: 'muted', chartTone: 'chart-5' }),
  );
}

/** Chip options, which is the shape every picker in the app actually wants. */
export const toOptions = <T extends { id: string; name: string }>(rows: readonly T[]) =>
  rows.map((row) => ({ id: row.id, label: row.name }));

/**
 * Categories with the ones actually used most at the front (§7.2).
 *
 * Falls back to the configured order for everything unused, so a fresh install
 * still gets a sensible list rather than an arbitrary one.
 */
export function useCategoriesByUse(limit = 40) {
  return useDbQuery<CategoryRow[]>(
    `categories:by-use:${limit}`,
    ['categories', 'expenses'],
    (database) => {
      const rows = listCategories({}, database);
      const ranked = categoriesByUse(limit, database);
      const rank = new Map(ranked.map((id, index) => [id, index]));

      return [...rows].sort(
        (a, b) => (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
      );
    },
  );
}
