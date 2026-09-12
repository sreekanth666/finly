import { router } from 'expo-router';
import { Switch, Typography } from 'heroui-native';
import { Info, Link2 } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Button } from './button';
import { ExpenseForm, type ExpenseDraft } from './expense-form';
import { Icon } from './icon';
import { MisreadReport } from './misread-report';
import { SourceMessage } from './source-message';

import type { CandidateDetail } from '@/db/repositories/captures';
import type { AccountRow, CategoryRow } from '@/db/schema';
import { useSubmitOnce } from '@/db/use-action';
import { formatMinor, getActiveCurrency, minorToEntry } from '@/domain/money';
import { formatDayLabel } from '@/domain/period';
import type { Rule } from '@/domain/rules';
import { labelOf, sourceAppName } from '@/domain/txn-detect';
import {
  useConfirmCandidate,
  useLinkCandidate,
  useResolveCandidate,
  useSeparateDuplicate,
} from '@/features/capture/hooks';
import { candidateNotes } from '@/features/capture/presentation';

export type CandidateReviewProps = {
  candidate: CandidateDetail;
  categories: readonly CategoryRow[];
  accounts: readonly AccountRow[];
  rules: readonly Rule[];
};

/**
 * Confirming a detected payment (D17): the ordinary expense form, prefilled
 * from the alert, with what the alert could not say pointed out above it and
 * the alert itself below.
 *
 * `isPrefilled` stays off on purpose. The user's rules then decide category,
 * account and budget exactly as they would while typing — a rule saved after
 * the alert arrived still wins over the merchant-list guess it was stored with.
 */
