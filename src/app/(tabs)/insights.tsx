import { Typography } from 'heroui-native';
import { ChartPie } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardUtilisationList } from '@/components/card-utilisation-list';
import { CategoryBreakdown } from '@/components/category-breakdown';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { MonthSwitcher } from '@/components/month-switcher';
import { ScreenHeader } from '@/components/screen-header';
import { SectionHeader } from '@/components/section-header';
import { SpendTrend } from '@/components/spend-trend';
import { TopItemsList } from '@/components/top-items-list';
import { addPeriods, comparePeriods, currentPeriod, formatPeriodLong } from '@/domain/period';
import { useCardStandings } from '@/features/accounts/hooks';
import { useInsights } from '@/features/insights/hooks';

/** Screen padding (px-5 both sides) plus the card's own p-4 both sides. */
const CONTENT_INSET = 72;
const DONUT_MAX_SIZE = 220;

export default function InsightsScreen() {
  const { width } = useWindowDimensions();

  /*
   * §7.6 asks for Insights per month, and the design pass had no way to change
   * it — this was the only screen in the app with no interaction at all. Held as
   * an offset from the current month rather than an absolute key, so it stays
   * meaningful when the month rolls over while the app is open.
   */
  const [monthsBack, setMonthsBack] = useState(0);
  const period = addPeriods(currentPeriod(), -monthsBack);

  const insights = useInsights(period);
  const cardStandings = useCardStandings();

  const plotWidth = width - CONTENT_INSET;
  const donutSize = Math.min(plotWidth, DONUT_MAX_SIZE);

  const view = insights.data;
  const earliest = view?.earliestPeriod ?? null;
  const canGoBack = earliest !== null && comparePeriods(addPeriods(period, -1), earliest) >= 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView
        contentContainerClassName="gap-7 px-5 pb-8 pt-2"
        showsVerticalScrollIndicator={false}>
        <ScreenHeader />

        <View className="gap-1">
          <Typography.Heading type="h2" weight="bold">
            Insights
          </Typography.Heading>
          <Typography type="body-sm" color="muted">
            {formatPeriodLong(period)}
          </Typography>
        </View>

        <MonthSwitcher
          label={formatPeriodLong(period)}
          canGoBack={canGoBack}
          canGoForward={monthsBack > 0}
          onBack={() => setMonthsBack((current) => current + 1)}
          onForward={() => setMonthsBack((current) => Math.max(0, current - 1))}
          onReturnToCurrent={monthsBack === 0 ? undefined : () => setMonthsBack(0)}
        />

        {insights.error !== null ? (
          <ErrorState error={insights.error} onRetry={insights.refetch} />
        ) : view === undefined ? null : view.byCategory.length === 0 ? (
          <EmptyState
            icon={ChartPie}
            title="Nothing recorded this month"
            description={`There are no expenses in ${formatPeriodLong(period)} to break down yet.`}
          />
        ) : (
          <>
            <View className="gap-3">
              <SectionHeader
                label="Spend by category"
                trailing={
                  <Typography type="body-sm" color="muted">
                    {view.byCategory.length === 1 ? '1 group' : `${view.byCategory.length} groups`}
                  </Typography>
                }
              />
              <CategoryBreakdown
                segments={view.byCategory}
                total={view.totalSpentMinor}
                size={donutSize}
              />
            </View>

            <View className="gap-3">
              <SectionHeader label="Monthly trend" />
              <SpendTrend
                data={view.trend.map(({ period: key, label, spentMinor }) => ({
                  id: key,
                  label,
                  value: spentMinor,
                }))}
                budget={view.budgetMinor}
                width={plotWidth}
              />
            </View>

            <View className="gap-3">
              <SectionHeader label="Top items" />
              <TopItemsList items={view.topItems} />
            </View>
          </>
        )}

        {/* Utilisation is a billing-cycle figure, not a monthly one, so it sits
            outside the month switcher and is shown even for an empty month. */}
        {(cardStandings.data ?? []).length > 0 && (
          <View className="gap-3">
            <SectionHeader
              label="Card utilisation"
              trailing={
                <Typography type="body-sm" color="muted">
                  This cycle
                </Typography>
              }
            />
            <CardUtilisationList cards={cardStandings.data ?? []} />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
