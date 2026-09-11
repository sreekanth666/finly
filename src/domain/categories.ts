/**
 * Category names, as a person means them.
 *
 * Nothing in the schema stops two categories sharing a name, and nothing should
 * have to: the CSV import and the settings screen both create them. What stops
 * duplicates is asking this first, before a create — "Pets" typed into a quick
 * sheet should find the "pets" archived last year, not start a second one that
 * splits Insights in two.
 */

const normalise = (name: string) => name.trim().toLowerCase();

/**
 * The category already called `name`, archived or not, or null.
 *
 * Whole-name matches only. "Food" must not claim "Food court", which is a
 * different thing someone deliberately asked for.
 */
export function findCategoryByName<T extends { name: string }>(
  rows: readonly T[],
  name: string,
): T | null {
  const wanted = normalise(name);
  if (wanted.length === 0) return null;

  return rows.find((row) => normalise(row.name) === wanted) ?? null;
}
