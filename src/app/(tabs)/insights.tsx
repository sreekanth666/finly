import { CartesianChart, Line } from 'victory-native';
import { View } from 'react-native';

import { PlaceholderScreen } from '@/components/placeholder-screen';
import { useAppColor } from '@/theme';

/** Placeholder series — replaced when Insights gets designed. */
const WEEKLY_SPEND = [
  { day: 1, amount: 42 },
  { day: 2, amount: 78 },
  { day: 3, amount: 55 },
  { day: 4, amount: 120 },
  { day: 5, amount: 96 },
  { day: 6, amount: 148 },
  { day: 7, amount: 110 },
];

export default function InsightsScreen() {
  const accent = useAppColor('accent');

  return (
    <PlaceholderScreen title="Insights" description="Spending trends land here.">
      <View className="mt-4 h-48 rounded-3xl bg-surface p-4">
        <CartesianChart data={WEEKLY_SPEND} xKey="day" yKeys={['amount']}>
          {({ points }) => (
            <Line points={points.amount} color={accent} strokeWidth={2} curveType="natural" />
          )}
        </CartesianChart>
      </View>
    </PlaceholderScreen>
  );
}
