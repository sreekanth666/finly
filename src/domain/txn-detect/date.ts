/**
 * When it happened, from whichever of a dozen date formats the sender uses.
 *
 * `02-Sep-26`, `10/09/26`, `10Sep26`, `2026-09-03:14:22:10`, `02 Sep 07:12 PM`,
 * `12 September 2026 at 08:30 PM`, `09-SEP-2026`. Indian issuers write the day
 * first, always; the only exception honoured is a middle number over 12, which
 * cannot be a month.
 *
 * `parseCsvDate` is not reused: it wants a four-digit year, and half of these
 * have two digits or none.
 *
 * - No year: the most recent such date that is not in the future relative to
 *   when the message arrived. "30 Dec" received on 1 January is last year's.
 * - A date but no time: if it is the day the message arrived, the arrival time
 *   is the best guess there is; otherwise local noon, which survives a DST shift
 *   without changing day (the same reasoning as `parseCsvDate`).
 * - Nothing readable, or something implausible: when it arrived.
 */

import { dayKey, daysInMonth } from '@/domain/period';

import type { DateConfidence } from './types';

export type DateReading = { occurredAt: number; confidence: DateConfidence; implausible: boolean };

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const ISO = /\b(\d{4})-(\d{2})-(\d{2})(?:[ T:](\d{2}):(\d{2})(?::\d{2})?)?/;
const NUMERIC = /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/;
const TEXTUAL =
  /\b(\d{1,2})(?:st|nd|rd|th)?[\s\-/]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?(?:[\s\-/,]*(\d{4}|\d{2})(?![\d:]))?/i;
const TIME = /^[\s,:T-]*(?:at\s+)?(\d{1,2}):(\d{2})(?::\d{2})?(?:\s*([ap])\.?m\.?)?/i;

const MS_PER_DAY = 86_400_000;
/** A message dated further ahead than this is describing the future, not a payment. */
const FUTURE_SLACK = 2 * MS_PER_DAY;
/** …and one this far back is almost certainly a misread. */
const PAST_LIMIT = 400 * MS_PER_DAY;

type Parts = { year: number | null; month: number; day: number; index: number; end: number };

function earliest(text: string): (Parts & { time: { hour: number; minute: number } | null }) | null {
  const options: (Parts & { time: { hour: number; minute: number } | null })[] = [];

  const iso = ISO.exec(text);
  if (iso !== null) {
    options.push({
      year: Number(iso[1]),
      month: Number(iso[2]),
      day: Number(iso[3]),
      index: iso.index,
      end: iso.index + iso[0].length,
      time: iso[4] === undefined ? null : { hour: Number(iso[4]), minute: Number(iso[5]) },
    });
  }

  const numeric = NUMERIC.exec(text);
  if (numeric !== null) {
    let day = Number(numeric[1]);
    let month = Number(numeric[2]);
    if (month > 12 && day <= 12) [day, month] = [month, day];
    options.push({
      year: Number(numeric[3]),
      month,
      day,
      index: numeric.index,
      end: numeric.index + numeric[0].length,
      time: null,
    });
  }

  const textual = TEXTUAL.exec(text);
  if (textual !== null) {
    options.push({
      year: textual[3] === undefined ? null : Number(textual[3]),
      month: MONTHS[textual[2].toLowerCase()],
      day: Number(textual[1]),
      index: textual.index,
      end: textual.index + textual[0].length,
      time: null,
    });
  }

  options.sort((a, b) => a.index - b.index);
  const chosen = options[0];
  if (chosen === undefined) return null;

  if (chosen.time === null) {
    const time = TIME.exec(text.slice(chosen.end, chosen.end + 20));
    if (time !== null) {
      let hour = Number(time[1]);
      const minute = Number(time[2]);
      const meridiem = time[3]?.toLowerCase();
      if (meridiem === 'p' && hour < 12) hour += 12;
      if (meridiem === 'a' && hour === 12) hour = 0;
      if (hour < 24 && minute < 60) chosen.time = { hour, minute };
    }
  }

  return chosen;
}

const fullYear = (year: number) => (year < 100 ? 2000 + year : year);

export function readDate(text: string, receivedAt: number): DateReading {
  const fallback: DateReading = { occurredAt: receivedAt, confidence: 'fallback_received', implausible: false };
  const parts = earliest(text);
  if (parts === null) return fallback;

  const { month, day, time } = parts;
  if (month < 1 || month > 12 || day < 1) return { ...fallback, implausible: true };

  const build = (year: number) =>
    time === null
      ? new Date(year, month - 1, day, 12).getTime()
      : new Date(year, month - 1, day, time.hour, time.minute).getTime();

  let year: number;
  if (parts.year === null) {
    year = new Date(receivedAt).getFullYear();
    if (build(year) > receivedAt + FUTURE_SLACK) year -= 1;
  } else {
    year = fullYear(parts.year);
  }

  if (day > daysInMonth(year, month)) return { ...fallback, implausible: true };

  let occurredAt = build(year);
  if (occurredAt > receivedAt + FUTURE_SLACK || occurredAt < receivedAt - PAST_LIMIT) {
    return { ...fallback, implausible: true };
  }

  if (time !== null) return { occurredAt, confidence: 'exact', implausible: false };

  if (dayKey(occurredAt) === dayKey(receivedAt)) occurredAt = receivedAt;
  return { occurredAt, confidence: 'day_only', implausible: false };
}
