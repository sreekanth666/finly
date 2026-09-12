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

export type SeedCategory = {
  name: string;
  icon: string;
  colorToken: string;
  chartTone: string;
};

/**
 * What a fresh install starts with. Kept here rather than in db/seed.ts, which
 * inserts it, so pure code — the rule templates, which name categories — can
 * be tested against the real list.
 *
 * §5's seed list plus Housing. The plan's list omits it, but the design pass,
 * the "Monthly rent" rule and the Insights breakdown all use it, and rent is the
 * largest single line in the spreadsheet this app is replacing — folding it into
 * Bills would hide exactly the number the user most wants to see.
 *
 * `chartTone` is pinned per category rather than assigned by rank at render
 * time, so a category keeps its colour when a quiet month reorders the chart.
 * There are exactly five slots (see tokens.css), so they cycle.
 */
export const SEED_CATEGORIES: readonly SeedCategory[] = [
  { name: 'Food', icon: 'UtensilsCrossed', colorToken: 'accent', chartTone: 'chart-1' },
  { name: 'Groceries', icon: 'ShoppingBasket', colorToken: 'income', chartTone: 'chart-2' },
  { name: 'Transport', icon: 'Car', colorToken: 'foreground', chartTone: 'chart-3' },
  { name: 'Bills', icon: 'Lightbulb', colorToken: 'warning', chartTone: 'chart-4' },
  { name: 'Shopping', icon: 'ShoppingBag', colorToken: 'foreground', chartTone: 'chart-5' },
  { name: 'Health', icon: 'HeartPulse', colorToken: 'danger', chartTone: 'chart-1' },
  { name: 'Housing', icon: 'House', colorToken: 'iris', chartTone: 'chart-2' },
  { name: 'Personal', icon: 'User', colorToken: 'muted', chartTone: 'chart-3' },
  { name: 'Other', icon: 'Ellipsis', colorToken: 'muted', chartTone: 'chart-4' },
];
