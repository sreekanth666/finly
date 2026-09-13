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
import { appHint, isSmsApp, resolveIssuer, senderHeader, senderHint } from './sources';
import type { Channel, Confidence, DetectContext, Detection, DetectionKind, Direction, MessageInput } from './types';
import { matchTemplates } from './user-templates';

export * from './types';
export { isRedacted, normaliseText } from './normalise';
export { labelOf } from './counterparty';
export { appHint, isSmsApp, PAYMENT_APPS, SMS_APP_PACKAGES } from './sources';
export * from './user-templates';
export * from './contribution';

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
  const genericDirection = readDirection(text);
  const instrument = readInstrument(text);
  const channel = readChannel(text, app?.channel ?? null);
  const genericCounterparty = channel === 'atm' ? null : readCounterparty(text, genericDirection);
  const hint = senderHint(input.sender) ?? senderHint(input.title);
  const issuer = resolveIssuer({ sender: input.sender, title: input.title, body: text });

  const classification = classify({
    text,
    direction: genericDirection,
    hasAmount: amounts.best !== null,
    channel,
    counterparty: genericCounterparty,
    ownerName: context.ownerName ?? null,
  });

  /* D18: a format the user taught, tried only once the classifier has spoken,
     because whether a template may overrule it depends on what it said. */
  const taught =
    context.templates === undefined || context.templates.length === 0
      ? null
      : matchTemplates(context.templates, {
          text,
          binding: {
            senderKey: senderHeader(input.sender) ?? senderHeader(input.title),
            packageName: input.packageName != null && !isSmsApp(input.packageName) ? input.packageName : null,
            issuer,
          },
          classified: classification.kind,
        });

  const kind: DetectionKind =
    taught === null
      ? classification.kind
      : taught.outcome === 'transaction'
        ? 'transaction'
        : taught.outcome === 'transfer'
          ? 'transfer'
          : /* A muted format lands in Filtered as an offer: no new kind, no table rebuild. */ 'promo';
  reasons.push(
    taught === null
      ? classification.reason
      : taught.outcome === 'ignore'
        ? `template:mute:${taught.templateId}`
        : `template:${taught.templateId}`,
  );

  const direction = taught?.direction ?? genericDirection;
  const counterparty =
    taught?.counterparty ??
    (direction === genericDirection || channel === 'atm' ? genericCounterparty : readCounterparty(text, direction));
  const taughtAmount = taught?.amountMinor ?? null;
  const ambiguous = taughtAmount === null && amounts.ambiguous;

  const date = UNDATED_KINDS.includes(kind)
    ? { occurredAt: input.receivedAt, confidence: 'fallback_received' as const, implausible: false }
    : readDate(text, input.receivedAt);

  if (taughtAmount !== null) reasons.push('amount:template');
  else if (amounts.best === null) reasons.push('amount:none');
  else reasons.push(amounts.best.marked ? 'amount:marked' : 'amount:bare');
  if (ambiguous) reasons.push('amount:ambiguous');
  const currency = taughtAmount !== null ? taught!.currency : (amounts.best?.currency ?? null);
  if (currency !== null && currency !== 'INR') reasons.push('amount:foreign');
  if (direction === null) reasons.push('direction:none');
  reasons.push(`date:${date.confidence}`);
  if (date.implausible) reasons.push('date:implausible');
  if (counterparty === null) reasons.push('counterparty:none');

  const instrumentTail = taught?.tail ?? instrument.tail;
  /* A taught template is bound to its sender, so a match is itself a known source. */
  const sourceKnown = instrumentTail !== null || issuer !== null || app !== null || taught !== null;
  if (!sourceKnown) reasons.push('source:unknown');

  const instrumentType = instrument.type ?? (hint?.isCard === true && instrumentTail !== null ? 'card' : null);
  const label = counterparty === null ? null : labelOf(counterparty);

  const draft: Omit<Detection, 'confidence'> = {
    kind,
    direction,
    amountMinor: taughtAmount ?? amounts.best?.amountMinor ?? null,
    currency,
    amountCandidates:
      taughtAmount === null
        ? (amounts.candidates as Minor[])
        : [taughtAmount, ...amounts.candidates.filter((candidate) => candidate !== taughtAmount)],
    occurredAt: date.occurredAt,
    dateConfidence: date.confidence,
    counterparty,
    item: label ?? fallbackItem({ kind, direction, channel, text }),
    instrumentType,
    instrumentTail,
    issuer,
    reference: taught?.reference ?? readReference(text),
    channel,
    reasons,
  };

  return { ...draft, confidence: confidenceOf(draft, ambiguous, sourceKnown) };
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
export {
  canConfirmInOneTap,
  countsTowardBadge,
  DEFAULT_RETENTION_DAYS,
  EPHEMERAL_KINDS,
  INBOX_SECTIONS,
  redactCodes,
  RETENTION_CHOICES,
  sectionOf,
  sourceAppName,
  sourceTextOf,
  type InboxSection,
} from './inbox';
