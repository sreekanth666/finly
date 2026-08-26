/**
 * Money coming back against a specific expense.
 *
 * Design-pass placeholder for the `settlements` table in §5. A settlement is a
 * linked record rather than an edit to the expense (D1), so a partial return, or
 * one that lands a month later, still leaves the original spend intact.
 */

export type Settlement = {
  id: string;
  expenseId: string;
  /** Positive — money returning. */
  amount: number;
  /** Formatted for display until real dates land in M1. */
  settledAt: string;
  /** Where the money landed. Account name is the join key until M3. */
  accountName?: string;
  note?: string;
};

export const settlements: Settlement[] = [
  {
    id: 's-1',
    expenseId: 'b-1',
    amount: 129.99,
    settledAt: 'Mon, 25 Aug',
    accountName: 'HDFC Millennia',
    note: 'Returned — wrong model',
  },
  {
    id: 's-2',
    expenseId: 'y-2',
    amount: 425,
    settledAt: 'Yesterday',
    accountName: 'ICICI Bank',
    note: 'Flatmate’s half',
  },
];

/** Oldest first, the order they happened in. */
export const findSettlements = (expenseId: string) =>
  settlements.filter((settlement) => settlement.expenseId === expenseId);
