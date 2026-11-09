import { Typography } from 'heroui-native';
import { Receipt, Undo2, X } from '@/components/icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { useFloatingBarClearance } from '@/components/floating-bar';
import { HomeHeader } from '@/components/home-header';
import { InlineError } from '@/components/inline-error';
import { Icon } from '@/components/icon';
import { SafeAreaView } from '@/components/safe-area-view';
import { ReviewBanner } from '@/components/review-banner';
import { CardUtilisationList } from '@/components/card-utilisation-list';
import { SpendOverviewCard } from '@/components/spend-overview-card';
import { TransactionRow } from '@/components/transaction-row';
import {
  currentPeriod,
  daysRemainingIn,
  formatPeriodLong,
  parsePeriod,
  type PeriodKey,
} from '@/domain/period';
import type { BudgetScope } from '@/domain/spend';
import {
  dismissCarryOverNotice,
  useBudgetHistory,
  useCarryOverNotice,
  useOffBudgetSpend,
  useSpendCurve,
} from '@/features/budget/hooks';
import { useCardStandings } from '@/features/accounts/hooks';
import { useExpenseFeed } from '@/features/expenses/hooks';
import { useNavigateOnce } from '@/features/navigation/hooks';

const RECENT_COUNT = 3;

/** Spelled out per position so the compiler sees both. */
const RECENT_ROWS = {
  first: '',
  rest: 'border-t border-border',
} as const;

export default function BalanceScreen() {
  /* One push per press: the row stays tappable for the whole transition. */
  const navigate = useNavigateOnce();
  const clearance = useFloatingBarClearance();

  const history = useBudgetHistory();
  const notice = useCarryOverNotice();

  /* Which month is on screen, as an offset from the newest rather than an index,
     so it survives the history growing underneath it. */
  const [monthsBack, setMonthsBack] = useState(0);

  const periods = history.data ?? [];
  const index = Math.max(0, periods.length - 1 - monthsBack);
  const period = periods[index];
  const periodKey = period?.period ?? currentPeriod();

  const offBudget = useOffBudgetSpend(periodKey);
  const curve = useSpendCurve(periodKey);

  const cards = useCardStandings();
  const recent = useExpenseFeed({ period: periodKey }, RECENT_COUNT);
  const recentRows = useMemo(
    () => (recent.data?.groups ?? []).flatMap((group) => group.items).slice(0, RECENT_COUNT),
    [recent.data],
  );

  if (history.error !== null) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']} style={{ paddingBottom: clearance }}>
        <ErrorState error={history.error} onRetry={history.refetch} />
      </SafeAreaView>
    );
  }

  if (period === undefined) return null;

  const daysLeft = daysRemainingIn(period.period);
  const isCurrent = period.period === currentPeriod();
  const { year } = parsePeriod(period.period);

  const changedPeriods = notice.data?.periods ?? [];

  const selectPeriod = (key: PeriodKey) => {
    const position = periods.findIndex((candidate) => candidate.period === key);
    if (position >= 0) setMonthsBack(periods.length - 1 - position);
  };

  /* The feed opens on the same month and the same side as the figure that was
     tapped, so the list adds up to the number that led there. The tab is already
     mounted, so `at` is what tells it this is a new request rather than the
     params it has already applied. */
  const openFeed = (scope: BudgetScope) =>
    navigate({
      pathname: '/transactions',
      params: { scope, period: periodKey, at: String(Date.now()) },
    });

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-5 px-4 pt-2"
        contentContainerStyle={{ paddingBottom: clearance }}
        showsVerticalScrollIndicator={false}>
        <HomeHeader
          period={period.period}
          periods={periods}
          isThisYear={year === parsePeriod(currentPeriod()).year}
          onSelectPeriod={selectPeriod}
        />

        <ReviewBanner />

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

        <SpendOverviewCard
          period={period}
          offBudgetMinor={offBudget.error === null ? (offBudget.data ?? null) : null}
          curve={curve.error === null ? curve.data : null}
          isCurrent={isCurrent}
          daysLeft={daysLeft}
          onPressScope={openFeed}
        />

        <View className="gap-2">
          <View className="flex-row items-center justify-between">
            <Typography type="body-sm" weight="semibold">
              Recent transactions
            </Typography>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigate('/transactions')}
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
            <View className="overflow-hidden rounded-2xl bg-surface">
              {recentRows.map((expense, position) => (
                <View key={expense.id} className={position === 0 ? RECENT_ROWS.first : RECENT_ROWS.rest}>
                  <TransactionRow expense={expense} onPress={() => navigate(`/expense/${expense.id}`)} />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* §7.1: cycle spend, utilisation and days to statement per card.
            Utilisation is a billing-cycle figure, not a monthly one, so it does
            not follow the month on screen above. */}
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
              <CardUtilisationList
                cards={cards.data ?? []}
                onPressCard={(id) => navigate(`/card/${id}`)}
              />
            </View>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
