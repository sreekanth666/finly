import { router, useLocalSearchParams } from 'expo-router';
import { Typography } from 'heroui-native';
import { ArrowLeft, Plus, Trash2, Undo2 } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { AddSettlementSheet } from '@/components/add-settlement-sheet';
import { Amount } from '@/components/amount';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { iconFor } from '@/components/icon-registry';
import { IconButton } from '@/components/icon-button';
import { NotFound } from '@/components/not-found';
import { SafeAreaView } from '@/components/safe-area-view';
import { SectionHeader } from '@/components/section-header';
import { softDeleteExpense } from '@/db/repositories/expenses';
import {
  addSettlement,
  softDeleteSettlement,
  type SettlementListItem,
} from '@/db/repositories/settlements';
import { useAction } from '@/db/use-action';
import { formatMinor } from '@/domain/money';
import { formatDateLong, formatDayLabel, formatTime } from '@/domain/period';
import { summariseSettlements } from '@/domain/settlement';
import { useAccounts } from '@/features/catalog/hooks';
import { useExpenseDetail } from '@/features/expenses/hooks';
import { toAppColor } from '@/theme';

/**
 * Class strings spelled out per position. `divide-y` is not an option: it
 * compiles to a child-combinator selector, which has no meaning on native and
 * silently renders no separator at all.
 */
const ROW = {
  first: 'flex-row items-center justify-between gap-4 px-4 py-3',
  rest: 'flex-row items-center justify-between gap-4 border-t border-border px-4 py-3',
} as const;

type DetailRowProps = { label: string; isFirst: boolean; children: React.ReactNode };

function DetailRow({ label, isFirst, children }: DetailRowProps) {
  return (
    <View className={isFirst ? ROW.first : ROW.rest}>
      <Typography type="body-sm" color="muted">
        {label}
      </Typography>
      <View className="flex-1 flex-row items-center justify-end gap-2">{children}</View>
    </View>
  );
}

