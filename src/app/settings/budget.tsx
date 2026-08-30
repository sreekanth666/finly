import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { ArrowLeft } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Amount } from '@/components/amount';
import { AmountKeypad } from '@/components/amount-keypad';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { SafeAreaView } from '@/components/safe-area-view';
import { SectionHeader } from '@/components/section-header';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { setDefaultMonthlyBudget } from '@/db/repositories/budgets';
import { useAction } from '@/db/use-action';
import { useBudgetHistory, useDefaultMonthlyBudget } from '@/features/budget/hooks';
import { appendKey, type KeypadKey } from '@/domain/amount-entry';
import { absMinor, entryToMinor, formatEntry, formatMinor, minorToEntry } from '@/domain/money';
import { formatPeriodLong } from '@/domain/period';
import type { PeriodResult } from '@/domain/budget';

/** Spelled out per state so the compiler sees both. */
const PERIOD_STATUS = {
  over: { label: 'Overspent', text: 'text-danger' },
  under: { label: 'Left over', text: 'text-muted' },
} as const;

function PeriodRow({ period, isFirst }: { period: PeriodResult; isFirst: boolean }) {
  const status = period.isOverspent ? PERIOD_STATUS.over : PERIOD_STATUS.under;

  return (
    <View
      className={
        isFirst ? 'gap-2 px-4 py-3.5' : 'gap-2 border-t border-border px-4 py-3.5'
      }>
      <View className="flex-row items-center justify-between gap-3">
        <Typography type="body-sm" weight="semibold" truncate>
          {formatPeriodLong(period.period)}
        </Typography>
        <View className="flex-row items-center gap-1.5">
          <Typography type="body-xs" className={status.text}>
            {status.label}
          </Typography>
          <Amount
            value={absMinor(period.remaining)}
            className={`type-amount-sm ${status.text}`}
            fractionClassName="type-amount-sm"
          />
        </View>
      </View>

      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
        <Typography type="body-xs" color="muted">
          {`Budget ${formatMinor(period.budget, { showFraction: false })}`}
        </Typography>
        {period.carryOver > 0 && (
          <Typography type="body-xs" className="text-danger">
            {`− ${formatMinor(period.carryOver)} carried in`}
          </Typography>
        )}
        <Typography type="body-xs" color="muted">
          {`Available ${formatMinor(period.available)}`}
        </Typography>
        <Typography type="body-xs" color="muted">
          {`Spent ${formatMinor(period.spent)}`}
        </Typography>
      </View>
    </View>
  );
}

export default function BudgetSettingsScreen() {
  const stored = useDefaultMonthlyBudget();
  const historyQuery = useBudgetHistory();
  const save = useAction(setDefaultMonthlyBudget);

  /* Seeded once from the stored figure. Re-seeding it on every change would
     fight the keypad mid-edit, since saving writes the value being typed. */
  const [entry, setEntry] = useState<string | null>(null);
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);

  const currentEntry = entry ?? (stored.data === undefined ? '' : minorToEntry(stored.data));

  /* Newest first on screen; the walk itself needs oldest first. */
  const history = useMemo(
    () => [...(historyQuery.data ?? [])].reverse(),
    [historyQuery.data],
  );

  const amountMinor = entryToMinor(currentEntry);
  const isChanged = stored.data !== undefined && amountMinor !== stored.data;
  const canSave = amountMinor > 0 && isChanged && !save.isPending;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-1 px-3 pt-2">
        <IconButton icon={ArrowLeft} label="Back" onPress={() => router.back()} />
        <Typography type="body" weight="semibold">
          Monthly budget
        </Typography>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Edit monthly budget"
        onPress={() => setIsKeypadOpen(true)}
        className="items-center gap-1 px-5 py-6 active:opacity-60">
        <Typography type="body-xs" color="muted">
          Every month
        </Typography>
        <Typography
          className={
            currentEntry.length > 0 ? 'type-metric text-foreground' : 'type-metric text-muted'
          }>
          {formatEntry(currentEntry)}
        </Typography>
      </Pressable>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-5 pb-8"
        showsVerticalScrollIndicator={false}>
        <SectionHeader
          label="Carry-over history"
          trailing={
            <Typography type="body-sm" color="muted">
              Newest first
            </Typography>
          }
        />

        {historyQuery.error !== null ? (
          <ErrorState error={historyQuery.error} onRetry={historyQuery.refetch} />
        ) : history.length === 0 ? (
          <EmptyState
            title="No history yet"
            description="Once you have a month of expenses, its carry-over shows up here."
          />
        ) : (
          <View className="rounded-3xl bg-surface">
            {history.map((period, index) => (
              <PeriodRow key={period.period} period={period} isFirst={index === 0} />
            ))}
          </View>
        )}

        <Typography type="body-xs" color="muted" className="px-1">
          Only overspending carries. An underspent month banks nothing, and two bad months in a
          row bite twice — the second inherits what the first already lost.
        </Typography>
      </ScrollView>

      <View className="gap-3 border-t border-border px-5 pt-3">
        {save.errorMessage !== null && (
          <Typography type="body-xs" className="text-danger">
            {save.errorMessage}
          </Typography>
        )}

        <Button
          label={save.isPending ? 'Saving…' : 'Save budget'}
          isDisabled={!canSave}
          onPress={async () => {
            const outcome = await save.run(amountMinor);
            if (outcome.ok) router.back();
          }}
        />

        {isKeypadOpen && (
          <View className="gap-2">
            {/* The design pass had no way to put the keypad away once it was up,
                which left the carry-over history it covers unreachable. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close the keypad"
              onPress={() => setIsKeypadOpen(false)}
              className="self-end active:opacity-60">
              <Typography type="body-xs" className="text-link">
                Done
              </Typography>
            </Pressable>
            <AmountKeypad
              onKeyPress={(key: KeypadKey) =>
                setEntry((current) => appendKey(current ?? currentEntry, key))
              }
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
