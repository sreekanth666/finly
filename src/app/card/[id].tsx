import { router, useLocalSearchParams } from 'expo-router';
import { Typography } from 'heroui-native';
import { ArrowLeft, CreditCard, Plus, Receipt, Wallet } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Amount } from '@/components/amount';
import { Button } from '@/components/button';
import { CardOwedSheet } from '@/components/card-owed-sheet';
import { UTILISATION_STATUSES } from '@/components/card-utilisation-list';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Meter } from '@/components/meter';
import { NotFound } from '@/components/not-found';
import { RecordCardPaymentSheet, type CardPaymentDraft } from '@/components/record-card-payment-sheet';
import { SafeAreaView } from '@/components/safe-area-view';
import { SectionHeader } from '@/components/section-header';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { UndoToast } from '@/components/undo-toast';
import {
  addCardPayment,
  restoreCardPayment,
  setCardOpeningOwed,
  softDeleteCardPayment,
  undoConversion,
  type CardPaymentListItem,
} from '@/db/repositories/card-payments';
import { useAction, useSubmitOnce } from '@/db/use-action';
import { absMinor, formatMinor, speakMinor, type Minor } from '@/domain/money';
import { formatDateLong, formatDayLabel } from '@/domain/period';
import { useCard } from '@/features/accounts/hooks';
import { useAccounts } from '@/features/catalog/hooks';
import { useNavigateOnce } from '@/features/navigation/hooks';

type Undoable =
  | { kind: 'deleted'; paymentId: string }
  | { kind: 'converted'; paymentId: string };

const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

function PaymentRow({ payment }: { payment: CardPaymentListItem }) {
  return (
    <View className="flex-row items-center gap-3 bg-surface px-3 py-2.5">
      <View className="size-9 items-center justify-center rounded-xl bg-surface-secondary">
        <Icon icon={Wallet} color="income" size={16} />
      </View>

      <View className="flex-1 gap-0.5">
        <Typography type="body-sm" weight="semibold" truncate>
          {payment.note ?? 'Payment'}
        </Typography>
        <Typography type="body-xs" color="muted" truncate>
          {[formatDayLabel(payment.paidAt), payment.fromAccount?.name].filter(Boolean).join(' · ')}
        </Typography>
      </View>

      <Amount
        value={payment.amountMinor}
        className="type-amount-sm text-income"
        fractionClassName="type-amount-sm"
      />
    </View>
  );
}

/**
 * One credit card: what it owes, the payments against it, and the way in to
 * recording another (D20).
 */
