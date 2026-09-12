import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { ArrowDownLeft, Check, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Amount } from './amount';
import { Button } from './button';
import { FormScreen } from './form-screen';
import { Icon } from './icon';
import { MisreadReport } from './misread-report';
import { SectionHeader } from './section-header';
import { SourceMessage } from './source-message';

import type { CandidateDetail } from '@/db/repositories/captures';
import type { ExpenseListItem } from '@/db/repositories/expenses';
import { formatMinor } from '@/domain/money';
import { formatDayLabel } from '@/domain/period';
import { useResolveCandidate, useSettleCandidate } from '@/features/capture/hooks';

export type MoneyInReviewProps = {
  candidate: CandidateDetail;
  /** Recent expenses, newest first — what money back could be against. */
  expenses: readonly ExpenseListItem[];
};

/**
 * A credit from a payment alert (D17). Finly keeps no income ledger (D4), so
 * money in has exactly two honest destinations: money back against something
 * already spent, recorded as a settlement (D1), or nowhere.
 *
 * A reversal whose original payment was detected and confirmed is offered
 * against that expense first — that is almost always what it is.
 */
export function MoneyInReview({ candidate, expenses }: MoneyInReviewProps) {
  const settle = useSettleCandidate();
  const resolve = useResolveCandidate();

  const suggestedId = candidate.reversalOf?.expenseId ?? null;
  const [chosenId, setChosenId] = useState<string | null>(suggestedId);

  const options = expenses.filter((expense) => expense.effectiveMinor > 0);
  const suggested = suggestedId === null ? undefined : options.find((expense) => expense.id === suggestedId);
  const ordered = suggested === undefined ? options : [suggested, ...options.filter((expense) => expense.id !== suggestedId)];

  const settleOn = async () => {
    if (chosenId === null) return;
    const outcome = await settle.run(candidate.id, chosenId);
    if (outcome.ok) router.back();
  };

  const leaveAs = async (status: 'dismissed' | 'not_transaction') => {
    const outcome = await resolve.run(candidate.id, status);
    if (outcome.ok) router.back();
  };

  const errorMessage = settle.errorMessage ?? resolve.errorMessage;

  return (
    <FormScreen
      title="Money in"
      closeIcon={X}
      closeLabel="Close"
      onClose={() => router.back()}
      contentContainerClassName="gap-5 px-5 pb-6"
      above={
        <View className="items-center gap-1 px-5 py-6">
          <Typography type="body-xs" color="muted">
            {candidate.kind === 'refund' ? 'Refund' : 'Received'}
          </Typography>
          {candidate.amountMinor === null ? (
            <Typography type="body" color="muted">
              No amount could be read
            </Typography>
          ) : (
            <Amount value={candidate.amountMinor} sign="always" className="type-metric text-income" />
          )}
          <Typography type="body-sm" color="muted">
            {`${candidate.item} · ${formatDayLabel(candidate.occurredAt)}`}
          </Typography>
        </View>
      }
      footer={
        <>
          {errorMessage !== null && (
            <Typography type="body-xs" className="text-danger">
              {errorMessage}
            </Typography>
          )}
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Button
                label="Dismiss"
                tone="secondary"
                isDisabled={resolve.isPending}
                onPress={() => void leaveAs('dismissed')}
              />
            </View>
            <View className="flex-1">
              <Button
                label={settle.isPending ? 'Saving…' : 'Record as money back'}
                isDisabled={chosenId === null || candidate.amountMinor === null || settle.isPending}
                onPress={() => void settleOn()}
              />
            </View>
          </View>
        </>
      }>
      <Typography type="body-xs" color="muted">
        Finly tracks spending, not income. If this money paid you back for something, pick the expense and it will
        count for less. Otherwise, dismiss it.
      </Typography>

      {suggested !== undefined && (
        <Typography type="body-xs" color="muted">
          {`This reverses “${suggested.item}”, which was read from an earlier alert.`}
        </Typography>
      )}

      <View className="gap-2">
        <SectionHeader label="Money back against" />
        {ordered.length === 0 ? (
          <Typography type="body-xs" color="muted">
            No recent expenses with anything left to settle.
          </Typography>
        ) : (
          <View className="rounded-3xl bg-surface p-1">
            {ordered.slice(0, 12).map((expense) => {
              const isChosen = expense.id === chosenId;
              return (
                <Pressable
                  key={expense.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isChosen }}
                  accessibilityLabel={`${expense.item}, ${formatMinor(expense.effectiveMinor)} outstanding`}
                  onPress={() => setChosenId(expense.id)}
                  className="flex-row items-center gap-3 rounded-2xl px-3 py-2.5 active:opacity-60">
                  <View className="size-8 items-center justify-center rounded-lg bg-surface-secondary">
                    <Icon icon={isChosen ? Check : ArrowDownLeft} color={isChosen ? 'accent' : 'muted'} size={16} />
                  </View>
                  <View className="flex-1">
                    <Typography type="body-sm" weight={isChosen ? 'semibold' : 'normal'} truncate>
                      {expense.item}
                    </Typography>
                    <Typography type="body-xs" color="muted">
                      {formatDayLabel(expense.occurredAt)}
                    </Typography>
                  </View>
                  <Amount
                    value={expense.effectiveMinor}
                    className="type-amount-sm text-foreground"
                    fractionClassName="type-amount-sm"
                  />
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <SourceMessage text={candidate.sourceText} initiallyOpen />
      <MisreadReport body={candidate.body} />

      <Button
        label="Not money received"
        tone="secondary"
        size="sm"
        isDisabled={resolve.isPending}
        onPress={() => void leaveAs('not_transaction')}
      />
    </FormScreen>
  );
}
