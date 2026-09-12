/**
 * Words and shapes the inbox screens share.
 */

import type { CandidateDetail, CandidateSummary, ConfirmInput } from '@/db/repositories/captures';
import { formatMinorPlain } from '@/domain/money';
import { matchRule, type Rule } from '@/domain/rules';
import { sourceAppName, type InboxSection } from '@/domain/txn-detect';

export const SECTION_TITLES: Record<InboxSection, string> = {
  review: 'Needs review',
  maybe: 'Maybe',
  money_in: 'Money in',
  filtered: 'Filtered',
};

export const SECTION_HINTS: Record<InboxSection, string> = {
  review: 'Payments read from your messages. Nothing is added until you confirm.',
  maybe: 'Something is missing or unclear. Open one to fill it in.',
  money_in: 'Refunds and money received. Settle one against an expense, or dismiss it.',
  filtered: 'OTPs, offers, statements, reminders, failed payments and transfers such as card bills. Open one if it was really spending.',
};

const KIND_LABELS: Partial<Record<CandidateSummary['kind'], string>> = {
  transfer: 'Transfer',
  refund: 'Refund',
  failed: 'Failed payment',
  upcoming: 'Upcoming',
  statement: 'Statement',
  otp: 'OTP',
  balance: 'Balance',
  promo: 'Offer',
  reminder: 'Reminder',
  unknown: 'Unread',
};

export const kindLabel = (kind: CandidateSummary['kind']): string | null => KIND_LABELS[kind] ?? null;

/** "SMS · HDFC Bank ••6630", the second line of a row. */
export function originLine(candidate: CandidateSummary): string {
  const parts = [sourceAppName(candidate.source, candidate.packageName)];
  const where = [candidate.issuer, candidate.instrumentTail === null ? null : `••${candidate.instrumentTail}`]
    .filter((part): part is string => part !== null)
    .join(' ');
  if (where.length > 0) parts.push(where);
  return parts.join(' · ');
}

/** "Also in PhonePe, SMS" for a payment announced more than once. */
export function alsoSeenLine(candidate: Pick<CandidateSummary, 'alsoSeenIn'>): string | null {
  if (candidate.alsoSeenIn.length === 0) return null;
  const names = [...new Set(candidate.alsoSeenIn.map((seen) => sourceAppName(seen.source, seen.packageName)))];
  return `Also in ${names.join(', ')}`;
}

/**
 * What confirming a candidate as read writes: its own fields, the suggestions
 * made when it arrived, and the user's rules re-applied now — a rule saved since
 * the alert came in still decides, just as it would in the entry form.
 */
export function oneTapInput(candidate: CandidateSummary, rules: readonly Rule[]): ConfirmInput {
  if (candidate.amountMinor === null) throw new Error('A candidate with no amount needs the form.');
  const fill = matchRule(rules, { item: candidate.item, note: '' });
  return {
    expense: {
      occurredAt: candidate.occurredAt,
      amountMinor: candidate.amountMinor,
      item: candidate.item,
      categoryId: fill?.categoryId ?? candidate.category?.id ?? null,
      accountId: fill?.accountId ?? candidate.account?.id ?? null,
      countsToBudget: fill?.countsToBudget ?? true,
    },
    rememberAccount: false,
    rememberCategoryId: null,
    appliedRuleId: fill?.rule.id ?? null,
  };
}

const REASON_NOTES: Record<string, string> = {
  'transfer:card-bill':
    "This looks like a credit card bill payment. The card's purchases arrive as their own alerts, so adding this as well would count them twice.",
  'transfer:investment':
    'This looks like an investment, such as a mutual fund SIP paid through a clearing house. That is saving, not spending.',
  'transfer:wallet': 'This looks like a wallet top-up. What you spend from the wallet arrives as its own alerts.',
  'transfer:cash': 'Cash drawn from an ATM. Add it only if you do not log what you spend in cash.',
  'transfer:self': 'This looks like money sent to yourself.',
  'kind:failed': 'This payment looks like it failed. If money did leave, the bank usually returns it.',
  'kind:upcoming': 'This has not happened yet. It will arrive as its own alert when it does.',
  'kind:statement': 'This is a statement, not a payment.',
  'kind:otp': 'This is a one-time password message. The code itself was not kept.',
  'kind:promo': 'This looks like an offer, not a payment.',
  'kind:reminder': 'This is a reminder to pay, not a payment.',
  'kind:request': 'This is a request for money, not a payment.',
  'kind:balance': 'This is a balance alert, not a payment.',
  'kind:unknown': 'This could not be read with confidence. Check every field before adding it.',
  redacted:
    "Android hid this notification's text, so nothing could be read. Copy the message from your SMS app and paste it instead.",
  'amount:ambiguous': 'The message has more than one figure in it. Pick the right one under the amount.',
  'amount:none': 'No amount could be read from the message.',
  'date:fallback_received': 'The message has no date, so this uses when it arrived.',
  'date:implausible': 'The date in the message did not make sense, so this uses when it arrived.',
};

/** Plain sentences about anything on this candidate worth a second look. */
export function candidateNotes(candidate: CandidateDetail, appCurrency: string): string[] {
  const notes = candidate.reasons
    .map((reason) => REASON_NOTES[reason])
    .filter((note): note is string => note !== undefined);

  if (candidate.currency !== null && candidate.currency !== appCurrency && candidate.amountMinor !== null) {
    notes.unshift(
      `The message says ${candidate.currency} ${formatMinorPlain(candidate.amountMinor)}. Enter what it cost in ${appCurrency}.`,
    );
  }
  return [...new Set(notes)];
}
