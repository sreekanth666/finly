import { Typography } from 'heroui-native';
import { View } from 'react-native';

import { Amount } from './amount';
import { DonutChart } from './donut-chart';

import type { CategorySpend } from '@/data/insights';
import { useChartPalette } from '@/theme/chart';

export type CategoryBreakdownProps = {
  segments: CategorySpend[];
  total: number;
  size: number;
};

/**
 * The ring answers "how is the month split"; the list under it answers "by how
 * much". The list is also the legend — every segment is named in text, so the
 * reader never has to tell two hues apart to know what they are looking at.
 */
export function CategoryBreakdown({ segments, total, size }: CategoryBreakdownProps) {
  const palette = useChartPalette();

  return (
    <View className="gap-6 rounded-3xl bg-surface p-4">
      <View className="items-center">
        <DonutChart
          size={size}
          segments={segments.map(({ id, amount, tone }) => ({ id, value: amount, tone }))}>
          <View className="items-center gap-0.5">
            <Typography type="body-xs" color="muted">
              Total spent
            </Typography>
            <Amount value={total} className="type-amount text-foreground" showCents={false} />
          </View>
        </DonutChart>
      </View>

      <View className="gap-3">
        {segments.map((segment) => (
          <View key={segment.id} className="flex-row items-center gap-3">
            <View
              className="size-2.5 rounded-full"
              style={{ backgroundColor: palette[segment.tone] }}
            />
            <Typography type="body-sm" className="flex-1" truncate>
              {segment.label}
            </Typography>
            <Typography type="body-xs" color="muted">
              {total > 0 ? Math.round((segment.amount / total) * 100) : 0}%
            </Typography>
            <Amount
              value={segment.amount}
              className="type-amount-sm text-foreground"
              centsClassName="type-amount-sm"
            />
          </View>
        ))}
      </View>
    </View>
  );
}
