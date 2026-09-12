/**
 * What kind of message this is, before anyone asks what it says.
 *
 * Order is the whole design. The negative gates run first, because an OTP for
 * a ₹2,450 card payment, a failed ₹300 UPI payment, and a ₹26,100 statement all
 * contain an amount and a money word, and all three would otherwise land in the
 * inbox as spending. Every gate is a reason to *file* the message, not drop
 * it: the inbox keeps the Filtered section so a wrong call can be undone.
 *
 * Transfers are debits that are not spending: paying the card bill (the card's
 * purchases already arrived as their own alerts, so counting the bill would
 * count them twice), buying mutual funds through a clearing house, topping up a
 * wallet, drawing cash, and sending money to oneself.
 */

import { foldName, isRedacted } from './normalise';
import type { Channel, DetectionKind, Direction } from './types';
import { findVerbs, PAST_MONEY_VERB } from './vocabulary';

const OTP = /\b(?:otp|one[\s-]?time[\s-]?password|verification code|security code|auth(?:entication)? code)\b/i;
const FAILED =
  /\b(?:failed|declined|unsuccessful|rejected|could not be (?:processed|completed)|has not been processed|insufficient (?:funds|balance)|timed out)\b/i;
const UPCOMING =
  /\b(?:will be (?:debited|charged|deducted)|to be debited|would be debited|due for debit|scheduled (?:for|on)|mandate (?:has been )?(?:created|registered|set ?up|approved)|auto-?pay (?:has been )?(?:set ?up|registered|created|activated)|upcoming)\b/i;
const CARD_BILL =
  /\b(?:payment|paid)\b.{0,40}?\b(?:towards|to|for)\s+(?:your\s+)?(?:[a-z]+\s+){0,3}?(?:credit\s*card|[a-z]*card)\b|\bcred(?:\s+club)?\b|\bbilldesk\b|\bcredit card (?:bill )?payment\b/i;
const STATEMENT = /\bstatement\b|\btotal amount due\b|\btad\b|\bmin(?:imum)? amount due\b|\bmad\b/i;
const REQUEST = /\b(?:has requested|requested (?:inr|money|payment)|collect request|payment request)\b/i;
const REMINDER =
  /\b(?:pay by|due (?:on|by|date)|is due|overdue|payment due|last date|pay now|bill (?:is )?generated|to avoid late)\b/i;
const PROMO =
  /\b(?:cashback|offer|upto|up to|win|won|voucher|coupon|pre-?approved|eligible|apply now|discount|limited period|hurry|congratulations|shop now|get flat|download now)\b/i;
const BALANCE = /\b(?:avl|available|avail|avlbl|closing|current|ledger)\.?\s*bal(?:ance)?\b|\bbalance\b/i;
const REFUND = /\b(?:refund(?:ed)?|reversal|reversed|chargeback|cashback)\b/i;
const INVESTMENT =
  /\b(?:indian clearing|iccl|nsccl|nse clearing|clearing corp\w*|mutual fund|sip|zerodha|groww|upstox|kuvera|bse ltd|bsestarmf|nsdl|cdsl)\b/i;
const WALLET_TOPUP =
  /\b(?:added to (?:your )?(?:\w+ )?wallet|wallet (?:top-?up|load(?:ed)?|recharge)|loaded (?:to|in) (?:your )?(?:\w+ )?wallet)\b/i;

export type ClassifyInput = {
  text: string;
  direction: Direction | null;
  hasAmount: boolean;
  channel: Channel | null;
  counterparty: string | null;
  ownerName: string | null;
};

export type Classification = { kind: DetectionKind; reason: string };

export function classify(input: ClassifyInput): Classification {
  const { text, direction, hasAmount, channel, counterparty, ownerName } = input;
  const hasPastVerb = PAST_MONEY_VERB.test(text);

  if (isRedacted(text)) return { kind: 'unknown', reason: 'redacted' };
  if (OTP.test(text)) return { kind: 'otp', reason: 'kind:otp' };
  if (FAILED.test(text)) return { kind: 'failed', reason: 'kind:failed' };
  if (UPCOMING.test(text)) return { kind: 'upcoming', reason: 'kind:upcoming' };
  if (CARD_BILL.test(text)) return { kind: 'transfer', reason: 'transfer:card-bill' };
  if (STATEMENT.test(text)) return { kind: 'statement', reason: 'kind:statement' };
  if (REQUEST.test(text)) return { kind: 'reminder', reason: 'kind:request' };
  if (REMINDER.test(text) && !hasPastVerb) return { kind: 'reminder', reason: 'kind:reminder' };
  if (PROMO.test(text) && !hasPastVerb) return { kind: 'promo', reason: 'kind:promo' };
  /* Stricter than the gates above: "has a debit by transfer" and "added to your
     wallet" mention a balance too, and are not enquiries. */
  if (BALANCE.test(text) && findVerbs(text).length === 0) {
    return { kind: 'balance', reason: 'kind:balance' };
  }

  if (!hasAmount || direction === null) return { kind: 'unknown', reason: 'kind:unknown' };

  if (direction === 'credit' && REFUND.test(text)) return { kind: 'refund', reason: 'kind:refund' };
  if (INVESTMENT.test(text)) return { kind: 'transfer', reason: 'transfer:investment' };
  if (WALLET_TOPUP.test(text)) return { kind: 'transfer', reason: 'transfer:wallet' };
  if (channel === 'atm') return { kind: 'transfer', reason: 'transfer:cash' };
  if (
    direction === 'debit' &&
    ownerName != null &&
    counterparty !== null &&
    foldName(ownerName).length > 0 &&
    foldName(ownerName) === foldName(counterparty)
  ) {
    return { kind: 'transfer', reason: 'transfer:self' };
  }

  return { kind: 'transaction', reason: 'kind:transaction' };
}

/** Kinds that describe money that has already moved. */
export const MOVED_KINDS: readonly DetectionKind[] = ['transaction', 'transfer', 'refund'];
