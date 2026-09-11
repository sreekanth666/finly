/**
 * Categories.
 *
 * No delete. Seeded rows are `is_system` (§5) and every category may already be
 * referenced by an expense, so the destructive action is archive — which hides
 * it from the pickers without orphaning history.
 */

import { asc, eq, isNull } from 'drizzle-orm';

import { findCategoryByName } from '@/domain/categories';

import { db, type DbLike } from '../client';
import { ValidationError } from '../errors';
import { newId } from '../id';
import { categories, type CategoryRow } from '../schema';
import { writeTransaction } from '../transaction';

const alive = isNull(categories.deletedAt);

export type CategoryInput = {
  name: string;
  icon: string;
  colorToken: string;
  chartTone: string;
};

export function listCategories(
  { includeArchived = false }: { includeArchived?: boolean } = {},
  database: DbLike = db,
): CategoryRow[] {
  const rows = database.select().from(categories).where(alive).orderBy(asc(categories.sortOrder)).all();
  return includeArchived ? rows : rows.filter((row) => !row.isArchived);
}

export const getCategory = (id: string, database: DbLike = db): CategoryRow | null =>
  database.select().from(categories).where(eq(categories.id, id)).get() ?? null;

function requireName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new ValidationError('name', 'A category needs a name.');
  }
  return trimmed;
}

export function createCategory(input: CategoryInput, database: DbLike = db): string {
  const id = newId();
  const now = Date.now();
  const highest = listCategories({ includeArchived: true }, database).at(-1)?.sortOrder ?? -1;

  database
    .insert(categories)
    .values({
      id,
      name: requireName(input.name),
      icon: input.icon,
      colorToken: input.colorToken,
      chartTone: input.chartTone,
      isSystem: false,
      sortOrder: highest + 1,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  return id;
}

export type CategoryCreation = {
  id: string;
  /** `existing` and `restored` mean nothing new was made — the name was taken. */
  outcome: 'created' | 'existing' | 'restored';
};

/**
 * Create a category, unless one by that name already exists — in which case
 * hand that one back, un-archiving it if it had been put away.
 *
 * This is what a picker wants: someone typing "Pets" into a quick sheet means
 * the Pets category, whether or not they remember making one. One transaction,
 * so the name check and the insert cannot be split by a second tap.
 */
export function createOrRestoreCategory(
  input: CategoryInput,
  database: DbLike = db,
): CategoryCreation {
  return writeTransaction((tx) => {
    const match = findCategoryByName(listCategories({ includeArchived: true }, tx), input.name);

    if (match === null) return { id: createCategory(input, tx), outcome: 'created' };
    if (!match.isArchived) return { id: match.id, outcome: 'existing' };

    setCategoryArchived(match.id, false, tx);
    return { id: match.id, outcome: 'restored' };
  }, database);
}

export function renameCategory(id: string, name: string, database: DbLike = db): void {
  database
    .update(categories)
    .set({ name: requireName(name), updatedAt: Date.now() })
    .where(eq(categories.id, id))
    .run();
}

export function setCategoryArchived(id: string, isArchived: boolean, database: DbLike = db): void {
  database
    .update(categories)
    .set({ isArchived, updatedAt: Date.now() })
    .where(eq(categories.id, id))
    .run();
}

/**
 * @param orderedIds every category, in the order they should appear.
 *
 * Takes the whole list rather than a single move, because `sort_order` is only
 * meaningful relative to its neighbours — writing one row's position while the
 * rest keep their old numbers is how a reorder silently half-applies.
 */
export function reorderCategories(orderedIds: readonly string[], database: DbLike = db): void {
  const now = Date.now();
  orderedIds.forEach((id, index) => {
    database
      .update(categories)
      .set({ sortOrder: index, updatedAt: now })
      .where(eq(categories.id, id))
      .run();
  });
}