function SettlementRow({
  settlement,
  onDelete,
}: {
  settlement: SettlementListItem;
  onDelete: () => void;
}) {
  return (
    <View className="flex-row items-center gap-3 px-2 py-2">
      <View className="size-9 items-center justify-center rounded-xl bg-surface-secondary">
        <Icon icon={Undo2} color="income" size={16} />
      </View>

      <View className="flex-1 gap-0.5">
        <Typography type="body-sm" weight="semibold" truncate>
          {settlement.note ?? 'Returned'}
        </Typography>
        <Typography type="body-xs" color="muted" truncate>
          {[formatDayLabel(settlement.settledAt), settlement.account?.name]
            .filter(Boolean)
            .join(' · ')}
        </Typography>
      </View>

      <Amount
        value={settlement.amountMinor}
        sign="always"
        className="type-amount-sm text-income"
        fractionClassName="type-amount-sm"
      />

      {/* A settlement entered by mistake has to be removable, or the expense is
          stuck reading a figure that never happened. Soft delete, so the
          expense's own history stays intact. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Remove this settlement"
        hitSlop={8}
        onPress={onDelete}
        className="size-8 items-center justify-center rounded-lg active:bg-surface-secondary">
        <Icon icon={Trash2} color="muted" size={14} />
      </Pressable>
    </View>
  );
}

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  /*
   * Every hook is above every return, without exception. The design pass had a
   * useState below an early return, which was safe only while the lookup was a
   * synchronous fixture read that could never change its answer. A query flips
   * from undefined to a row between renders, and a hook underneath it would
   * change the hook count — "Rendered more hooks than during the previous
   * render". The not-found case is a data state at the bottom now.
   */
  const detail = useExpenseDetail(id);
  const accounts = useAccounts();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const settle = useAction(addSettlement);
  const remove = useAction(softDeleteExpense);
  const removeSettlement = useAction(softDeleteSettlement);

  const failure = detail.error ?? accounts.error;
  if (failure !== null && failure !== undefined) {
    return <NotFound title="Can't open this expense" description={failure.message} />;
  }

  const view = detail.data;
  if (view === null) {
    return (
      <NotFound
        title="Expense not found"
        description="It may have been deleted from another screen."
      />
    );
  }
  if (view === undefined) return null;

  const { expense, settlements } = view;
  const { settledMinor, effectiveMinor, isSettled, isPartlySettled } = summariseSettlements(
    expense.amountMinor,
    expense.settledMinor,
  );
  const hasReturns = isSettled || isPartlySettled;

  const confirmDelete = () => {
    Alert.alert('Delete this expense?', 'It will be removed from your totals.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const outcome = await remove.run(expense.id);
          if (outcome.ok) router.back();
        },
      },
    ]);
  };

  const recordRows = [
    {
      key: 'category',
      label: 'Category',
      content: expense.category ? (
        <>
          <Icon
            icon={iconFor(expense.category.icon)}
            color={toAppColor(expense.category.colorToken, 'muted')}
            size={15}
          />
          <Typography type="body-sm" weight="medium">
            {expense.category.name}
          </Typography>
        </>
      ) : (
        <Typography type="body-sm" color="muted">
          Uncategorised
        </Typography>
      ),
    },
    {
      key: 'account',
      label: 'Paid from',
      content: (
        <Typography type="body-sm" weight="medium">
          {expense.account?.name ?? 'Not recorded'}
        </Typography>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      content: (
        <Typography type="body-sm" weight="medium">
          {`${formatDateLong(expense.occurredAt)}, ${formatTime(expense.occurredAt)}`}
        </Typography>
      ),
    },
    {
      key: 'budget',
      label: 'Counts to budget',
      content: (
        <Typography type="body-sm" weight="medium">
          {expense.countsToBudget ? 'Yes' : 'No'}
        </Typography>
      ),
    },
    ...(expense.note === null
      ? []
      : [
          {
            key: 'note',
            label: 'Note',
            content: (
              <Typography type="body-sm" weight="medium" className="flex-1 text-right">
                {expense.note}
              </Typography>
            ),
          },
        ]),
  ];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-6 px-5 pb-10 pt-2" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between gap-2">
          <IconButton icon={ArrowLeft} label="Go back" onPress={() => router.back()} />
          <View className="flex-row items-center gap-2">
            <IconButton icon={Trash2} label="Delete expense" color="danger" onPress={confirmDelete} />
            <Button
              label="Edit"
              tone="secondary"
              size="sm"
              onPress={() => router.push(`/expense/${expense.id}/edit`)}
            />
          </View>
        </View>

        <View className="items-center gap-1 pt-2">
          <Typography type="body-xs" color="muted">
            {hasReturns ? 'Counts as' : 'Amount'}
          </Typography>
          <Amount value={effectiveMinor} className="type-metric text-foreground" showFraction={false} />

          {/* The original stays visible — a settlement offsets an expense, it
              never rewrites what was actually spent (D1). */}
          {hasReturns && (
            <View className="flex-row items-center gap-2">
              <Amount
                value={expense.amountMinor}
                className="type-amount-sm text-muted line-through"
                fractionClassName="type-amount-sm"
              />
              <Typography type="body-xs" color="muted">
                originally
              </Typography>
            </View>
          )}

          <Typography type="h5" weight="semibold" className="pt-2">
            {expense.item}
          </Typography>
        </View>

        {hasReturns && (
          <View className="flex-row items-center gap-2 rounded-2xl bg-surface px-4 py-3">
            <Icon icon={Undo2} color="income" size={14} />
            <Typography type="body-xs" color="muted" className="flex-1">
              {`${formatMinor(settledMinor)} of ${formatMinor(expense.amountMinor)} returned — counts as ${formatMinor(effectiveMinor)}.`}
            </Typography>
          </View>
        )}

        <View className="gap-3">
          <SectionHeader label="Record" />
          <View className="rounded-3xl bg-surface">
            {recordRows.map((row, index) => (
              <DetailRow key={row.key} label={row.label} isFirst={index === 0}>
                {row.content}
              </DetailRow>
            ))}
          </View>
        </View>

        <View className="gap-3">
          <SectionHeader
            label="Settlements"
            trailing={
              <Typography type="body-xs" color="muted">
                {settlements.length === 0
                  ? 'None yet'
                  : `${formatMinor(settledMinor)} returned`}
              </Typography>
            }
          />

          {settlements.length > 0 && (
            <View className="rounded-3xl bg-surface p-2">
              {settlements.map((settlement) => (
                <SettlementRow
                  key={settlement.id}
                  settlement={settlement}
                  onDelete={() => {
                    Alert.alert('Remove this settlement?', 'The expense goes back to its full amount.', [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => {
                          void removeSettlement.run(settlement.id);
                        },
                      },
                    ]);
                  }}
                />
              ))}
            </View>
          )}

          {(settle.errorMessage ?? removeSettlement.errorMessage) !== null && (
            <Typography type="body-xs" className="text-danger">
              {settle.errorMessage ?? removeSettlement.errorMessage}
            </Typography>
          )}

          {isSettled ? (
            <Typography type="body-xs" color="muted">
              Everything has been returned on this expense.
            </Typography>
          ) : (
            <Button
              icon={Plus}
              label="Add settlement"
              tone="secondary"
              onPress={() => setIsSheetOpen(true)}
            />
          )}
        </View>
      </ScrollView>

      <AddSettlementSheet
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        expenseTitle={expense.item}
        outstanding={effectiveMinor}
        accounts={accounts.data ?? []}
        isSubmitting={settle.isPending}
        onAdd={async (draft) => {
          const outcome = await settle.run({
            expenseId: expense.id,
            amountMinor: draft.amountMinor,
            settledAt: draft.settledAt,
            accountId: draft.accountId,
            note: draft.note,
          });
          if (outcome.ok) setIsSheetOpen(false);
        }}
      />
    </SafeAreaView>
  );
}
