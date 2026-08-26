import { Typography } from 'heroui-native';
import { CalendarDays, PiggyBank } from 'lucide-react-native';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Amount } from '@/components/amount';
import { ProgressRing } from '@/components/progress-ring';
import { ScreenHeader } from '@/components/screen-header';
import { StatCard } from '@/components/stat-card';
import { balanceOverview } from '@/data/balance';

const RING_MAX_SIZE = 320;
const SCREEN_PADDING = 40;

export default function BalanceScreen() {
  const { width } = useWindowDimensions();
  const { totalBalance, safeToSpend, upcomingBills, autoSavings } = balanceOverview;
  const ringSize = Math.min(width - SCREEN_PADDING, RING_MAX_SIZE);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-7 px-5 pb-8 pt-2" showsVerticalScrollIndicator={false}>
        <ScreenHeader />

        <View className="gap-1">
          <Typography type="body-xs" color="muted">
            Total Balance
          </Typography>
          <Amount
            value={totalBalance}
            className="type-balance text-foreground"
            centsClassName="type-balance"
          />
        </View>

        <View className="items-center">
          <View
            className="items-center justify-center rounded-full bg-surface"
            style={{ width: ringSize, height: ringSize }}>
            <ProgressRing size={ringSize - 16} progress={safeToSpend.progress}>
              <View className="items-center gap-1 px-8">
                <Typography type="body" weight="medium">
                  Safe to Spend
                </Typography>
                <Amount
                  value={safeToSpend.amount}
                  className="type-metric text-foreground"
                  showCents={false}
                />
                <Typography type="body-sm" className="text-accent">
                  {safeToSpend.period}
                </Typography>
                <View className="mt-2 rounded-full bg-surface-secondary px-3 py-1.5">
                  <Typography type="body-xs" color="muted">
                    {safeToSpend.updatedLabel}
                  </Typography>
                </View>
              </View>
            </ProgressRing>
          </View>
        </View>

        <View className="flex-row gap-3">
          <StatCard
            tone="iris"
            title={upcomingBills.title}
            caption={upcomingBills.caption}
            amount={upcomingBills.amount}
            icon={CalendarDays}
          />
          <StatCard
            tone="accent"
            title={autoSavings.title}
            caption={autoSavings.caption}
            amount={autoSavings.amount}
            icon={PiggyBank}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
