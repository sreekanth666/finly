/**
 * The daily reminder's side of the OS. The only file that imports
 * expo-notifications, so what the app asks of it stays small enough to read.
 *
 * Everything here is local: no push token is ever requested and nothing leaves
 * the device (D16). The OS holds a fortnight of one-off reminders; the app
 * replaces them whenever what they depend on changes.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  planReminders,
  REMINDER_ID_PREFIX,
  type ReminderTime,
} from '@/domain/reminders';

const CHANNEL_ID = 'reminders';

/** Stamped on every reminder, so a tap can be told apart from anything else. */
const REMINDER_KIND = 'daily-reminder';

/*
 * A reminder that fires while Finly is open still lands in the notification
 * list, but without the sound or banner — the person is already here. On
 * Android `shouldPlaySound: false` is what suppresses the heads-up there.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Android 13+ does not show the permission prompt at all until a channel
 * exists, so this has to run before the request, not after it. Idempotent —
 * re-creating a channel with the same id only updates its name.
 */
async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Daily reminder',
    description: 'A nudge to log the day’s expenses, skipped once you have.',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export type ReminderPermission = {
  granted: boolean;
  /** False once the OS will no longer show the prompt — only Settings can change it then. */
  canAskAgain: boolean;
};

/** Reads the permission without ever prompting. */
export async function getReminderPermission(): Promise<ReminderPermission> {
  const status = await Notifications.getPermissionsAsync();
  return { granted: status.granted, canAskAgain: status.canAskAgain };
}

/** Shows the OS prompt, when the OS still allows it. */
export async function requestReminderPermission(): Promise<ReminderPermission> {
  await ensureChannel();
  const status = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return { granted: status.granted, canAskAgain: status.canAskAgain };
}

async function cancelScheduledReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((request) => request.identifier.startsWith(REMINDER_ID_PREFIX))
      .map((request) => Notifications.cancelScheduledNotificationAsync(request.identifier)),
  );
}

export type ReminderState = {
  enabled: boolean;
  time: ReminderTime;
  loggedToday: boolean;
};

/*
 * Syncs run one at a time, and only the newest one does any work. A save, a
 * settings change and the app coming to the foreground can all ask within the
 * same second; interleaving their cancel-then-schedule steps could leave two
 * plans half-scheduled, and running each in turn would be wasted work when
 * only the last one's answer matters.
 */
let queue: Promise<void> = Promise.resolve();
let latest = 0;

/**
 * Replace every scheduled reminder with the plan for `state`. Turned off, or
 * without permission, that plan is empty — which cancels them.
 *
 * The permission is checked here rather than assumed from the setting: a
 * restored backup can bring `reminder_enabled` onto a phone that has never
 * been asked.
 */
export function syncReminders(state: ReminderState): Promise<void> {
  latest += 1;
  const ticket = latest;

  const run = queue.then(async () => {
    if (ticket !== latest) return;

    const permitted = state.enabled && (await getReminderPermission()).granted;
    await cancelScheduledReminders();
    if (!permitted) return;

    await ensureChannel();
    /* Planned now rather than when the sync was requested, so a queue that
       ran past the reminder time doesn't schedule one in the past. */
    for (const reminder of planReminders({ time: state.time, loggedToday: state.loggedToday })) {
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.id,
        content: { title: reminder.title, body: reminder.body, data: { kind: REMINDER_KIND } },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: reminder.fireAt,
          channelId: CHANNEL_ID,
        },
      });
    }
  });

  /* The chain must survive a failed sync, or every later one would reject too. */
  queue = run.catch(() => undefined);
  return run;
}

/**
 * Calls `onTap` with a unique id for every reminder the user opens — including
 * the one that launched the app from cold, which arrives before any listener
 * could have been attached. Returns the unsubscribe.
 */
export function subscribeToReminderTaps(onTap: (tapId: string) => void): () => void {
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (response === null) return;
    if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;

    const { request, date } = response.notification;
    if (request.content.data?.kind !== REMINDER_KIND) return;

    /* Cleared once handled, so a remount — AppLock unmounts its children every
       time it locks — doesn't route the same launch tap a second time. */
    Notifications.clearLastNotificationResponse();
    onTap(`${request.identifier}@${date}`);
  };

  handle(Notifications.getLastNotificationResponse());
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  return () => subscription.remove();
}
