/**
 * What a credit card owes — D20, the upgrade §11.3 reserved for D6.
 *
 * D6 measured a card by what it had spent since its last statement, because
 * nothing recorded paying it. Once payments are recorded the honest figure is
 * the unpaid balance: what the user said they owed at one moment, plus card
 * spending since, minus payments since.
 *
 * The anchor exists because the app's history is not the card's history. Every
 * card expense ever entered is in the database, but so is a year of purchases
 * that were paid off before anyone could record the payment, and summing them
 * would show all of it as owed. So a card is anchored once, to a figure read off
 * the card's own app, and only what happens after that moves it. Until then it
 * is measured as D6 always measured it.
 */

import { subMinor, addMinor, clampMinorAtZero, type Minor } from './money';
import { utilisation, utilisationBand, type UtilisationBand } from './utilisation';

export type CardAnchor = { owedMinor: Minor; at: number };

export type CardBalanceInput = {
  creditLimitMinor: Minor;
  /** The billing cycle's spend — the figure for a card that is not tracked. */
  cycleSpendMinor: Minor;
  /** Null when the card has never been anchored. */
  anchor: CardAnchor | null;
  /** Effective card spend on or after the anchor. Ignored without one. */
  spentSinceMinor: Minor;
  /** Payments on or after the anchor. Ignored without one. */
  paidSinceMinor: Minor;
};

export type CardBalance = {
  /** What is owed, or null for a card that is not tracked. Negative is credit. */
  owedMinor: Minor | null;
  /** The figure the meter and the band measure. */
  usedMinor: Minor;
  utilisation: number;
  band: UtilisationBand;
};

export const cardOwed = (anchor: CardAnchor, spentSinceMinor: Minor, paidSinceMinor: Minor): Minor =>
  subMinor(addMinor(anchor.owedMinor, spentSinceMinor), paidSinceMinor);

export function cardBalance(input: CardBalanceInput): CardBalance {
  const owedMinor =
    input.anchor === null ? null : cardOwed(input.anchor, input.spentSinceMinor, input.paidSinceMinor);

  /* Overpaying leaves the card in credit, which uses none of the limit. */
  const usedMinor = owedMinor === null ? input.cycleSpendMinor : clampMinorAtZero(owedMinor);
  const value = utilisation(usedMinor, input.creditLimitMinor);

  return { owedMinor, usedMinor, utilisation: value, band: utilisationBand(value) };
}

/**
 * Whether a payment already recorded is the one an alert describes: the same
 * card, the same amount, within a few days. The bank's "paid to CRED" and the
 * issuer's "payment received" are two alerts for one payment, and recording
 * both would halve what the card seems to owe.
 */
export const PAYMENT_MATCH_WINDOW_MS = 3 * 86_400_000;

export const isSamePayment = (
  recorded: { amountMinor: Minor; paidAt: number },
  alert: { amountMinor: Minor; occurredAt: number },
): boolean =>
  recorded.amountMinor === alert.amountMinor &&
  Math.abs(recorded.paidAt - alert.occurredAt) <= PAYMENT_MATCH_WINDOW_MS;
