/**
 * The daily logging reminder (D16): its settings, the permission behind it, and
 * the two jobs that run for the life of the app — keeping the OS's schedule in
 * step with the database, and opening add-expense when a reminder is tapped.
 */

import { router, usePathname, useRootNavigationState } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import {
  getReminderPermission,
  requestReminderPermission,
  subscribeToReminderTaps,
  syncReminders,
  type ReminderPermission,
} from './notifications';

import type { Db } from '@/db/client';
import { useDbQuery } from '@/db/live';
import { hasExpenseCreatedBetween } from '@/db/repositories/expenses';
import {
  getFlag,
  getReminderTime,
  setFlag,
  setReminderTime,
} from '@/db/repositories/settings';
import { useAction } from '@/db/use-action';
import { dayKey, startOfLocalDay } from '@/domain/period';
import type { ReminderTime } from '@/domain/reminders';

export type { ReminderPermission };

const readSettings = (database: Db) => ({
  enabled: getFlag('reminder_enabled', database),
  time: getReminderTime(database),
});

export function useReminderSettings() {
  return useDbQuery('reminders:settings', ['settings'], readSettings);
}

export function useSetReminderEnabled() {
  return useAction((enabled: boolean) => setFlag('reminder_enabled', enabled));
}

export function useSetReminderTime() {
  return useAction((time: ReminderTime) => setReminderTime(time));
}

/**
 * The OS permission, which lives outside the database and so outside
 * `useDbQuery`. Re-read whenever the app comes back to the foreground: the
 * usual way it changes is the person going to system settings and back.
 */
export function useReminderPermission() {
  const [permission, setPermission] = useState<ReminderPermission | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;
    const read = () => {
      void getReminderPermission().then((next) => {
        if (isMounted) setPermission(next);
      });
    };

    read();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') read();
    });
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  const request = useCallback(async () => {
    const next = await requestReminderPermission();
    setPermission(next);
    return next;
  }, []);

  return { permission, request };
}

/**
 * Everything the schedule depends on, read fresh on every change.
 *
 * "Today" is taken at read time rather than baked into the query key, so a
 * save just after midnight is judged against the new day even if the app has
 * been open since before it.
 */
function readSyncState(database: Db) {
  const now = Date.now();
  const start = startOfLocalDay(now);
  const day = new Date(start);
  /* Built from local fields, not `start + 24h`, which is an hour off on the
     two days a year DST changes. */
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();

  return {
    ...readSettings(database),
    loggedToday: hasExpenseCreatedBetween(start, end, database),
    today: dayKey(now),
  };
}

/**
 * Keeps the OS's scheduled reminders in step with the database, for the life
 * of the app.
 *
 * It watches the tables rather than being called from the places that write
 * them, so every way the answer can change reschedules without anyone having
 * to remember to: saving or deleting an expense, changing the setting, and
 * restoring a backup, which rewrites the settings table wholesale. Coming back
 * to the foreground re-syncs as well — the day may have rolled over, the zone
 * may have changed, or the permission may have been granted in Settings.
 */
export function useReminderSync() {
  const state = useDbQuery('reminders:sync', ['expenses', 'settings'], readSyncState);
  const { refetch } = state;

  /* Counts foreground returns, purely to re-run the sync effect below. */
  const [wakes, setWakes] = useState(0);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next) => {
      if (next !== 'active') return;
      refetch();
      setWakes((count) => count + 1);
    });
    return () => subscription.remove();
  }, [refetch]);

  /* Primitives, not the object: every read returns a new one, and a
     reschedule per animation frame is exactly what this must not do. */
  const enabled = state.data?.enabled;
  const hour = state.data?.time.hour;
  const minute = state.data?.time.minute;
  const loggedToday = state.data?.loggedToday;
  const today = state.data?.today;

  useEffect(() => {
    if (
      enabled === undefined ||
      hour === undefined ||
      minute === undefined ||
      loggedToday === undefined ||
      today === undefined
    ) {
      return;
    }
    /* Nothing to show anyone if this fails — the settings screen reports the
       permission, and the next change or foreground return tries again. */
    void syncReminders({ enabled, time: { hour, minute }, loggedToday }).catch(() => undefined);
  }, [enabled, hour, minute, loggedToday, today, wakes]);
}

/**
 * Opens add-expense when a reminder is tapped, whether that tap launched the
 * app or found it already running.
 *
 * Mounted inside AppLock, so while the app is locked this isn't mounted at
 * all, and a tap made then is picked up — as the last response — once it is
 * unlocked.
 */
export function useReminderTapRouting() {
  const [tapId, setTapId] = useState<string | null>(null);
  const pathname = usePathname();
  /* No key until the root navigator has mounted, and a push before then is
     dropped — which is exactly the cold-start case. */
  const navigatorKey = useRootNavigationState()?.key;
  const routedTapId = useRef<string | null>(null);

  useEffect(() => subscribeToReminderTaps(setTapId), []);

  useEffect(() => {
    if (tapId === null || navigatorKey === undefined) return;
    if (routedTapId.current === tapId) return;
    routedTapId.current = tapId;

    /* Read now rather than trusted from boot: someone who finished onboarding
       this session has it set, and someone mid-onboarding must stay there. */
    if (!getFlag('onboarding_done')) return;
    /* Already where the reminder would send them — don't stack a second form. */
    if (pathname === '/expense/new') return;

    router.push('/expense/new');
  }, [tapId, navigatorKey, pathname]);
}