export function CandidateReview({ candidate, categories, accounts, rules }: CandidateReviewProps) {
  const confirm = useConfirmCandidate();
  const link = useLinkCandidate();
  const resolve = useResolveCandidate();
  const separate = useSeparateDuplicate();

  const [rememberAccount, setRememberAccount] = useState(true);
  const [rememberCategory, setRememberCategory] = useState(false);

  const appCurrency = getActiveCurrency().code;
  const isForeign = candidate.currency !== null && candidate.currency !== appCurrency;
  const payee = candidate.counterparty === null ? null : labelOf(candidate.counterparty);
  /* The tail is worth remembering only when no saved account already claims it. */
  const canRememberAccount = candidate.instrumentTail !== null && candidate.account === null;

  const saveOnce = useSubmitOnce(async (draft: ExpenseDraft, appliedRuleId: string | null) => {
    const outcome = await confirm.run(candidate.id, {
      expense: {
        occurredAt: draft.occurredAt,
        amountMinor: draft.amountMinor,
        item: draft.item,
        note: draft.note,
        categoryId: draft.categoryId,
        accountId: draft.accountId,
        countsToBudget: draft.countsToBudget,
      },
      rememberAccount: canRememberAccount && rememberAccount,
      rememberCategoryId: rememberCategory ? draft.categoryId : null,
      appliedRuleId,
    });
    if (!outcome.ok) return false;
    router.back();
    return true;
  });

  const leaveAs = async (status: 'dismissed' | 'not_transaction') => {
    const outcome = await resolve.run(candidate.id, status);
    if (outcome.ok) router.back();
  };

  const linkTo = async (expenseId: string) => {
    const outcome = await link.run(candidate.id, expenseId);
    if (outcome.ok) router.back();
  };

  const notes = candidateNotes(candidate, appCurrency);
  const errorMessage =
    confirm.errorMessage ?? link.errorMessage ?? resolve.errorMessage ?? separate.errorMessage;

  const notice =
    notes.length === 0 && candidate.linkable.length === 0 ? undefined : (
      <View className="gap-3">
        {notes.length > 0 && (
          <View className="gap-2 rounded-2xl bg-surface px-4 py-3">
            {notes.map((note) => (
              <View key={note} className="flex-row gap-2">
                <View className="pt-0.5">
                  <Icon icon={Info} color="warning" size={14} />
                </View>
                <Typography type="body-xs" color="muted" className="flex-1">
                  {note}
                </Typography>
              </View>
            ))}
          </View>
        )}

        {candidate.linkable.map((expense) => (
          <View key={expense.id} className="gap-2 rounded-2xl bg-surface px-4 py-3">
            <View className="flex-row items-center gap-2">
              <Icon icon={Link2} color="accent" size={14} />
              <Typography type="body-xs" color="muted" className="flex-1">
                {`Is this “${expense.item}”, ${formatMinor(expense.amountMinor)} on ${formatDayLabel(expense.occurredAt)}, which you already added?`}
              </Typography>
            </View>
            <Button
              label="Yes, it's that one"
              tone="secondary"
              size="sm"
              isDisabled={link.isPending}
              onPress={() => void linkTo(expense.id)}
            />
          </View>
        ))}
      </View>
    );

  return (
    <ExpenseForm
      title={candidate.kind === 'transaction' ? 'Confirm payment' : 'Review message'}
      submitLabel="Add expense"
      categories={categories}
      accounts={accounts}
      rules={rules}
      initial={{
        /* A foreign figure is never put in the rupee field: an expense is one
           currency, and USD 12.99 saved as ₹12.99 is silently wrong. */
        entry: candidate.amountMinor === null || isForeign ? '' : minorToEntry(candidate.amountMinor),
        item: candidate.item,
        categoryId: candidate.category?.id ?? null,
        accountId: candidate.account?.id ?? null,
        occurredAt: candidate.occurredAt,
      }}
      amountOptions={isForeign ? [] : candidate.amountCandidates}
      notice={notice}
      isSubmitting={confirm.isPending}
      errorMessage={errorMessage}
      onSubmit={(draft, appliedRuleId) => void saveOnce.submit(draft, appliedRuleId)}
      onClose={() => router.back()}
      extra={
        <>
          {canRememberAccount && (
            <View className="flex-row items-center gap-3 rounded-2xl bg-surface px-4 py-3">
              <Typography type="body-sm" color="muted" className="flex-1">
                {`Remember ••${candidate.instrumentTail} as the account you pick`}
              </Typography>
              <Switch
                isSelected={rememberAccount}
                onSelectedChange={setRememberAccount}
                accessibilityLabel={`Remember ${candidate.instrumentTail} as the account you pick`}
              />
            </View>
          )}

          {payee !== null && (
            <View className="flex-row items-center gap-3 rounded-2xl bg-surface px-4 py-3">
              <Typography type="body-sm" color="muted" className="flex-1">
                {`Always file “${payee}” under the category you pick`}
              </Typography>
              <Switch
                isSelected={rememberCategory}
                onSelectedChange={setRememberCategory}
                accessibilityLabel={`Always file ${payee} under the category you pick`}
              />
            </View>
          )}

          {candidate.duplicates.map((duplicate) => (
            <View key={duplicate.id} className="gap-2 rounded-2xl bg-surface px-4 py-3">
              <Typography type="body-xs" color="muted">
                {`Also announced by ${sourceAppName(duplicate.source, duplicate.packageName)}, so it is shown once.`}
              </Typography>
              <Button
                label="These are two different payments"
                tone="secondary"
                size="sm"
                isDisabled={separate.isPending}
                onPress={() => void separate.run(duplicate.id)}
              />
            </View>
          ))}

          <SourceMessage text={candidate.sourceText} initiallyOpen />
          <MisreadReport body={candidate.body} />

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button
                label="Not a payment"
                tone="secondary"
                size="sm"
                isDisabled={resolve.isPending}
                onPress={() => void leaveAs('not_transaction')}
              />
            </View>
            <View className="flex-1">
              <Button
                label="Dismiss"
                tone="secondary"
                size="sm"
                isDisabled={resolve.isPending}
                onPress={() => void leaveAs('dismissed')}
              />
            </View>
          </View>
        </>
      }
    />
  );
}
