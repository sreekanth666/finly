/**
 * The profile, from a screen's point of view.
 *
 * One name in the settings table. There is still no user table and no account
 * (§1); this exists so the app can address the person using it, which is the
 * whole of what "profile" means here.
 */

import { useDbQuery, type TableName } from '@/db/live';
import { countExpenses, earliestActivityPeriod } from '@/db/repositories/expenses';
import { getCurrency, getProfileName } from '@/db/repositories/settings';

import type { Currency } from '@/domain/money';
import type { PeriodKey } from '@/domain/period';

/** The stored name, or null when it has never been set or was cleared. */
export function useProfileName() {
  return useDbQuery<string | null>('profile:name', ['settings'], (database) =>
    getProfileName(database),
  );
}

export type ProfileSummary = {
  /** The month of the oldest expense, or null before anything is logged. */
  since: PeriodKey | null;
  expenseCount: number;
  currency: Currency;
};

const SUMMARY_TABLES: readonly TableName[] = ['expenses', 'settings'];

/**
 * What the app can say about someone without asking them anything.
 *
 * Every figure here is already in the database, so the profile page costs one
 * more query rather than a new column — and there is nothing here that a
 * skipped onboarding step would leave blank.
 */
export function useProfileSummary() {
  return useDbQuery<ProfileSummary>('profile:summary', SUMMARY_TABLES, (database) => ({
    since: earliestActivityPeriod(database),
    expenseCount: countExpenses({}, database),
    currency: getCurrency(database),
  }));
}
