/**
 * Reviewed messages as labelled examples for the detector (D19, D21).
 *
 * What a user did with a candidate is the best verdict on it there is: they
 * confirmed it as spending, settled an expense with it, recorded it as a card
 * payment, or said it is not a payment. Sent only when the user switches on
 * "Help improve detection", only as skeletons, and only with the verdict —
 * never the amount, the payee, the expense it became or when it arrived.
 *
 * Discarding is not a verdict. People discard duplicates, cash they already
 * logged and things they do not care to track, so a discarded message is sent
 * as unlabelled and never becomes a negative example.
 */

import type { CorpusGroup } from '@/domain/txn-detect/model/corpus';
import { isDltSenderId } from '@/domain/txn-detect/sources';
import { DETECTION_KINDS, type DetectionKind } from '@/domain/txn-detect/types';

import { skeletonOf } from './skeleton';

export const VERDICTS = ['spent', 'settled', 'card_payment', 'not_payment', 'dismissed', 'pending'] as const;
export type Verdict = (typeof VERDICTS)[number];

/** One stored candidate, as the repository reads it for this. */
export type ReviewedMessage = {
  body: string;
  sender: string | null;
  title: string | null;
  packageName: string | null;
  kind: string;
  status: string;
  cardPaymentId: string | null;
};

export type LabelledShape = {
  /** A DLT sender id such as `JD-HDFCBK-P`, or null. Never a contact name or a number. */
  sender: string | null;
  /** The app that posted it, SMS app included; null for pasted text. */
  packageName: string | null;
  /** How Finly read it. */
  read: string;
  verdict: Verdict;
  /** What the verdict makes it, for the corpus; null when the verdict says nothing. */
  truth: { kind: DetectionKind; group?: CorpusGroup } | null;
  skeleton: string;
};

export function verdictOf(message: Pick<ReviewedMessage, 'status' | 'cardPaymentId'>): Verdict | null {
  switch (message.status) {
    case 'confirmed':
      return message.cardPaymentId !== null ? 'card_payment' : 'spent';
    case 'settled':
      return 'settled';
    case 'not_transaction':
      return 'not_payment';
    case 'dismissed':
      return 'dismissed';
    case 'pending':
      return 'pending';
    default:
      /* A duplicate is a second copy of something already counted; it says nothing new. */
      return null;
  }
}

const MOVED: readonly string[] = ['transaction', 'transfer', 'refund'];

const asKind = (value: string): DetectionKind | null =>
  (DETECTION_KINDS as readonly string[]).includes(value) ? (value as DetectionKind) : null;

/**
 * - Confirmed as spending is a transaction, whatever it was read as.
 * - Settling an expense is money back: a refund.
 * - A card payment is a transfer (D20).
 * - "Not a payment" keeps the reading when that was already a non-payment kind
 *   (Filtered was right, the user agreed), and otherwise says only that it must
 *   not count.
 */
export function truthOf(verdict: Verdict, read: string): LabelledShape['truth'] {
  switch (verdict) {
    case 'spent':
      return { kind: 'transaction' };
    case 'settled':
      return { kind: 'refund' };
    case 'card_payment':
      return { kind: 'transfer' };
    case 'not_payment': {
      const kind = asKind(read);
      return kind !== null && !MOVED.includes(kind) && kind !== 'unknown'
        ? { kind }
        : { kind: 'unknown', group: 'must_not_count' };
    }
    default:
      return null;
  }
}

export function labelledShapeOf(message: ReviewedMessage): LabelledShape | null {
  const verdict = verdictOf(message);
  if (verdict === null) return null;
  const sender = isDltSenderId(message.sender)
    ? message.sender!.trim()
    : isDltSenderId(message.title)
      ? message.title!.trim()
      : null;
  return {
    sender,
    /* Kept for SMS apps too: a package name is an app, never a person, and
       the model reads an SMS differently from a pasted message. */
    packageName: message.packageName,
    read: message.kind,
    verdict,
    truth: truthOf(verdict, message.kind),
    skeleton: skeletonOf(message.body),
  };
}
