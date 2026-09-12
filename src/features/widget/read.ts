/**
 * What the home-screen widget shows, read in one place for both of its callers:
 * the running app, which pushes a fresh render whenever the database changes,
 * and the headless task Android wakes when the app is not running.
 */

import { db, openError, type DbLike } from '@/db/client';
import { currentBudgetStanding } from '@/db/repositories/budgets';
import { getCurrency, getFlag } from '@/db/repositories/settings';
import { toMonthGlance, type MonthGlance } from '@/domain/glance';
import type { Currency } from '@/domain/money';
import { currentPeriod, type PeriodKey } from '@/domain/period';

export type WidgetState =
  | { kind: 'glance'; period: PeriodKey; currency: Currency; glance: MonthGlance }
  /** App lock is on: a figure on the home screen would walk straight past it. */
  | { kind: 'locked'; period: PeriodKey }
  /** The database could not be read — never opened yet, or a migration pending. */
  | { kind: 'unavailable' };

export function readWidgetState(database: DbLike = db): WidgetState {
  if (getFlag('app_lock_enabled', database)) {
    return { kind: 'locked', period: currentPeriod() };
  }

  const standing = currentBudgetStanding(database);
  return {
    kind: 'glance',
    period: standing.period,
    /* Passed explicitly rather than left to the module-level active currency,
       which the headless task never sets. */
    currency: getCurrency(database),
    glance: toMonthGlance(standing),
  };
}

/**
 * For the headless task, which has no recovery screen to fall back on. A widget
 * installed before the app was ever opened, or one woken after an update whose
 * migration has not run yet, reads a schema that is missing or behind.
 */
export function safeReadWidgetState(): WidgetState {
  if (openError !== null) return { kind: 'unavailable' };
  try {
    return readWidgetState();
  } catch {
    return { kind: 'unavailable' };
  }
}
