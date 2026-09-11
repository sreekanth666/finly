import { dayKey } from '@/domain/period';
import {
  DEFAULT_REMINDER_TIME,
  formatReminderTime,
  parseReminderTime,
  planReminders,
  REMINDER_DAYS,
  REMINDER_ID_PREFIX,
  REMINDER_MESSAGES,
  STILL_THERE_MESSAGE,
} from '@/domain/reminders';

/** Local-time constructor, so a test never has to reason about the zone offset. */
const at = (year: number, month1: number, day: number, hour = 0, minute = 0) =>
  new Date(year, month1 - 1, day, hour, minute).getTime();

const NINE_PM = { hour: 21, minute: 0 };

describe('parseReminderTime', () => {
  it('reads a stored HH:mm', () => {
    expect(parseReminderTime('07:05')).toEqual({ hour: 7, minute: 5 });
    expect(parseReminderTime('23:59')).toEqual({ hour: 23, minute: 59 });
    expect(parseReminderTime('00:00')).toEqual({ hour: 0, minute: 0 });
  });

  it('falls back to the default for nothing stored, or anything malformed', () => {
    const fallback = parseReminderTime(DEFAULT_REMINDER_TIME);
    expect(fallback).toEqual(NINE_PM);

    for (const value of [null, '', '9pm', '24:00', '12:60', '7:5', '07:05:00']) {
      expect(parseReminderTime(value)).toEqual(fallback);
    }
  });

  it('round-trips through formatReminderTime', () => {
    expect(formatReminderTime({ hour: 7, minute: 5 })).toBe('07:05');
    expect(parseReminderTime(formatReminderTime({ hour: 18, minute: 30 }))).toEqual({
      hour: 18,
      minute: 30,
    });
  });
});

describe('planReminders', () => {
  const morning = at(2026, 9, 11, 10);

  it('plans one reminder a day at the chosen local time, starting today', () => {
    const plan = planReminders({ time: NINE_PM, loggedToday: false, now: morning });

    expect(plan).toHaveLength(REMINDER_DAYS);
    expect(plan[0].fireAt).toBe(at(2026, 9, 11, 21));
    expect(plan[1].fireAt).toBe(at(2026, 9, 12, 21));
    expect(plan.at(-1)?.fireAt).toBe(at(2026, 9, 11 + REMINDER_DAYS - 1, 21));
  });

  it('names each reminder after its day, so rescheduling replaces rather than duplicates', () => {
    const plan = planReminders({ time: NINE_PM, loggedToday: false, now: morning });

    expect(plan[0].id).toBe(`${REMINDER_ID_PREFIX}2026-09-11`);
    expect(new Set(plan.map((reminder) => reminder.id)).size).toBe(plan.length);
  });

  it('skips today once something has been logged', () => {
    const plan = planReminders({ time: NINE_PM, loggedToday: true, now: morning });

    expect(plan).toHaveLength(REMINDER_DAYS - 1);
    expect(plan[0].fireAt).toBe(at(2026, 9, 12, 21));
  });

  it('skips today once the time has passed, including the exact minute', () => {
    const late = planReminders({ time: NINE_PM, loggedToday: false, now: at(2026, 9, 11, 22) });
    expect(late[0].fireAt).toBe(at(2026, 9, 12, 21));

    const onTheDot = planReminders({ time: NINE_PM, loggedToday: false, now: at(2026, 9, 11, 21) });
    expect(onTheDot[0].fireAt).toBe(at(2026, 9, 12, 21));
  });

  it('never repeats the same message two days running', () => {
    const plan = planReminders({ time: NINE_PM, loggedToday: false, now: morning });

    for (let index = 1; index < plan.length - 1; index += 1) {
      expect(plan[index].title).not.toBe(plan[index - 1].title);
    }
  });

  it('gives a day the same message however often it is rescheduled', () => {
    const early = planReminders({ time: NINE_PM, loggedToday: false, now: morning });
    const later = planReminders({ time: NINE_PM, loggedToday: true, now: at(2026, 9, 11, 23) });

    const tomorrow = (plan: typeof early) =>
      plan.find((reminder) => reminder.id === `${REMINDER_ID_PREFIX}2026-09-12`);

    expect(tomorrow(later)?.title).toBe(tomorrow(early)?.title);
    expect(tomorrow(later)?.body).toBe(tomorrow(early)?.body);
  });

  it('draws every day but the last from the rotating set', () => {
    const plan = planReminders({ time: NINE_PM, loggedToday: false, now: morning });
    const titles = REMINDER_MESSAGES.map((message) => message.title);

    for (const reminder of plan.slice(0, -1)) {
      expect(titles).toContain(reminder.title);
    }
  });

  it('ends on a "still there?" message, since it only fires if the app went unopened', () => {
    const plan = planReminders({ time: NINE_PM, loggedToday: false, now: morning });

    expect(plan.at(-1)?.title).toBe(STILL_THERE_MESSAGE.title);
    expect(plan.at(-1)?.body).toBe(STILL_THERE_MESSAGE.body);
  });

  it('keeps the wall-clock time across a DST change', () => {
    /* The US springs forward on 14 March 2027. In a zone without DST this is
       an ordinary week, which is fine — `pnpm test:tz` runs it in both. */
    const plan = planReminders({ time: NINE_PM, loggedToday: false, now: at(2027, 3, 10, 9) });

    for (const reminder of plan) {
      const fired = new Date(reminder.fireAt);
      expect([fired.getHours(), fired.getMinutes()]).toEqual([21, 0]);
    }
    expect(plan.map((reminder) => dayKey(reminder.fireAt))).toContain('2027-03-14');
  });

  it('carries no amounts, so it never needs the money formatter', () => {
    for (const message of [...REMINDER_MESSAGES, STILL_THERE_MESSAGE]) {
      expect(`${message.title} ${message.body}`).not.toMatch(/\d/);
    }
  });
});
