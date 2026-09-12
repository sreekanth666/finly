/**
 * How the review inbox sorts what the detector found (D17).
 *
 * - **Needs review**: money that left, read well enough to confirm in a tap.
 * - **Maybe**: money that probably left, but something important is missing.
 * - **Money in**: credits. Finly has no income ledger (D4), so a credit's only
 *   destinations are "money back against an expense" (D1) or dismissal.
 * - **Filtered**: everything that is not spending — OTPs, offers, statements,
 *   reminders, failed payments, and transfers such as a card bill. Collapsed,
 *   never dropped, so a wrong call can be rescued.
 *
 * Only the first two count toward the badge. Salary and refunds in the count
 * would train the user to ignore it.
 */

import { formatDateLong, formatTime } from '@/domain/period';

import { appHint, isSmsApp } from './sources';
import type { Confidence, DetectionKind, Direction } from './types';

export type InboxSection = 'review' | 'maybe' | 'money_in' | 'filtered';

export const INBOX_SECTIONS: readonly InboxSection[] = ['review', 'maybe', 'money_in', 'filtered'];

const FILTERED_KINDS: readonly DetectionKind[] = [
  'transfer',
  'failed',
  'upcoming',
  'statement',
  'otp',
  'balance',
  'promo',
  'reminder',
];

/** Kinds retention may clear while still pending: nothing in them is money that moved. */
export const EPHEMERAL_KINDS: readonly DetectionKind[] = [
  'failed',
  'upcoming',
  'statement',
  'otp',
  'balance',
  'promo',
  'reminder',
];

export function sectionOf(candidate: {
  kind: DetectionKind;
  direction: Direction | null;
  confidence: Confidence;
}): InboxSection {
  if (FILTERED_KINDS.includes(candidate.kind)) return 'filtered';
  if (candidate.kind === 'refund' || candidate.direction === 'credit') return 'money_in';
  if (candidate.kind === 'unknown' || candidate.confidence === 'low') return 'maybe';
  return 'review';
}

export const countsTowardBadge = (candidate: Parameters<typeof sectionOf>[0]): boolean => {
  const section = sectionOf(candidate);
  return section === 'review' || section === 'maybe';
};

/**
 * One tap confirms only what needs nothing typed: a sure amount, in the app's
 * own currency, with a payee. A card used abroad always goes through the form,
 * because an expense is stored in one currency and nothing here converts.
 */
export const canConfirmInOneTap = (
  candidate: {
    kind: DetectionKind;
    confidence: Confidence;
    amountMinor: number | null;
    currency: string | null;
  },
  appCurrency = 'INR',
): boolean =>
  candidate.kind === 'transaction' &&
  candidate.confidence === 'high' &&
  candidate.amountMinor !== null &&
  candidate.currency === appCurrency;

/** What to call where a message came from: "SMS", "PhonePe", or the package name. */
export function sourceAppName(source: string, packageName: string | null): string {
  if (source === 'paste') return 'Pasted';
  if (source === 'share') return 'Shared';
  if (isSmsApp(packageName)) return 'SMS';
  return appHint(packageName)?.name ?? packageName ?? 'Notification';
}

/**
 * What a confirmed expense keeps of its alert: one line saying where and when
 * it arrived, then the message exactly as it was. Stored in `source_text`, not
 * the note, so search and rules never see bank boilerplate.
 */
export function sourceTextOf(message: {
  source: string;
  packageName: string | null;
  sender: string | null;
  title: string | null;
  body: string;
  receivedAt: number;
}): string {
  const from = message.sender ?? message.title;
  const header = [
    from,
    sourceAppName(message.source, message.packageName),
    `${formatDateLong(message.receivedAt)} ${formatTime(message.receivedAt)}`,
  ]
    .filter((part): part is string => part !== null && part.trim() !== '')
    .join(' · ');
  return `${header}\n${message.body.trim()}`;
}

/**
 * An OTP is kept only so a wrong "this is an OTP" call can be undone; the code
 * itself is never worth storing. Four to eight digits standing alone go.
 */
export const redactCodes = (body: string): string =>
  body.replace(/\b\d{4,8}\b/g, (run, offset: number, whole: string) => {
    const before = whole.charAt(offset - 1);
    const after = whole.slice(offset + run.length, offset + run.length + 2);
    // Part of an amount: "5000.00", "1,2000", "Rs.5000".
    if (/^[.,]\d/.test(after) || before === ',' || /(?:rs\.?|inr|₹)\s*$/i.test(whole.slice(Math.max(0, offset - 5), offset))) {
      return run;
    }
    return '••••';
  });

export const DEFAULT_RETENTION_DAYS = 30;
export const RETENTION_CHOICES: readonly number[] = [7, 30, 90, 365];
