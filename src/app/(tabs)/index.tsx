import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { CalendarClock, Plus, Receipt, Undo2, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { Amount } from '@/components/amount';
import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { InlineError } from '@/components/inline-error';
import { Icon } from '@/components/icon';
import { MonthSwitcher } from '@/components/month-switcher';
import { ProgressRing } from '@/components/progress-ring';
import { SafeAreaView } from '@/components/safe-area-view';
import { ScreenHeader } from '@/components/screen-header';
import { CardUtilisationList } from '@/components/card-utilisation-list';
import { StatCard } from '@/components/stat-card';
import { TransactionRow } from '@/components/transaction-row';
import { useDbQuery, type TableName } from '@/db/live';
import { offBudgetSpend } from '@/db/repositories/expenses';
import { absMinor, asMinor, formatMinor, speakMinor, ZERO_MINOR } from '@/domain/money';
import { currentPeriod, daysRemainingIn, formatPeriodLong } from '@/domain/period';
import {
  dismissCarryOverNotice,
  useBudgetHistory,
  useCarryOverNotice,
} from '@/features/budget/hooks';
import { useCardStandings } from '@/features/accounts/hooks';
import { useExpenseFeed } from '@/features/expenses/hooks';

const RING_MAX_SIZE = 320;
const SCREEN_PADDING = 40;
const RECENT_COUNT = 4;

const OFF_BUDGET_TABLES: readonly TableName[] = ['expenses', 'settlements'];

export default function BalanceScreen() {
  const { width } = useWindowDimensions();
  const ringSize = Math.min(width - SCREEN_PADDING, RING_MAX_SIZE);

  const history = useBudgetHistory();
  const notice = useCarryOverNotice();

  /* Which month is on screen, as an offset from the newest rather than an index,
     so it survives the history growing underneath it. */
  const [monthsBack, setMonthsBack] = useState(0);

  const periods = history.data ?? [];
  const index = Math.max(0, periods.length - 1 - monthsBack);
  const period = periods[index];
  const periodKey = period?.period ?? currentPeriod();

  const offBudget = useDbQuery(`off-budget:${periodKey}`, OFF_BUDGET_TABLES, (database) =>
    offBudgetSpend(periodKey, database),
  );

  const cards = useCardStandings();
  const recent = useExpenseFeed({ period: periodKey }, RECENT_COUNT);
  const recentRows = useMemo(
    () => (recent.data?.groups ?? []).flatMap((group) => group.items).slice(0, RECENT_COUNT),
    [recent.data],
  );

  if (history.error !== null) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <ErrorState error={history.error} onRetry={history.refetch} />
      </SafeAreaView>
    );
  }

  if (period === undefined) return null;

  const progress =
    period.available > 0 ? Math.min(1, Math.max(0, period.remaining) / period.available) : 0;

  const daysLeft = daysRemainingIn(period.period);
  const isCurrent = period.period === currentPeriod();

  /*
   * P1: the design pass showed a total balance, upcoming bills and auto savings.
   * None of them had anything behind them — D4 excludes an income ledger and
   * account balances, and there is no bills or savings table. These two are
   * derived from what the app actually knows, and answer the question the plan
   * says the home screen exists to answer.
   */
  const perDay =
    isCurrent && daysLeft > 0 && period.remaining > 0
      ? asMinor(Math.floor(period.remaining / daysLeft))
      : ZERO_MINOR;

  const changedPeriods = notice.data?.periods ?? [];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-6 px-5 pb-8 pt-2" showsVerticalScrollIndicator={false}>
        <ScreenHeader />

        <MonthSwitcher
          label={formatPeriodLong(period.period)}
          canGoBack={index > 0}
          canGoForward={monthsBack > 0}
          onBack={() => setMonthsBack((current) => current + 1)}
          onForward={() => setMonthsBack((current) => Math.max(0, current - 1))}
          onReturnToCurrent={monthsBack === 0 ? undefined : () => setMonthsBack(0)}
        />

        {/* §4.3 and §10: a past total may change after the fact, and the user is
            told when it does rather than finding out by noticing. */}
        {changedPeriods.length > 0 && (
          <View className="flex-row items-center gap-2 rounded-2xl bg-surface px-4 py-3">
            <Icon icon={Undo2} color="accent" size={14} />
            <Typography type="body-xs" color="muted" className="flex-1">
              {`${changedPeriods.map(formatPeriodLong).join(', ')} changed — a settlement moved what an earlier month cost.`}
            </Typography>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss"
              hitSlop={8}
              onPress={() => {
                dismissCarryOverNotice();
                notice.refetch();
              }}>
              <Icon icon={X} color="muted" size={14} />
            </Pressable>
          </View>
        )}

        <View className="items-center">
          <View
            className="items-center justify-center rounded-full bg-surface"
            style={{ width: ringSize, height: ringSize }}>
            <ProgressRing
              size={ringSize - 16}
              progress={progress}
              accessibilityLabel={
                period.isOverspent
                  ? `Overspent by ${speakMinor(absMinor(period.remaining))} of ${speakMinor(period.available)} available`
                  : `${speakMinor(absMinor(period.remaining))} safe to spend of ${speakMinor(period.available)} available`
              }>
              <View className="items-center gap-1 px-8">
                <Typography type="body" weight="medium">
                  {period.isOverspent ? 'Overspent' : 'Safe to Spend'}
                </Typography>
                <Amount
                  value={absMinor(period.remaining)}
                  className={
                    period.isOverspent ? 'type-metric text-danger' : 'type-metric text-foreground'
                  }
                  showFraction={false}
                />
                <Typography type="body-sm" className="text-accent">
                  {`of ${formatMinor(period.available, { showFraction: false })} available`}
                </Typography>
                {/* §7.1: a carry-over line, but only when there is one. */}
                {period.carryOver > 0 && (
                  <View className="mt-2 rounded-full bg-surface-secondary px-3 py-1.5">
                    <Typography type="body-xs" color="muted">
                      {`${formatMinor(period.carryOver, { showFraction: false })} carried in`}
                    </Typography>
                  </View>
                )}
              </View>
            </ProgressRing>
          </View>
        </View>

        <View className="flex-row gap-3">
          <StatCard
            tone="accent"
            title={isCurrent ? 'Left to spend today' : 'Ended with'}
            caption={
              isCurrent
                ? daysLeft === 1
                  ? 'last day of the month'
                  : `over ${daysLeft} days`
                : period.isOverspent
                  ? 'overspent'
                  : 'left over'
            }
            amount={isCurrent ? perDay : absMinor(period.remaining)}
            icon={CalendarClock}
          />
          {/* A failed read must not render as ₹0 — that is a number the user
              would believe. */}
          <StatCard
            tone="iris"
            title="Off budget"
            caption={offBudget.error === null ? 'tracked, outside the cap' : 'could not be read'}
            amount={offBudget.data ?? ZERO_MINOR}
            isUnavailable={offBudget.error !== null}
            icon={Receipt}
          />
        </View>

        {/* §7.1: cycle spend, utilisation and days to statement per card.
            Utilisation is a billing-cycle figure, not a monthly one, so it does
            not follow the month switcher above. */}
        {cards.error !== null ? (
          <View className="gap-2">
            <Typography type="body-sm" weight="semibold">
              Cards
            </Typography>
            <InlineError message="Your cards couldn't be loaded." onRetry={cards.refetch} />
          </View>
        ) : (
          (cards.data ?? []).length > 0 && (
            <View className="gap-2">
              <Typography type="body-sm" weight="semibold">
                Cards
              </Typography>
              <CardUtilisationList cards={cards.data ?? []} />
            </View>
          )
        )}

        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Typography type="body-sm" weight="semibold">
              Recent
            </Typography>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/transactions')}
              className="active:opacity-60">
              <Typography type="body-xs" className="text-link">
                See all
              </Typography>
            </Pressable>
          </View>

          {recent.error !== null ? (
            <InlineError message="Recent expenses couldn't be loaded." onRetry={recent.refetch} />
          ) : recentRows.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nothing this month"
              description="Add an expense, or bring your history across from a spreadsheet in Settings."
            />
          ) : (
            <View className="rounded-3xl bg-surface p-1">
              {recentRows.map((expense) => (
                <TransactionRow
                  key={expense.id}
                  expense={expense}
                  onPress={() => router.push(`/expense/${expense.id}`)}
                />
              ))}
            </View>
          )}
        </View>

        <Button icon={Plus} label="Add expense" onPress={() => router.push('/expense/new')} />
      </ScrollView>
    </SafeAreaView>
  );
}
