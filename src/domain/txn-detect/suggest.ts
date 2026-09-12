/**
 * Filling in what the message cannot say: which category, which saved account.
 *
 * Order, and the reason for it:
 *
 * 1. The user's rules (D7), matched against the payee label and then the raw
 *    payee. The user wrote these, so they win.
 * 2. For the account, the card or account tail against saved `last4`s.
 * 3. For the category, the built-in merchant list, resolved by name.
 *
 * The note is deliberately passed to the rules as empty. Detected expenses keep
 * the original message in `source_text`, not the note, and matching a rule
 * against bank boilerplate would fire "note contains upi" on everything.
 */

import { findCategoryByName } from '@/domain/categories';
import { matchRule, type Rule } from '@/domain/rules';

import { matchAccount, type AccountLike } from './match';
import { categoryNameFor } from './merchants';
import type { Detection } from './types';

export type CategoryLike = { id: string; name: string; isArchived: boolean };

export type SuggestContext = {
  rules: readonly Rule[];
  categories: readonly CategoryLike[];
  accounts: readonly AccountLike[];
};

export type Suggestion = {
  categoryId: string | null;
  accountId: string | null;
  ruleId: string | null;
  countsToBudget: boolean | null;
};

export function suggest(
  detection: Pick<Detection, 'item' | 'counterparty' | 'instrumentType' | 'instrumentTail' | 'issuer'>,
  context: SuggestContext,
): Suggestion {
  const fill =
    matchRule(context.rules, { item: detection.item, note: '' }) ??
    (detection.counterparty === null ? null : matchRule(context.rules, { item: detection.counterparty, note: '' }));

  const accountId =
    fill?.accountId ??
    matchAccount(
      { type: detection.instrumentType, tail: detection.instrumentTail, issuer: detection.issuer },
      context.accounts,
    );

  let categoryId = fill?.categoryId ?? null;
  if (categoryId === null) {
    const name = categoryNameFor(detection.counterparty, detection.item);
    const live = context.categories.filter((category) => !category.isArchived);
    categoryId = name === null ? null : (findCategoryByName(live, name)?.id ?? null);
  }

  return {
    categoryId,
    accountId,
    ruleId: fill?.rule.id ?? null,
    countsToBudget: fill?.countsToBudget ?? null,
  };
}
