import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { ArrowLeft } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Amount } from '@/components/amount';
import { AmountKeypad } from '@/components/amount-keypad';
import { Button } from '@/components/button';
import { IconButton } from '@/components/icon-button';
import { SectionHeader } from '@/components/section-header';
import { budgetPeriods, monthlyBudget } from '@/data/budget';
import {
  appendKey,
  entryToNumber,
  formatEntry,
  numberToEntry,
  type KeypadKey,
} from '@/domain/amount-entry';
import { buildCarryOverHistory, type PeriodResult } from '@/domain/budget';

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
          {period.label}
        </Typography>
        <View className="flex-row items-center gap-1.5">
          <Typography type="body-xs" className={status.text}>
            {status.label}
          </Typography>
          <Amount
            value={Math.abs(period.remaining)}
            className={`type-amount-sm ${status.text}`}
            centsClassName="type-amount-sm"
          />
        </View>
      </View>

      <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
        <Typography type="body-xs" color="muted">
          {`Budget $${period.budget.toLocaleString('en-US')}`}
        </Typography>
        {period.carryOver > 0 && (
          <Typography type="body-xs" className="text-danger">
            {`− $${period.carryOver.toFixed(2)} carried in`}
          </Typography>
        )}
        <Typography type="body-xs" color="muted">
          {`Available $${period.available.toFixed(2)}`}
        </Typography>
        <Typography type="body-xs" color="muted">
          {`Spent $${period.spent.toFixed(2)}`}
        </Typography>
      </View>
    </View>
  );
}

export default function BudgetSettingsScreen() {
  const [entry, setEntry] = useState(() => numberToEntry(monthlyBudget));
  const [isKeypadOpen, setIsKeypadOpen] = useState(false);

  /* Newest first on screen; the walk itself needs oldest first. */
  const history = useMemo(() => [...buildCarryOverHistory(budgetPeriods)].reverse(), []);

  const canSave = entryToNumber(entry) > 0;

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
          className={entry.length > 0 ? 'type-metric text-foreground' : 'type-metric text-muted'}>
          {`$${formatEntry(entry)}`}
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

        <View className="rounded-3xl bg-surface">
          {history.map((period, index) => (
            <PeriodRow key={period.period} period={period} isFirst={index === 0} />
          ))}
        </View>

        <Typography type="body-xs" color="muted" className="px-1">
          Only overspending carries. An underspent month banks nothing, and two bad months in a
          row bite twice — the second inherits what the first already lost.
        </Typography>
      </ScrollView>

      <View className="gap-3 border-t border-border px-5 pt-3">
        <Button
          label="Save budget"
          isDisabled={!canSave}
          onPress={() => router.back()}
        />
        {isKeypadOpen && (
          <AmountKeypad
            onKeyPress={(key: KeypadKey) => setEntry((current) => appendKey(current, key))}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
