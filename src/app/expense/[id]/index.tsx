import { router, useLocalSearchParams } from 'expo-router';
import { Typography } from 'heroui-native';
import { ArrowLeft, Plus, Undo2 } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddSettlementSheet } from '@/components/add-settlement-sheet';
import { Amount } from '@/components/amount';
import { Button } from '@/components/button';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { SectionHeader } from '@/components/section-header';
import { findAccount } from '@/data/accounts';
import { CATEGORIES } from '@/data/categories';
import { findSettlements, type Settlement } from '@/data/settlements';
import { findTransaction } from '@/data/transactions';
import { summariseSettlements } from '@/domain/settlement';

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

function SettlementRow({ settlement }: { settlement: Settlement }) {
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
          {[settlement.settledAt, settlement.accountName].filter(Boolean).join(' · ')}
        </Typography>
      </View>

      <Amount
        value={settlement.amount}
        signed
        className="type-amount-sm text-income"
        centsClassName="type-amount-sm"
      />
    </View>
  );
}

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const found = findTransaction(id);

  if (!found) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
        <View className="flex-1 items-center justify-center gap-3 px-5">
          <Typography type="body" weight="medium">
            Expense not found
          </Typography>
          <Typography type="body-sm" color="muted" align="center">
            It may have been deleted since this screen was opened.
          </Typography>
          <Button tone="secondary" label="Go back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const { transaction, day } = found;
  const category = CATEGORIES[transaction.categoryId];

  /* Seeded from the mock, then held locally so a settlement added in the sheet
     changes the effective amount straight away. */
  const [settlementList, setSettlementList] = useState<Settlement[]>(() =>
    findSettlements(transaction.id)
  );
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const { settled, effective, isSettled, isPartlySettled } = summariseSettlements(
    transaction.amount,
    settlementList
  );
  const hasReturns = isSettled || isPartlySettled;
  const cost = Math.abs(transaction.amount);

  const recordRows = [
    {
      key: 'category',
      label: 'Category',
      content: (
        <>
          <Icon icon={category.icon} color={category.tone} size={14} />
          <Typography type="body-sm" truncate>
            {category.label}
          </Typography>
        </>
      ),
    },
    {
      key: 'account',
      label: 'Account',
      content: (
        <Typography type="body-sm" truncate>
          {transaction.accountName ?? 'Not set'}
        </Typography>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      content: <Typography type="body-sm">{`${day.label} · ${transaction.time}`}</Typography>,
    },
    {
      key: 'counts',
      label: 'Counts to budget',
      content: (
        <Typography type="body-sm">
          {transaction.countsToBudget === false ? 'No' : 'Yes'}
        </Typography>
      ),
    },
    ...(transaction.note
      ? [
          {
            key: 'note',
            label: 'Note',
            content: (
              <Typography type="body-sm" className="flex-1" align="end">
                {transaction.note}
              </Typography>
            ),
          },
        ]
      : []),
  ];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-1 px-3 pt-2">
        <IconButton icon={ArrowLeft} label="Back" onPress={() => router.back()} />
        <Typography type="body" weight="semibold" className="flex-1">
          Expense
        </Typography>
        <Button
          tone="secondary"
          size="sm"
          label="Edit"
          onPress={() => router.push(`/expense/${transaction.id}/edit`)}
        />
      </View>

      <ScrollView
        contentContainerClassName="gap-6 px-5 pb-8 pt-4"
        showsVerticalScrollIndicator={false}>
        <View className="items-center gap-2">
          <Typography type="body-xs" color="muted">
            {hasReturns ? 'Effective amount' : 'Amount'}
          </Typography>
          <Amount value={effective} className="type-metric text-foreground" showCents={false} />

          {/* The original stays visible — a settlement offsets an expense, it
              never rewrites what was actually spent (D1). */}
          {hasReturns && (
            <View className="flex-row items-center gap-2">
              <Amount value={cost} className="type-amount-sm text-muted line-through" centsClassName="type-amount-sm" />
              <Typography type="body-xs" color="muted">
                originally
              </Typography>
            </View>
          )}

          <Typography type="h5" weight="semibold" className="pt-2">
            {transaction.title}
          </Typography>
        </View>

        {hasReturns && (
          <View className="flex-row items-center gap-2 rounded-2xl bg-surface px-4 py-3">
            <Icon icon={Undo2} color="income" size={14} />
            <Typography type="body-xs" color="muted" className="flex-1">
              {`$${settled.toFixed(2)} of $${cost.toFixed(2)} returned — counts as $${effective.toFixed(2)}.`}
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
              <Typography type="body-sm" color="muted">
                {settlementList.length === 0
                  ? 'None yet'
                  : `${settlementList.length} returned`}
              </Typography>
            }
          />

          <View className="gap-3 rounded-3xl bg-surface p-2">
            {settlementList.length === 0 ? (
              <Typography type="body-xs" color="muted" className="px-2 pt-1">
                Nothing has come back against this expense. Recording a settlement keeps the
                original spend intact instead of editing it away.
              </Typography>
            ) : (
              <View className="gap-1">
                {settlementList.map((settlement) => (
                  <SettlementRow key={settlement.id} settlement={settlement} />
                ))}
              </View>
            )}

            <Button
              tone="secondary"
              icon={Plus}
              label="Add settlement"
              isDisabled={isSettled}
              onPress={() => setIsSheetOpen(true)}
            />
          </View>

          {isSettled && (
            <Typography type="body-xs" color="muted" className="px-1">
              Fully returned — settlements can’t exceed the expense.
            </Typography>
          )}
        </View>
      </ScrollView>

      <AddSettlementSheet
        isOpen={isSheetOpen}
        onOpenChange={setIsSheetOpen}
        expenseTitle={transaction.title}
        outstanding={effective}
        onAdd={(draft) =>
          setSettlementList((current) => [
            ...current,
            {
              id: `s-local-${current.length + 1}`,
              expenseId: transaction.id,
              amount: draft.amount,
              settledAt: draft.date === 'today' ? 'Today' : draft.date === 'yesterday' ? 'Yesterday' : 'Earlier',
              accountName: findAccount(draft.accountId ?? '')?.name,
              note: draft.note.length > 0 ? draft.note : undefined,
            },
          ])
        }
      />
    </SafeAreaView>
  );
}
