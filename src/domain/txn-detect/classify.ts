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

/*
 * Two gates that only count when they come first. An offer opens with its
 * pitch and mentions money moving only as bait — "Get flat Rs 100 off… Paid Rs
 * 500 or more?", "A pre-approved loan of Rs 2,00,000 can be credited" — while
 * a real alert opens with the payment and may carry a pitch after it. So these
 * file a message only when they appear before its first past money verb.
 */
const LEADING_PROMO =
  /\b(?:pre-?approved|apply now|shop now|download now|limited period|lucky draw|get flat|reward points? worth|convert (?:your |this |the )?(?:purchase|transaction|txn|spends?)\b.{0,80}?\b(?:into|to) (?:easy |no[- ]cost )?emis?)\b/i;
const LEADING_FUTURE_CREDIT = /\b(?:will|would|can|could|shall) be credited\b/i;
/** A card's limit changing is a notice, not money; only with no money verb at all. */
const LIMIT_CHANGE =
  /\blimit\b.{0,40}?\b(?:has been |is |was )?(?:increased|enhanced|revised|raised|upgraded|reduced|decreased)\b/i;

/** Whether `pattern` matches before the text's first past money verb, or there is none. */
function leads(pattern: RegExp, text: string): boolean {
  const match = pattern.exec(text);
  if (match === null) return false;
  const verb = PAST_MONEY_VERB.exec(text);
  return verb === null || match.index < verb.index;
}

/**
 * Every gate the text trips, whether or not it decided the kind — a promotion
 * word the past verb overruled is still a signal. For the detector's model
 * (D21), which weighs them where the order above can only pick one.
 */
export function gateSignals(text: string): string[] {
  const signals: [string, boolean][] = [
    ['otp', OTP.test(text)],
    ['failed', FAILED.test(text)],
    ['upcoming', UPCOMING.test(text)],
    ['future-credit', LEADING_FUTURE_CREDIT.test(text)],
    ['card-bill', CARD_BILL.test(text)],
    ['statement', STATEMENT.test(text)],
    ['request', REQUEST.test(text)],
    ['reminder', REMINDER.test(text)],
    ['promo', PROMO.test(text)],
    ['leading-promo', leads(LEADING_PROMO, text)],
    ['balance', BALANCE.test(text)],
    ['limit', LIMIT_CHANGE.test(text)],
    ['refund', REFUND.test(text)],
    ['investment', INVESTMENT.test(text)],
    ['wallet', WALLET_TOPUP.test(text)],
    ['past-verb', PAST_MONEY_VERB.test(text)],
  ];
  return signals.filter(([, hit]) => hit).map(([name]) => name);
}

/**
 * A bank's own charge: a kind of charge, then within two words "charges",
 * "fee" or "penalty". Narrow on purpose — "Fee payment to ABC SCHOOL" and
 * "ANNUAL FEE DPS SCHOOL" are spending, and `isBankCharge` also requires that
 * nobody else is named as the payee.
 */
const BANK_CHARGE =
  /\b(?:non[- ]?maint(?:enance)?|min(?:imum)?\.?\s*bal(?:ance)?|amb|mab|aqb|qab|sms|atm|annual|amc|chq|cheque\s*book|ecs|nach|penal|late\s*payment|processing|forex|mark[- ]?up)\s+(?:[a-z]+\s+){0,2}?(?:charges?|chgs?|fees?|penalty)\b/i;

const CHARGE_WORDS = new Set([
  'non', 'maint', 'maintenance', 'min', 'minimum', 'bal', 'balance', 'amb', 'mab', 'aqb', 'qab', 'sms',
  'atm', 'wdl', 'withdrawal', 'annual', 'amc', 'chq', 'cheque', 'book', 'ecs', 'nach', 'penal', 'late',
  'payment', 'processing', 'forex', 'mark', 'up', 'markup', 'charge', 'charges', 'chg', 'chgs', 'fee',
  'fees', 'penalty', 'for', 'of', 'gst', 'incl', 'the', 'and',
]);

/** Whether a debit is the bank charging the account, rather than paying someone. */
export function isBankCharge(text: string, direction: Direction | null, counterparty: string | null): boolean {
  if (direction !== 'debit' || !BANK_CHARGE.test(text)) return false;
  if (counterparty === null) return true;
  /* "towards SMS Charges" reads "SMS Charges" as the payee; that is still the bank. */
  return counterparty
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((word) => word.length > 0)
    .every((word) => CHARGE_WORDS.has(word));
}

export type ClassifyInput = {
  text: string;
  direction: Direction | null;
  hasAmount: boolean;
  channel: Channel | null;
  counterparty: string | null;
  ownerName: string | null;
  /** From `isBankCharge`: ATM charges are a charge, not cash drawn. */
  bankCharge?: boolean;
};

export type Classification = { kind: DetectionKind; reason: string };

export function classify(input: ClassifyInput): Classification {
  const { text, direction, hasAmount, channel, counterparty, ownerName, bankCharge = false } = input;
  const hasPastVerb = PAST_MONEY_VERB.test(text);

  if (isRedacted(text)) return { kind: 'unknown', reason: 'redacted' };
  if (OTP.test(text)) return { kind: 'otp', reason: 'kind:otp' };
  if (FAILED.test(text)) return { kind: 'failed', reason: 'kind:failed' };
  if (UPCOMING.test(text)) return { kind: 'upcoming', reason: 'kind:upcoming' };
  if (leads(LEADING_FUTURE_CREDIT, text)) return { kind: 'upcoming', reason: 'kind:upcoming-credit' };
  if (CARD_BILL.test(text)) return { kind: 'transfer', reason: 'transfer:card-bill' };
  if (STATEMENT.test(text)) return { kind: 'statement', reason: 'kind:statement' };
  if (REQUEST.test(text)) return { kind: 'reminder', reason: 'kind:request' };
  if (REMINDER.test(text) && !hasPastVerb) return { kind: 'reminder', reason: 'kind:reminder' };
  if (PROMO.test(text) && !hasPastVerb) return { kind: 'promo', reason: 'kind:promo' };
  if (leads(LEADING_PROMO, text)) return { kind: 'promo', reason: 'kind:promo-lead' };
  if (LIMIT_CHANGE.test(text) && findVerbs(text).length === 0) return { kind: 'balance', reason: 'kind:limit' };
  /* Stricter than the gates above: "has a debit by transfer" and "added to your
     wallet" mention a balance too, and are not enquiries. */
  if (BALANCE.test(text) && findVerbs(text).length === 0) {
    return { kind: 'balance', reason: 'kind:balance' };
  }

  if (!hasAmount || direction === null) return { kind: 'unknown', reason: 'kind:unknown' };

  if (direction === 'credit' && REFUND.test(text)) return { kind: 'refund', reason: 'kind:refund' };
  if (INVESTMENT.test(text)) return { kind: 'transfer', reason: 'transfer:investment' };
  if (WALLET_TOPUP.test(text)) return { kind: 'transfer', reason: 'transfer:wallet' };
  if (channel === 'atm' && !bankCharge) return { kind: 'transfer', reason: 'transfer:cash' };
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
