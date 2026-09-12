/**
 * What the transaction detector reads and what it says about it.
 *
 * Kept apart from the pipeline so the repository, the inbox and the tests can
 * name these shapes without importing any of the pattern tables.
 */

import type { Minor } from '@/domain/money';

/** One message as it reached the phone: a notification, or text the user pasted. */
export type MessageInput = {
  body: string;
  /** A notification's title. For an SMS app this is the sender or the contact name. */
  title?: string | null;
  /** An SMS sender id such as `VM-HDFCBK`, when one is known separately. */
  sender?: string | null;
  /** The app that posted the notification. Null for pasted text. */
  packageName?: string | null;
  /** When the phone received it. Every relative date is resolved against this. */
  receivedAt: number;
};

export type DetectContext = {
  /** What the app calls its user, so money sent to themselves reads as a transfer. */
  ownerName?: string | null;
};

export const DETECTION_KINDS = [
  'transaction',
  'transfer',
  'refund',
  'failed',
  'upcoming',
  'statement',
  'otp',
  'balance',
  'promo',
  'reminder',
  'unknown',
] as const;
export type DetectionKind = (typeof DETECTION_KINDS)[number];

export type Direction = 'debit' | 'credit';

export const INSTRUMENT_TYPES = ['card', 'account', 'wallet'] as const;
export type InstrumentType = (typeof INSTRUMENT_TYPES)[number];

export const CHANNELS = ['upi', 'card', 'neft', 'imps', 'rtgs', 'atm', 'autopay', 'emi'] as const;
export type Channel = (typeof CHANNELS)[number];

export const DATE_CONFIDENCES = ['exact', 'day_only', 'fallback_received'] as const;
export type DateConfidence = (typeof DATE_CONFIDENCES)[number];

export const CONFIDENCES = ['high', 'medium', 'low'] as const;
export type Confidence = (typeof CONFIDENCES)[number];

export type Detection = {
  kind: DetectionKind;
  direction: Direction | null;
  /** Null when no amount could be read — the candidate is still kept. */
  amountMinor: Minor | null;
  /** An ISO code. Not always the app's currency: a card used abroad says USD. */
  currency: string | null;
  /** Every distinct amount in the message, most likely first, for the chip picker. */
  amountCandidates: Minor[];
  occurredAt: number;
  dateConfidence: DateConfidence;
  /** The payee or payer as the message wrote it. */
  counterparty: string | null;
  /** What to propose for the expense's description. Never empty. */
  item: string;
  instrumentType: InstrumentType | null;
  /** The trailing digits of the card or account, exactly as printed. */
  instrumentTail: string | null;
  issuer: string | null;
  reference: string | null;
  channel: Channel | null;
  confidence: Confidence;
  /** Why, in short machine-readable words. For diagnostics and the tests. */
  reasons: string[];
};
