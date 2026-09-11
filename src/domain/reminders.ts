/**
 * The daily logging reminder (D16), as a plan: which days, at what instant, and
 * saying what.
 *
 * There is no server and no background task, so nothing can ask "was anything
 * logged today?" at nine at night. The app answers it whenever it is open
 * instead — and hands the OS a fortnight of one-off reminders, rebuilt from
 * scratch every time the answer might have changed. Today's is simply left out
 * of the plan once something has been logged, which is what "skip if logged"
 * means without a server.
 *
 * Pure, so the day arithmetic — the part that goes wrong across DST — is
 * tested. Every instant is built from local calendar fields (§4.2), never by
 * adding 24 hours to the last one.
 */

import { dayKey, daysBetween } from './period';

export type ReminderTime = { hour: number; minute: number };

/** What `reminder_time` holds when nothing has been chosen: 9 PM. */
export const DEFAULT_REMINDER_TIME = '21:00';

/**
 * How far ahead the OS is given reminders. Every open of the app rebuilds the
 * plan, so this is only reached by someone who stopped opening it — and iOS
 * keeps 64 pending notifications at most, so it must stay well under that.
 */
export const REMINDER_DAYS = 14;

/** Every reminder id starts with this, so ours can be cancelled without anyone else's. */
export const REMINDER_ID_PREFIX = 'reminder:';

export type ReminderMessage = { title: string; body: string };

/**
 * Rotated one per day. No amounts, deliberately: the notification is drawn by
 * the OS, outside `domain/money.ts`, and a lock screen is not a place to show
 * what someone spent.
 */
export const REMINDER_MESSAGES: readonly ReminderMessage[] = [
  { title: 'Anything to log today?', body: 'Add today’s expenses while you still remember them.' },
  { title: 'A quick one before bed', body: 'Log what you spent today and the month stays honest.' },
  { title: 'Spent anything today?', body: 'It takes a few taps now, and saves guessing later.' },
  { title: 'Keep the month accurate', body: 'Anything you haven’t logged yet? Add it now.' },
  { title: 'End of the day', body: 'Coffee, a cab, a top-up — log anything that slipped by.' },
  { title: 'Still safe to spend?', body: 'Only if everything’s logged. Add today’s expenses.' },
];

/** The last day in the plan. It only fires if the app went unopened for two weeks. */
export const STILL_THERE_MESSAGE: ReminderMessage = {
  title: 'Haven’t seen you in a while',
  body: 'Catch up on what you’ve spent — reminders stop here until you open Finly again.',
};

export type PlannedReminder = ReminderMessage & {
  /** `reminder:YYYY-MM-DD` — one per day, so rescheduling replaces rather than stacks. */
  id: string;
  /** Epoch ms. */
  fireAt: number;
};

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** A stored `HH:mm`, or the default for nothing stored or anything malformed. */
export function parseReminderTime(value: string | null): ReminderTime {
  const match = TIME_PATTERN.exec(value ?? '') ?? TIME_PATTERN.exec(DEFAULT_REMINDER_TIME);
  return { hour: Number(match?.[1] ?? 21), minute: Number(match?.[2] ?? 0) };
}

const pad2 = (value: number) => String(value).padStart(2, '0');

export const formatReminderTime = ({ hour, minute }: ReminderTime): string =>
  `${pad2(hour)}:${pad2(minute)}`;

/**
 * A fixed local date to count days from. Counting calendar days from it gives
 * each day a number that is the same whenever it is computed, which is what
 * keeps a day's message from reshuffling on every reschedule.
 */
const ROTATION_EPOCH = new Date(2000, 0, 1).getTime();

const messageFor = (fireAt: number): ReminderMessage =>
  REMINDER_MESSAGES[daysBetween(ROTATION_EPOCH, fireAt) % REMINDER_MESSAGES.length];

export function planReminders({
  time,
  loggedToday,
  now = Date.now(),
  days = REMINDER_DAYS,
}: {
  time: ReminderTime;
  loggedToday: boolean;
  now?: number;
  days?: number;
}): PlannedReminder[] {
  const today = new Date(now);
  const plan: PlannedReminder[] = [];

  for (let offset = 0; offset < days; offset += 1) {
    /* Local fields, with the day overflowing into the next month on its own —
       the only construction that lands on 21:00 on both sides of a DST change. */
    const fireAt = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + offset,
      time.hour,
      time.minute,
    ).getTime();

    if (offset === 0 && (loggedToday || fireAt <= now)) continue;

    const message = offset === days - 1 ? STILL_THERE_MESSAGE : messageFor(fireAt);
    plan.push({ id: `${REMINDER_ID_PREFIX}${dayKey(fireAt)}`, fireAt, ...message });
  }

  return plan;
}
