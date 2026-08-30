/**
 * First-run data.
 *
 * Seeds the category list and the app defaults, then never runs again — guarded
 * by a settings flag rather than by counting rows, so a user who archives every
 * category doesn't find them all back the next morning.
 *
 * No accounts are seeded (§5). The user's own cards are the whole point of the
 * accounts table, and inventing a placeholder one would put a fake row in every
 * utilisation figure until they noticed.
 */

import { rupees } from '@/domain/money';

import { db, type DbLike } from './client';
import { newId } from './id';
import { categories } from './schema';
import { getSetting, setSetting } from './repositories/settings';
import { writeTransaction } from './transaction';

/** ₹5,000 a month, the figure the sheet this replaces was already using (§5). */
export const DEFAULT_MONTHLY_BUDGET = rupees(5000);

type SeedCategory = {
  name: string;
  icon: string;
  colorToken: string;
  chartTone: string;
};

/**
 * §5's seed list plus Housing. The plan's list omits it, but the design pass,
 * the "Monthly rent" rule and the Insights breakdown all use it, and rent is the
 * largest single line in the spreadsheet this app is replacing — folding it into
 * Bills would hide exactly the number the user most wants to see.
 *
 * `chartTone` is pinned per category rather than assigned by rank at render
 * time, so a category keeps its colour when a quiet month reorders the chart.
 * There are exactly five slots (see tokens.css), so they cycle.
 */
const SEED_CATEGORIES: SeedCategory[] = [
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

export function runSeed(database: DbLike = db): void {
  if (getSetting('schema_seeded', database) === '1') return;

  const now = Date.now();

  writeTransaction((tx) => {
    tx.insert(categories)
      .values(
        SEED_CATEGORIES.map((category, index) => ({
          id: newId(),
          name: category.name,
          icon: category.icon,
          colorToken: category.colorToken,
          chartTone: category.chartTone,
          isSystem: true,
          sortOrder: index,
          isArchived: false,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .run();

    setSetting('currency', 'INR', tx);
    setSetting('monthly_budget_minor', String(DEFAULT_MONTHLY_BUDGET), tx);
    setSetting('onboarding_done', '0', tx);
    setSetting('app_lock_enabled', '0', tx);
    setSetting('encryption_enabled', '0', tx);
    setSetting('schema_seeded', '1', tx);
  });
}