export default function CardScreen() {
  const params = useLocalSearchParams<{ id: string; converted?: string | string[] }>();
  const id = params.id;

  /*
   * Every hook above every return. `useCard` flips from undefined to a row
   * between renders, and a hook under the not-found return would change the
   * hook count — the crash four detail routes once shared.
   */
  const card = useCard(id);
  const accounts = useAccounts();
  const navigate = useNavigateOnce();

  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isOwedOpen, setIsOwedOpen] = useState(false);
  /* Arriving from "This was a card bill payment" on an expense: the conversion
     is offered back for as long as a delete would be. The screen mounts fresh
     for each arrival, so the param only has to seed the state once. */
  const [undoable, setUndoable] = useState<Undoable | null>(() => {
    const converted = firstParam(params.converted);
    return converted === undefined ? null : { kind: 'converted', paymentId: converted };
  });

  const record = useAction(addCardPayment);
  const anchor = useAction(setCardOpeningOwed);
  const remove = useAction(softDeleteCardPayment);
  const restore = useAction(restoreCardPayment);
  const unconvert = useAction(undoConversion);

  /* The sheet stays on screen after a save, so the latch re-arms each time it
     opens — as the settlement sheet's does. */
  const recordOnce = useSubmitOnce(async (cardId: string, draft: CardPaymentDraft) => {
    const outcome = await record.run({
      accountId: cardId,
      amountMinor: draft.amountMinor,
      paidAt: draft.paidAt,
      fromAccountId: draft.fromAccountId,
      note: draft.note,
    });
    if (!outcome.ok) return false;
    setIsPaymentOpen(false);
    return true;
  });

  const setPaymentOpen = (next: boolean) => {
    if (next) recordOnce.reset();
    setIsPaymentOpen(next);
  };

  const saveOwed = async (cardId: string, owedMinor: Minor) => {
    const outcome = await anchor.run(cardId, owedMinor, Date.now());
    if (outcome.ok) setIsOwedOpen(false);
  };

  const failure = card.error ?? accounts.error;
  if (failure !== null && failure !== undefined) {
    return <NotFound title="Can't open this card" description={failure.message} />;
  }

  const view = card.data;
  if (view === null) {
    return (
      <NotFound
        title="Card not found"
        description="It may have been removed, or changed to another kind of account."
      />
    );
  }
  if (view === undefined) return null;

  const { account, standing, payments } = view;
  const status = UTILISATION_STATUSES[standing.band];
  const isTracked = standing.owedMinor !== null;
  const isInCredit = standing.owedMinor !== null && standing.owedMinor < 0;
  const headline = standing.owedMinor === null ? standing.cycleSpendMinor : absMinor(standing.owedMinor);
  const cycleLine = `This cycle: ${formatMinor(standing.cycleSpendMinor, { showFraction: false })} spent · ${
    standing.daysToStatement === 1 ? '1 day' : `${standing.daysToStatement} days`
  } to statement`;

  const openTransactions = () =>
    navigate({
      pathname: '/transactions',
      params: { account: account.id, at: String(Date.now()) },
    });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-6 px-5 pb-10 pt-2" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between gap-2">
          <IconButton icon={ArrowLeft} label="Go back" onPress={() => router.back()} />
          <Button
            label="Edit card"
            tone="secondary"
            size="sm"
            onPress={() => navigate(`/settings/accounts/${account.id}`)}
          />
        </View>

        <View className="items-center gap-1">
          <Icon icon={CreditCard} color="muted" size={20} />
          <Typography type="h5" weight="semibold">
            {account.name}
          </Typography>
          {account.last4 !== null && (
            <Typography type="body-xs" color="muted">
              {`•• ${account.last4}`}
            </Typography>
          )}
        </View>

        <View
          className="gap-3 rounded-3xl bg-surface p-4"
          accessible
          accessibilityLabel={
            standing.owedMinor === null
              ? `${speakMinor(standing.cycleSpendMinor)} spent this cycle of ${speakMinor(standing.creditLimitMinor)}, ${status.label}`
              : isInCredit
                ? `${speakMinor(headline)} in credit`
                : `${speakMinor(headline)} owed of ${speakMinor(standing.creditLimitMinor)}, ${status.label}`
          }>
          <View className="gap-1">
            <Typography type="body-sm" color="muted">
              {!isTracked ? 'Spent this cycle' : isInCredit ? 'In credit' : 'Owed'}
            </Typography>
            <Amount
              value={headline}
              className={isInCredit ? 'type-metric text-income' : 'type-metric text-foreground'}
            />
            <Typography type="body-xs" color="muted">
              {`of ${formatMinor(standing.creditLimitMinor, { showFraction: false })} limit`}
            </Typography>
          </View>

          <Meter progress={standing.utilisation} tone={status.meter} />

          <View className="flex-row items-center gap-1.5">
            <Icon icon={status.icon} color={status.iconTone} size={12} />
            <Typography type="body-xs" className={status.text}>
              {`${status.label} · ${Math.round(standing.utilisation * 100)}%`}
            </Typography>
          </View>

          <View className="gap-1 border-t border-border pt-3">
            <Typography type="body-xs" color="muted">
              {isTracked
                ? cycleLine
                : `${standing.daysToStatement === 1 ? '1 day' : `${standing.daysToStatement} days`} to statement`}
            </Typography>
            {standing.trackedSince !== null && (
              <Typography type="body-xs" color="muted">
                {`Counting since ${formatDateLong(standing.trackedSince)}`}
              </Typography>
            )}
          </View>
        </View>

        {/* D20: until the card is anchored, nothing it could show would be what
            it owes — the app has its purchases but not the payments before them. */}
        {!isTracked && (
          <View className="gap-3 rounded-3xl bg-surface p-4">
            <View className="gap-1">
              <Typography type="body-sm" weight="semibold">
                Track what you owe
              </Typography>
              <Typography type="body-xs" color="muted">
                Enter what this card owes today, from its app or statement. Spending on it then adds
                to that, and the payments you record bring it down.
              </Typography>
            </View>
            <Button label="Set what you owe" tone="secondary" onPress={() => setIsOwedOpen(true)} />
          </View>
        )}

        <View className="gap-3">
          <Button icon={Plus} label="Record payment" onPress={() => setPaymentOpen(true)} />
          <View className="flex-row gap-3">
            {isTracked && (
              <View className="flex-1">
                <Button
                  label="Adjust balance"
                  tone="secondary"
                  size="sm"
                  onPress={() => setIsOwedOpen(true)}
                />
              </View>
            )}
            <View className="flex-1">
              <Button
                icon={Receipt}
                label="Transactions"
                tone="secondary"
                size="sm"
                accessibilityLabel="See this card's transactions"
                onPress={openTransactions}
              />
            </View>
          </View>
        </View>

        <View className="gap-3">
          <SectionHeader
            label="Payments"
            trailing={
              <Typography type="body-xs" color="muted">
                {payments.length === 0 ? 'None yet' : `${payments.length} recorded`}
              </Typography>
            }
          />

          {payments.length === 0 ? (
            <Typography type="body-xs" color="muted" className="px-1">
              Payments you record here, from a card-bill alert in the inbox, or from an expense that
              was really a bill payment will show up here.
            </Typography>
          ) : (
            <View className="overflow-hidden rounded-3xl bg-surface">
              {payments.map((payment) => (
                <SwipeToDelete
                  key={payment.id}
                  accessibilityLabel={`Payment of ${speakMinor(payment.amountMinor)}`}
                  onDelete={async () => {
                    const outcome = await remove.run(payment.id);
                    /* Offered only once the delete landed, as on Transactions. */
                    if (outcome.ok) setUndoable({ kind: 'deleted', paymentId: payment.id });
                  }}>
                  <PaymentRow payment={payment} />
                </SwipeToDelete>
              ))}
            </View>
          )}

          {(remove.errorMessage ?? unconvert.errorMessage ?? restore.errorMessage) !== null && (
            <Typography type="body-xs" className="text-danger">
              {remove.errorMessage ?? unconvert.errorMessage ?? restore.errorMessage}
            </Typography>
          )}

          {payments.length > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={openTransactions}
              className="self-start px-1 active:opacity-60">
              <Typography type="body-xs" className="text-link">
                See what was bought on this card
              </Typography>
            </Pressable>
          )}
        </View>
      </ScrollView>

      {undoable !== null && (
        <UndoToast
          message={undoable.kind === 'deleted' ? 'Payment removed' : 'Moved to this card’s payments'}
          onUndo={async () => {
            if (undoable.kind === 'deleted') {
              await restore.run(undoable.paymentId);
              setUndoable(null);
            } else {
              const outcome = await unconvert.run(undoable.paymentId);
              setUndoable(null);
              /* The expense is back where it came from, and so is the user. */
              if (outcome.ok) router.back();
            }
          }}
          onExpire={() => setUndoable(null)}
        />
      )}

      <RecordCardPaymentSheet
        isOpen={isPaymentOpen}
        onOpenChange={setPaymentOpen}
        cardId={account.id}
        cardName={account.name}
        owedMinor={standing.owedMinor}
        accounts={accounts.data ?? []}
        isSubmitting={record.isPending}
        errorMessage={record.errorMessage}
        onRecord={(draft) => void recordOnce.submit(account.id, draft)}
      />

      <CardOwedSheet
        isOpen={isOwedOpen}
        onOpenChange={setIsOwedOpen}
        cardName={account.name}
        isAdjusting={isTracked}
        isSubmitting={anchor.isPending}
        errorMessage={anchor.errorMessage}
        onSave={(owedMinor) => void saveOwed(account.id, owedMinor)}
      />
    </SafeAreaView>
  );
}
