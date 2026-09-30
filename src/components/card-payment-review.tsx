import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Amount } from './amount';
import { AmountInput } from './amount-input';
import { Button } from './button';
import { FilterChipBar } from './filter-chip-bar';
import { FormScreen } from './form-screen';
import { MisreadActions } from './misread-actions';
import { SectionHeader } from './section-header';
import { SourceMessage } from './source-message';

import type { CandidateDetail } from '@/db/repositories/captures';
import type { AccountRow } from '@/db/schema';
import { EMPTY_ENTRY } from '@/domain/amount-entry';
import { entryToMinor } from '@/domain/money';
import { formatDayLabel } from '@/domain/period';
import { useRecordCardPayment, useResolveCandidate } from '@/features/capture/hooks';
import { useNavigateOnce } from '@/features/navigation/hooks';

export type CardPaymentReviewProps = {
  candidate: CandidateDetail;
  accounts: readonly AccountRow[];
  /** Today's path: the ordinary review form, for a bill that really was spending. */
  onAddAsExpense: () => void;
};

/** The card an alert is most likely about: the one it was matched to, then by digits. */
function likelyCard(candidate: CandidateDetail, cards: readonly AccountRow[]): string | null {
  const matched = cards.find((card) => card.id === candidate.account?.id);
  if (matched !== undefined) return matched.id;

  const tail = candidate.instrumentTail?.replace(/\D/g, '').slice(-4) ?? '';
  const byDigits = tail.length >= 3 ? cards.find((card) => card.last4 !== null && card.last4.endsWith(tail)) : undefined;
  if (byDigits !== undefined) return byDigits.id;

  return cards.length === 1 ? (cards[0]?.id ?? null) : null;
}

/**
 * A card-bill alert (D20). The classifier already knew what this was — it kept
 * these out of spending because the card's purchases arrive as their own alerts
 * — but until now there was nowhere to put one except the bin. Recorded here, it
 * lowers what the card owes.
 */
export function CardPaymentReview({ candidate, accounts, onAddAsExpense }: CardPaymentReviewProps) {
  const record = useRecordCardPayment();
  const resolve = useResolveCandidate();
  const navigate = useNavigateOnce();

  const cards = accounts.filter((account) => account.type === 'credit_card' && !account.isArchived);
  const [cardId, setCardId] = useState<string | null>(() => likelyCard(candidate, cards));
  /* Money left a bank account for a debit alert; a card issuer's "payment
     received" names only the card. */
  const [fromAccountId, setFromAccountId] = useState<string | null>(() =>
    candidate.direction === 'debit' && candidate.account !== null && !cards.some((card) => card.id === candidate.account?.id)
      ? candidate.account.id
      : null,
  );
  const [entry, setEntry] = useState(EMPTY_ENTRY);

  const amountMinor = candidate.amountMinor ?? entryToMinor(entry);
  const fromOptions = accounts
    .filter((account) => !account.isArchived && account.id !== cardId)
    .map(({ id, name }) => ({ id, label: name }));

  const recordIt = async () => {
    if (cardId === null || amountMinor <= 0) return;
    const outcome = await record.run(candidate.id, {
      cardId,
      fromAccountId,
      amountMinor: candidate.amountMinor === null ? amountMinor : undefined,
    });
    if (outcome.ok) router.back();
  };

  const dismiss = async () => {
    const outcome = await resolve.run(candidate.id, 'dismissed');
    if (outcome.ok) router.back();
  };

  const errorMessage = record.errorMessage ?? resolve.errorMessage;

  return (
    <FormScreen
      title="Card payment"
      closeIcon={X}
      closeLabel="Close"
      onClose={() => router.back()}
      contentContainerClassName="gap-5 px-5 pb-6"
      above={
        <View className="items-center gap-1 px-5 py-6">
          <Typography type="body-xs" color="muted">
            Paid toward a card
          </Typography>
          {candidate.amountMinor === null ? (
            <AmountInput value={entry} onChangeValue={setEntry} accessibilityLabel="Amount paid" />
          ) : (
            <Amount value={candidate.amountMinor} className="type-metric text-foreground" />
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
                onPress={() => void dismiss()}
              />
            </View>
            <View className="flex-1">
              <Button
                label={record.isPending ? 'Saving…' : 'Record payment'}
                isDisabled={cardId === null || amountMinor <= 0 || record.isPending}
                onPress={() => void recordIt()}
              />
            </View>
          </View>
        </>
      }>
      <Typography type="body-xs" color="muted">
        This looks like paying a credit card bill. Recording it lowers what the card owes. It is not
        counted as spending — the card’s purchases already were. If a matching payment is already
        recorded, this alert is linked to it instead of counted twice.
      </Typography>

      {cards.length === 0 ? (
        <View className="gap-3 rounded-3xl bg-surface p-4">
          <Typography type="body-xs" color="muted">
            There is no credit card in Finly to record this against yet.
          </Typography>
          <Button
            label="Add a card"
            tone="secondary"
            size="sm"
            onPress={() => navigate('/settings/accounts/new')}
          />
        </View>
      ) : (
        <View className="gap-2">
          <SectionHeader label="Card paid" />
          <View className="-mx-5">
            <FilterChipBar
              options={cards.map(({ id, name }) => ({ id, label: name }))}
              selectedId={cardId}
              onSelect={setCardId}
            />
          </View>
        </View>
      )}

      {fromOptions.length > 0 && (
        <View className="gap-2">
          <SectionHeader label="Paid from" />
          <View className="-mx-5">
            <FilterChipBar
              options={fromOptions}
              selectedId={fromAccountId}
              onSelect={(id) => setFromAccountId(fromAccountId === id ? null : id)}
            />
          </View>
        </View>
      )}

      <SourceMessage text={candidate.sourceText} initiallyOpen />
      <MisreadActions candidate={candidate} />

      {/* Only money going out could have been spending. A card issuer's
          "payment received" is money in, and has no expense form to fall back to. */}
      {candidate.direction !== 'credit' && (
        <Button label="Add as an expense instead" tone="secondary" size="sm" onPress={onAddAsExpense} />
      )}
    </FormScreen>
  );
}
