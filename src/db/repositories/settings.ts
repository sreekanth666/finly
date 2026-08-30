/**
 * The key/value settings table.
 *
 * Typed at the key, so a typo is a compile error rather than a setting that
 * silently reads back undefined forever.
 */

import { eq } from 'drizzle-orm';

import { asMinor, type Minor } from '@/domain/money';

import { db, type DbLike } from '../client';
import { settings, type SettingKey } from '../schema';

export function getSetting(key: SettingKey, database: DbLike = db): string | null {
  const row = database.select().from(settings).where(eq(settings.key, key)).get();
  return row?.value ?? null;
}

export function setSetting(key: SettingKey, value: string, database: DbLike = db): void {
  const now = Date.now();
  database
    .insert(settings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: now } })
    .run();
}

export function deleteSetting(key: SettingKey, database: DbLike = db): void {
  database.delete(settings).where(eq(settings.key, key)).run();
}

/* Typed accessors for the settings with a shape more specific than string. */

export const getFlag = (key: SettingKey, database: DbLike = db): boolean =>
  getSetting(key, database) === '1';

export const setFlag = (key: SettingKey, value: boolean, database: DbLike = db): void =>
  setSetting(key, value ? '1' : '0', database);

export function getMinorSetting(key: SettingKey, fallback: Minor, database: DbLike = db): Minor {
  const raw = getSetting(key, database);
  if (raw === null) return fallback;
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? asMinor(parsed) : fallback;
}

export const setMinorSetting = (key: SettingKey, value: Minor, database: DbLike = db): void =>
  setSetting(key, String(value), database);
