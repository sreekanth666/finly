import { Typography } from 'heroui-native';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CardUtilisationList } from '@/components/card-utilisation-list';
import { CategoryBreakdown } from '@/components/category-breakdown';
import { ScreenHeader } from '@/components/screen-header';
import { SectionHeader } from '@/components/section-header';
import { SpendTrend } from '@/components/spend-trend';
import { TopItemsList } from '@/components/top-items-list';
import { insightsOverview } from '@/data/insights';

/** Screen padding (px-5 both sides) plus the card's own p-4 both sides. */
const CONTENT_INSET = 72;
const DONUT_MAX_SIZE = 220;

export default function InsightsScreen() {
  const { width } = useWindowDimensions();
  const { period, totalSpent, monthlyBudget, byCategory, trend, cards, topItems } =
    insightsOverview;

  const plotWidth = width - CONTENT_INSET;
  const donutSize = Math.min(plotWidth, DONUT_MAX_SIZE);

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
            {period}
          </Typography>
        </View>

        <View className="gap-3">
          <SectionHeader
            label="Spend by category"
            trailing={
              <Typography type="body-sm" color="muted">
                {`${byCategory.length} groups`}
              </Typography>
            }
          />
          <CategoryBreakdown segments={byCategory} total={totalSpent} size={donutSize} />
        </View>

        <View className="gap-3">
          <SectionHeader label="Monthly trend" />
          <SpendTrend data={trend.map(({ id, label, spent }) => ({ id, label, value: spent }))} budget={monthlyBudget} width={plotWidth} />
        </View>

        <View className="gap-3">
          <SectionHeader
            label="Card utilisation"
            trailing={
              <Typography type="body-sm" color="muted">
                This cycle
              </Typography>
            }
          />
          <CardUtilisationList cards={cards} />
        </View>

        <View className="gap-3">
          <SectionHeader label="Top items" />
          <TopItemsList items={topItems} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
