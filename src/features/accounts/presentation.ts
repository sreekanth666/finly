/**
 * How an account is labelled and drawn.
 *
 * These lived in the accounts fixture, which made them look like data. They are
 * not: `accounts.type` is a four-value column, and this is the wording and the
 * glyph the app chooses for each of them.
 */

import { Banknote, CreditCard, Landmark, Wallet, type LucideIcon } from 'lucide-react-native';

import { ACCOUNT_TYPES, type AccountType } from '@/db/schema';
import type { StoredColorToken } from '@/theme';

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  credit_card: 'Credit card',
  bank: 'Bank account',
  cash: 'Cash',
  wallet: 'Wallet',
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, LucideIcon> = {
  credit_card: CreditCard,
  bank: Landmark,
  cash: Banknote,
  wallet: Wallet,
};

export const ACCOUNT_TYPE_OPTIONS = ACCOUNT_TYPES.map((id) => ({
  id,
  label: ACCOUNT_TYPE_LABELS[id],
}));

/**
 * The swatches an account may be given. A subset of the stored tokens, chosen so
 * two cards are easy to tell apart at a glance in a list.
 */
export const ACCOUNT_COLOR_TOKENS = [
  'accent',
  'iris',
  'income',
  'warning',
  'danger',
] as const satisfies readonly StoredColorToken[];

export type AccountColorToken = (typeof ACCOUNT_COLOR_TOKENS)[number];

export const isAccountColorToken = (token: string): token is AccountColorToken =>
  (ACCOUNT_COLOR_TOKENS as readonly string[]).includes(token);

/** Falls back rather than throwing, for a token written by a future build. */
export const toAccountColorToken = (token: string): AccountColorToken =>
  isAccountColorToken(token) ? token : 'accent';
