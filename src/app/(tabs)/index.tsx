import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { CalendarDays, PiggyBank, Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Amount } from '@/components/amount';
import { Button } from '@/components/button';
import { MonthSwitcher } from '@/components/month-switcher';
import { ProgressRing } from '@/components/progress-ring';
import { ScreenHeader } from '@/components/screen-header';
import { StatCard } from '@/components/stat-card';
import { balanceOverview } from '@/data/balance';
import { budgetPeriods } from '@/data/budget';
import { buildCarryOverHistory } from '@/domain/budget';

const RING_MAX_SIZE = 320;
const SCREEN_PADDING = 40;

export default function BalanceScreen() {
  const { width } = useWindowDimensions();
  const { totalBalance, upcomingBills, autoSavings } = balanceOverview;
  const ringSize = Math.min(width - SCREEN_PADDING, RING_MAX_SIZE);

  /* §7.1: the ring is remaining(P) against available(P), not a fixed figure. */
  const history = useMemo(() => buildCarryOverHistory(budgetPeriods), []);
  const latest = history.length - 1;
  const [index, setIndex] = useState(latest);
  const period = history[index]!;

  const progress =
    period.available > 0 ? Math.min(1, Math.max(0, period.remaining) / period.available) : 0;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView contentContainerClassName="gap-7 px-5 pb-8 pt-2" showsVerticalScrollIndicator={false}>
        <ScreenHeader />

        <MonthSwitcher
          label={period.label}
          canGoBack={index > 0}
          canGoForward={index < latest}
          onBack={() => setIndex((current) => current - 1)}
          onForward={() => setIndex((current) => current + 1)}
          onReturnToCurrent={index === latest ? undefined : () => setIndex(latest)}
        />

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
            <ProgressRing size={ringSize - 16} progress={progress}>
              <View className="items-center gap-1 px-8">
                <Typography type="body" weight="medium">
                  {period.isOverspent ? 'Overspent' : 'Safe to Spend'}
                </Typography>
                <Amount
                  value={Math.abs(period.remaining)}
                  className={
                    period.isOverspent
                      ? 'type-metric text-danger'
                      : 'type-metric text-foreground'
                  }
                  showCents={false}
                />
                <Typography type="body-sm" className="text-accent">
                  {`of $${period.available.toLocaleString('en-US')} available`}
                </Typography>
                {/* §7.1: a carry-over line, but only when there is one. */}
                {period.carryOver > 0 && (
                  <View className="mt-2 rounded-full bg-surface-secondary px-3 py-1.5">
                    <Typography type="body-xs" color="muted">
                      {`$${period.carryOver.toFixed(2)} carried from last month`}
                    </Typography>
                  </View>
                )}
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

        <Button icon={Plus} label="Add expense" onPress={() => router.push('/expense/new')} />
      </ScrollView>
    </SafeAreaView>
  );
}
