/**
 * Reading a payment alert: `detect(message)` → what, how much, when, who, and
 * how sure.
 *
 * Pure and synchronous. It runs on every captured notification, so it never
 * touches the database, the clock (everything is relative to `receivedAt`) or
 * React; suggestions that need the user's rules and accounts are `suggest`'s
 * job, one step later.
 *
 * Generic extraction first, sender hints second, and a per-bank special case
 * only when a real message in the corpus needed one. `PARSER_VERSION` goes up
 * whenever a change here could read an existing message differently, and
 * pending candidates are re-read when it does.
 */

import type { Minor } from '@/domain/money';

import { readAmounts } from './amount';
import { classify, MOVED_KINDS } from './classify';
import { labelOf, readCounterparty } from './counterparty';
import { readDate } from './date';
import { readChannel, readDirection, readInstrument, readReference } from './fields';
import { isRedacted, normaliseText } from './normalise';
import { appHint, resolveIssuer, senderHint } from './sources';
import type { Channel, Confidence, DetectContext, Detection, DetectionKind, Direction, MessageInput } from './types';

export * from './types';
export { isRedacted, normaliseText } from './normalise';
export { labelOf } from './counterparty';
export { appHint, isSmsApp, PAYMENT_APPS, SMS_APP_PACKAGES } from './sources';

export const PARSER_VERSION = 1;

/** Kinds whose date is about the future or about nothing, so the arrival time stands. */
const UNDATED_KINDS: readonly DetectionKind[] = ['statement', 'reminder', 'upcoming', 'promo', 'otp', 'balance'];

function fallbackItem(input: {
  kind: DetectionKind;
  direction: Direction | null;
  channel: Channel | null;
  text: string;
}): string {
  if (input.kind === 'refund') return /\brevers/i.test(input.text) ? 'Reversal' : 'Refund';
  if (input.channel === 'atm') return 'Cash withdrawal';
  if (input.channel === 'emi') return 'EMI';
  if (input.direction === 'credit') return 'Money received';
  switch (input.channel) {
    case 'upi':
      return 'UPI payment';
    case 'card':
      return 'Card payment';
    case 'neft':
    case 'imps':
    case 'rtgs':
      return 'Bank transfer';
    case 'autopay':
      return 'AutoPay';
    default:
      return 'Payment';
  }
}

function confidenceOf(detection: Omit<Detection, 'confidence'>, ambiguous: boolean, sourceKnown: boolean): Confidence {
  if (!MOVED_KINDS.includes(detection.kind)) return detection.kind === 'unknown' ? 'low' : 'medium';
  if (detection.amountMinor === null || detection.direction === null) return 'low';
  if (ambiguous) return 'medium';
  if (detection.currency !== 'INR') return 'medium';
  if (detection.counterparty === null) return 'medium';
  if (!sourceKnown) return 'medium';
  return 'high';
}

export function detect(input: MessageInput, context: DetectContext = {}): Detection {
  const reasons: string[] = [];
  const text = normaliseText(input.body);

  if (isRedacted(text)) {
    return {
      kind: 'unknown',
      direction: null,
      amountMinor: null,
      currency: null,
      amountCandidates: [],
      occurredAt: input.receivedAt,
      dateConfidence: 'fallback_received',
      counterparty: null,
      item: 'Hidden by Android',
      instrumentType: null,
      instrumentTail: null,
      issuer: resolveIssuer({ sender: input.sender, title: input.title, body: '' }),
      reference: null,
      channel: null,
      confidence: 'low',
      reasons: ['redacted'],
    };
  }

  const app = appHint(input.packageName);
  const amounts = readAmounts(text);
  const direction = readDirection(text);
  const instrument = readInstrument(text);
  const channel = readChannel(text, app?.channel ?? null);
  const counterparty = channel === 'atm' ? null : readCounterparty(text, direction);
  const hint = senderHint(input.sender) ?? senderHint(input.title);
  const issuer = resolveIssuer({ sender: input.sender, title: input.title, body: text });

  const { kind, reason } = classify({
    text,
    direction,
    hasAmount: amounts.best !== null,
    channel,
    counterparty,
    ownerName: context.ownerName ?? null,
  });
  reasons.push(reason);

  const date = UNDATED_KINDS.includes(kind)
    ? { occurredAt: input.receivedAt, confidence: 'fallback_received' as const, implausible: false }
    : readDate(text, input.receivedAt);

  if (amounts.best === null) reasons.push('amount:none');
  else reasons.push(amounts.best.marked ? 'amount:marked' : 'amount:bare');
  if (amounts.ambiguous) reasons.push('amount:ambiguous');
  if (amounts.best !== null && amounts.best.currency !== 'INR') reasons.push('amount:foreign');
  if (direction === null) reasons.push('direction:none');
  reasons.push(`date:${date.confidence}`);
  if (date.implausible) reasons.push('date:implausible');
  if (counterparty === null) reasons.push('counterparty:none');

  const sourceKnown = instrument.tail !== null || issuer !== null || app !== null;
  if (!sourceKnown) reasons.push('source:unknown');

  const instrumentType = instrument.type ?? (hint?.isCard === true && instrument.tail !== null ? 'card' : null);
  const label = counterparty === null ? null : labelOf(counterparty);

  const draft: Omit<Detection, 'confidence'> = {
    kind,
    direction,
    amountMinor: amounts.best?.amountMinor ?? null,
    currency: amounts.best?.currency ?? null,
    amountCandidates: amounts.candidates as Minor[],
    occurredAt: date.occurredAt,
    dateConfidence: date.confidence,
    counterparty,
    item: label ?? fallbackItem({ kind, direction, channel, text }),
    instrumentType,
    instrumentTail: instrument.tail,
    issuer,
    reference: readReference(text),
    channel,
    reasons,
  };

  return { ...draft, confidence: confidenceOf(draft, amounts.ambiguous, sourceKnown) };
}

export { bodyKeyOf, captureKey, type CaptureSource } from './capture-key';
export { maskMessage } from './mask';
export {
  DUPLICATE_WINDOW_MS,
  looksLikeManual,
  matchAccount,
  sameTransaction,
  tailsMatch,
  type AccountLike,
  type DuplicateFacts,
} from './match';
export { categoryNameFor } from './merchants';
export { suggest, type CategoryLike, type SuggestContext, type Suggestion } from './suggest';
