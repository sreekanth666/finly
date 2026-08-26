/**
 * Payment sources.
 *
 * Design-pass placeholder for the `accounts` table in §5 of the MVP plan. Rules
 * still reference an account by name (see `RuleAction`), so `name` is the join
 * key until accounts become real entities with ids in M3.
 */

import { Banknote, CreditCard, Landmark, Wallet, type LucideIcon } from 'lucide-react-native';

export type AccountType = 'credit_card' | 'bank' | 'cash' | 'wallet';

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  icon: LucideIcon;
};

const TYPE_ICONS: Record<AccountType, LucideIcon> = {
  credit_card: CreditCard,
  bank: Landmark,
  cash: Banknote,
  wallet: Wallet,
};

export const accounts: Account[] = [
  { id: 'a-1', name: 'HDFC Millennia', type: 'credit_card', icon: TYPE_ICONS.credit_card },
  { id: 'a-2', name: 'ICICI Amazon Pay', type: 'credit_card', icon: TYPE_ICONS.credit_card },
  { id: 'a-3', name: 'ICICI Bank', type: 'bank', icon: TYPE_ICONS.bank },
  { id: 'a-4', name: 'Cash', type: 'cash', icon: TYPE_ICONS.cash },
];

/** The account a rule names, or undefined when it names one that no longer exists. */
export const findAccountByName = (name: string | undefined) =>
  name === undefined ? undefined : accounts.find((account) => account.name === name);
