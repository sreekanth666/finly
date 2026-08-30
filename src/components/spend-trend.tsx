import { Typography } from 'heroui-native';
import { View } from 'react-native';

import { Amount } from './amount';
import { TrendBars, type TrendBar } from './trend-bars';
import type { Minor } from '@/domain/money';

export type SpendTrendProps = {
  data: TrendBar[];
  budget: Minor;
  width: number;
};

/**
 * Two states share the chart, so both are named in a legend rather than left to
 * colour alone, and the budget line is labelled with the figure it represents.
 */
export function SpendTrend({ data, budget, width }: SpendTrendProps) {
  return (
    <View className="gap-4 rounded-3xl bg-surface p-4">
      <TrendBars data={data} reference={budget} width={width} />

      <View className="flex-row flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3">
        <View className="flex-row items-center gap-1.5">
          <View className="h-2 w-3 rounded-full bg-accent" />
          <Typography type="body-xs" color="muted">
            Within budget
          </Typography>
        </View>

        <View className="flex-row items-center gap-1.5">
          <View className="h-2 w-3 rounded-full bg-danger" />
          <Typography type="body-xs" color="muted">
            Over budget
          </Typography>
        </View>

        <View className="flex-1 flex-row items-center justify-end gap-1.5">
          <View className="h-px w-4 bg-border" />
          <Typography type="body-xs" color="muted">
            Budget
          </Typography>
          <Amount value={budget} className="type-amount-sm text-muted" showFraction={false} />
        </View>
      </View>
    </View>
  );
}
