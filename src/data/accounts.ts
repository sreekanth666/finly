/**
 * Payment sources.
 *
 * Design-pass placeholder for the `accounts` table in §5 of the MVP plan. Rules
 * and transactions still reference an account by name, so `name` is the join
 * key until accounts become real entities in M3.
 *
 * The icon is derived from `type` rather than stored — the table has no icon
 * column, and a bank is always a bank.
 */

import { Banknote, CreditCard, Landmark, Wallet, type LucideIcon } from 'lucide-react-native';

import type { AppColor } from '@/theme';

export type AccountType = 'credit_card' | 'bank' | 'cash' | 'wallet';

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  issuer?: string;
  /** Last four digits, for telling two cards from the same issuer apart. */
  last4?: string;
  /** Credit cards only — §5 requires it for them and forbids it elsewhere. */
  creditLimit?: number;
  /** Credit cards only. 1–31; short months clamp (§4.5). */
  statementDay?: number;
  /** A theme token name, never a hex. */
  colorToken: AppColor;
  sortOrder: number;
  isArchived: boolean;
};

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  credit_card: 'Credit card',
  bank: 'Bank',
  cash: 'Cash',
  wallet: 'Wallet',
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, LucideIcon> = {
  credit_card: CreditCard,
  bank: Landmark,
  cash: Banknote,
  wallet: Wallet,
};

/**
 * Tokens an account may be painted with. A fixed tuple because `useAppColor`
 * needs one to resolve a set in a single call — see theme/chart.ts.
 */
export const ACCOUNT_COLOR_TOKENS = ['accent', 'iris', 'income', 'warning', 'danger'] as const;

export type AccountColorToken = (typeof ACCOUNT_COLOR_TOKENS)[number];

export const accounts: Account[] = [
  {
    id: 'a-1',
    name: 'HDFC Millennia',
    type: 'credit_card',
    issuer: 'HDFC Bank',
    last4: '4821',
    creditLimit: 4000,
    statementDay: 18,
    colorToken: 'accent',
    sortOrder: 0,
    isArchived: false,
  },
  {
    id: 'a-2',
    name: 'ICICI Amazon Pay',
    type: 'credit_card',
    issuer: 'ICICI Bank',
    last4: '7310',
    creditLimit: 3000,
    statementDay: 2,
    colorToken: 'iris',
    sortOrder: 1,
    isArchived: false,
  },
  {
    id: 'a-3',
    name: 'ICICI Bank',
    type: 'bank',
    issuer: 'ICICI Bank',
    last4: '9042',
    colorToken: 'income',
    sortOrder: 2,
    isArchived: false,
  },
  { id: 'a-4', name: 'Cash', type: 'cash', colorToken: 'warning', sortOrder: 3, isArchived: false },
  {
    id: 'a-5',
    name: 'Old Paytm Wallet',
    type: 'wallet',
    colorToken: 'danger',
    sortOrder: 4,
    isArchived: true,
  },
];

/** The account a rule names, or undefined when it names one that no longer exists. */
export const findAccountByName = (name: string | undefined) =>
  name === undefined ? undefined : accounts.find((account) => account.name === name);

export const findAccount = (id: string) => accounts.find((account) => account.id === id);
