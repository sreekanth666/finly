/**
 * Between the editor's fields and the accounts table.
 *
 * Every numeric field in `AccountDraft` is a string, because that is what a text
 * input holds. The conversion happens here, once, rather than in each of the two
 * routes that submit one.
 */

import type { AccountDraft } from '@/components/account-editor';
import type { AccountInput } from '@/db/repositories/accounts';
import type { AccountRow } from '@/db/schema';
import { minorToEntry, parseMinor, type Minor } from '@/domain/money';

import { toAccountColorToken } from './presentation';

export function draftToInput(draft: AccountDraft): AccountInput {
  const isCard = draft.type === 'credit_card';
  const limit = parseMinor(draft.creditLimit);
  const day = Number(draft.statementDay.trim());

  return {
    name: draft.name,
    type: draft.type,
    issuer: draft.issuer,
    last4: draft.last4,
    // Only a card carries these; anywhere else they would satisfy the schema and
    // then quietly show up in a utilisation figure.
    creditLimitMinor: isCard ? limit : null,
    statementDay: isCard && Number.isInteger(day) && day >= 1 && day <= 31 ? day : null,
    colorToken: draft.colorToken,
  };
}

export function rowToDraft(row: AccountRow): AccountDraft {
  return {
    name: row.name,
    type: row.type,
    issuer: row.issuer ?? '',
    last4: row.last4 ?? '',
    creditLimit: row.creditLimitMinor === null ? '' : minorToEntry(row.creditLimitMinor as Minor),
    statementDay: row.statementDay === null ? '' : String(row.statementDay),
    colorToken: toAccountColorToken(row.colorToken),
  };
}
