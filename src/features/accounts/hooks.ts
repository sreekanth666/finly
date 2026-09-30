/**
 * Accounts, and what each card owes or is carrying this cycle.
 */

import type { Db } from '@/db/client';
import { useDbQuery, type TableName } from '@/db/live';
import {
  countAccountReferences,
  getAccount,
  listCreditCards,
  type AccountReferences,
} from '@/db/repositories/accounts';
import {
  listCardPayments,
  paidSince,
  type CardPaymentListItem,
} from '@/db/repositories/card-payments';
import { cardSpendSince, cycleSpend } from '@/db/repositories/expenses';
import type { AccountRow } from '@/db/schema';
import { cardBalance } from '@/domain/card-balance';
import { asMinor, ZERO_MINOR, type Minor } from '@/domain/money';
import { cycleWindow, type UtilisationBand } from '@/domain/utilisation';

const CARD_TABLES: readonly TableName[] = ['accounts', 'expenses', 'settlements', 'card_payments'];

export type CardStanding = {
  id: string;
  name: string;
  issuer: string | null;
  last4: string | null;
  colorToken: string;
  /** What the card owes (D20), or null when it has not been anchored yet. */
  owedMinor: Minor | null;
  /** When the owed figure counts from. Null alongside `owedMinor`. */
  trackedSince: number | null;
  cycleSpendMinor: Minor;
  creditLimitMinor: Minor;
  /** Owed over the limit for a tracked card, cycle spend over it otherwise. */
  utilisation: number;
  band: UtilisationBand;
  daysToStatement: number;
};

/**
 * `counts_to_budget` is deliberately not a filter anywhere in here (§4.5): a
 * laptop excluded from the monthly budget is still very much on the card, and
 * pretending otherwise would understate exactly the number this exists to show.
 */
function standingOf(card: AccountRow, now: number, database: Db): CardStanding {
  const limit = card.creditLimitMinor ?? asMinor(0);
  // A card with no statement day still has a limit worth showing against;
  // treat it as billing on the 1st rather than dropping it from the list.
  const window = cycleWindow(card.statementDay ?? 1, now);
  const spent = cycleSpend(card.id, window, database);

  const anchor =
    card.openingOwedMinor === null || card.openingOwedAt === null
      ? null
      : { owedMinor: card.openingOwedMinor, at: card.openingOwedAt };

  const balance = cardBalance({
    creditLimitMinor: limit,
    cycleSpendMinor: spent,
    anchor,
    spentSinceMinor: anchor === null ? ZERO_MINOR : cardSpendSince(card.id, anchor.at, database),
    paidSinceMinor: anchor === null ? ZERO_MINOR : paidSince(card.id, anchor.at, database),
  });

  return {
    id: card.id,
    name: card.name,
    issuer: card.issuer,
    last4: card.last4,
    colorToken: card.colorToken,
    owedMinor: balance.owedMinor,
    trackedSince: anchor?.at ?? null,
    cycleSpendMinor: spent,
    creditLimitMinor: limit,
    utilisation: balance.utilisation,
    band: balance.band,
    daysToStatement: window.daysToStatement,
  };
}

/** One row per credit card: what it owes, or what it has carried this cycle. */
export function useCardStandings() {
  return useDbQuery<CardStanding[]>('card-standings', CARD_TABLES, (database) => {
    const now = Date.now();
    return listCreditCards(database).map((card) => standingOf(card, now, database));
  });
}

export type CardView = {
  account: AccountRow;
  standing: CardStanding;
  payments: CardPaymentListItem[];
} | null;

/**
 * One card, for its own screen. Null when it is gone or is not a card — an
 * account turned into a bank account while its screen was open. Unlike the
 * list, a card with no limit is still shown: it can owe and be paid.
 */
export function useCard(id: string) {
  return useDbQuery<CardView>(`card:${id}`, CARD_TABLES, (database) => {
    const account = getAccount(id, database);
    if (account === null || account.deletedAt !== null || account.type !== 'credit_card') return null;

    return {
      account,
      standing: standingOf(account, Date.now(), database),
      payments: listCardPayments(id, database),
    };
  });
}

export function useAccount(id: string) {
  return useDbQuery<AccountRow | null>(`account:${id}`, ['accounts'], (database) =>
    getAccount(id, database),
  );
}

export function useAccountReferences(id: string) {
  return useDbQuery<AccountReferences>(
    `account-refs:${id}`,
    ['expenses', 'settlements', 'card_payments', 'rule_actions'],
    (database) => countAccountReferences(id, database),
  );
}
