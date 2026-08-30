/**
 * Accounts, and what each card is carrying this cycle.
 */

import { useDbQuery, type TableName } from '@/db/live';
import {
  countAccountReferences,
  getAccount,
  listCreditCards,
  type AccountReferences,
} from '@/db/repositories/accounts';
import { cycleSpend } from '@/db/repositories/expenses';
import type { AccountRow } from '@/db/schema';
import { asMinor, type Minor } from '@/domain/money';
import { cycleWindow, utilisation, utilisationBand, type UtilisationBand } from '@/domain/utilisation';

const CARD_TABLES: readonly TableName[] = ['accounts', 'expenses', 'settlements'];

export type CardStanding = {
  id: string;
  name: string;
  issuer: string | null;
  last4: string | null;
  colorToken: string;
  cycleSpendMinor: Minor;
  creditLimitMinor: Minor;
  utilisation: number;
  band: UtilisationBand;
  daysToStatement: number;
};

/**
 * One row per credit card, with what it has carried since its last statement.
 *
 * `counts_to_budget` is deliberately not a filter here (§4.5): a laptop excluded
 * from the monthly budget is still very much on the card, and pretending
 * otherwise would understate exactly the number this exists to show.
 */
export function useCardStandings() {
  return useDbQuery<CardStanding[]>('card-standings', CARD_TABLES, (database) => {
    const now = Date.now();

    return listCreditCards(database).map((card) => {
      const limit = card.creditLimitMinor ?? asMinor(0);
      // A card with no statement day still has a limit worth showing against;
      // treat it as billing on the 1st rather than dropping it from the list.
      const window = cycleWindow(card.statementDay ?? 1, now);
      const spent = cycleSpend(card.id, window, database);
      const value = utilisation(spent, limit);

      return {
        id: card.id,
        name: card.name,
        issuer: card.issuer,
        last4: card.last4,
        colorToken: card.colorToken,
        cycleSpendMinor: spent,
        creditLimitMinor: limit,
        utilisation: value,
        band: utilisationBand(value),
        daysToStatement: window.daysToStatement,
      };
    });
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
    ['expenses', 'settlements', 'rule_actions'],
    (database) => countAccountReferences(id, database),
  );
}
