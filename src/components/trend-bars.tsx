import { Typography } from 'heroui-native';
import { View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

import { useAppColor } from '@/theme';
import type { Minor } from '@/domain/money';

export type TrendBar = {
  id: string;
  label: string;
  value: Minor;
};

export type TrendBarsProps = {
  data: TrendBar[];
  /** The budget each month is judged against. */
  reference: Minor;
  width: number;
  height?: number;
};

/** Surface between adjacent bars, so two months never read as one block. */
const BAR_GAP = 6;
const CORNER = 4;
/** Headroom above the tallest mark so a bar never touches the top edge. */
const HEADROOM = 1.15;

/** Rounded at the data end, square on the baseline it is anchored to. */
const barPath = (x: number, y: number, width: number, height: number) => {
  const radius = Math.min(CORNER, width / 2, height);

  return [
    `M ${x} ${y + height}`,
    `L ${x} ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `L ${x + width - radius} ${y}`,
    `Q ${x + width} ${y} ${x + width} ${y + radius}`,
    `L ${x + width} ${y + height}`,
    'Z',
  ].join(' ');
};

/**
 * Spend per month against the budget line. One axis and one series — the bars
 * carry the amount, and the only other thing on the chart is the reference the
 * reader is judging them against.
 *
 * A month over budget is a status, not a second series, so it is painted in the
 * status colour and named in the legend rather than left to colour alone.
 */
export function TrendBars({ data, reference, width, height = 140 }: TrendBarsProps) {
  const [accent, danger, border] = useAppColor(['accent', 'danger', 'border']);

  const ceiling = Math.max(...data.map((bar) => bar.value), reference) * HEADROOM;
  const barWidth = (width - BAR_GAP * (data.length - 1)) / data.length;
  const toY = (value: number) => height - (value / ceiling) * height;
  const referenceY = toY(reference);

  return (
    <View className="gap-2">
      <Svg width={width} height={height}>
        {data.map((bar, index) => {
          const y = toY(bar.value);

          return (
            <Path
              key={bar.id}
              d={barPath(index * (barWidth + BAR_GAP), y, barWidth, height - y)}
              fill={bar.value > reference ? danger : accent}
            />
          );
        })}

        {/* Recessive: the reference is context, not data. */}
        <Line
          x1={0}
          y1={referenceY}
          x2={width}
          y2={referenceY}
          stroke={border}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      </Svg>

      <View className="flex-row" style={{ width }}>
        {data.map((bar, index) => (
          <View
            key={bar.id}
            style={{ width: barWidth, marginLeft: index === 0 ? 0 : BAR_GAP }}
            className="items-center">
            <Typography type="body-xs" color="muted">
              {bar.label}
            </Typography>
          </View>
        ))}
      </View>
    </View>
  );
}
