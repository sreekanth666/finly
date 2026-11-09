import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { areaPath, monotonePath, type Point } from '@/domain/curve';
import type { Minor } from '@/domain/money';

export type SpendAreaChartProps = {
  /** Running total per day, `null` for days not yet lived. */
  current: readonly (Minor | null)[];
  /** The month before, same shape. Null to leave the line out. */
  previous: readonly (Minor | null)[] | null;
  /** Index of "today" in `current`. */
  dayIndex: number;
  /** Whether to mark `dayIndex` — a month that is over has no "today". */
  showToday: boolean;
  /** Spoken in place of the picture. */
  accessibilityLabel: string;
  /** The month's own colour: its line, the fill beneath it and the ring on "today". */
  color: string;
  /** The ink that reads against the ground, for last month's line and the "today" dot. */
  contrast: string;
};

/** How far up from the bottom edge the curve may rise. */
export const CHART_HEIGHT = 110;

/** Headroom above the tallest mark so a line never touches the top edge. */
const HEADROOM = 1.1;
/** Room for the "today" dot at the top and right, so it is not clipped. */
const MARK_INSET = 8;
/** Keeps a flat line at zero from being half cut off by the baseline. */
const BASELINE_INSET = 2;

/* Everything here sits behind text, on a dark ground, so it is drawn to be
   looked past but still seen: this month is the health colour at a reduced
   strength, the fill fades out under it, and last month is a quieter line in
   the foreground. The "today" dot is a little stronger than the lines so the
   eye still finds where the month stands. */
const LINE_WIDTH = 2;
const LINE_OPACITY = 0.6;
const FILL_OPACITY = 0.2;
const LAST_MONTH_LINE_WIDTH = 1.5;
const LAST_MONTH_OPACITY = 0.18;
const TODAY_OPACITY = 0.7;
const TODAY_RADIUS = 3.5;
const TODAY_RING_WIDTH = 2;
const GRADIENT_ID = 'spend-area-fill';

/** The points that have a value, spread across the plot by day of month. */
const toPoints = (
  series: readonly (Minor | null)[],
  length: number,
  plotWidth: number,
  toY: (value: number) => number,
  lastIndex = series.length - 1,
): Point[] => {
  const points: Point[] = [];
  const span = Math.max(1, length - 1);

  for (let day = 0; day <= Math.min(lastIndex, series.length - 1); day++) {
    const value = series[day];
    if (value === null || value === undefined) continue;
    points.push({ x: (day / span) * plotWidth, y: toY(value) });
  }
  return points;
};

/**
 * This month's running spend as a muted line over a soft area, and last month's
 * as a fainter line behind it, drawn as the background of the figure above them
 * on a dark card. No axes and no
 * budget line: the card carries the figures, and this only has to show the
 * shape of the month and whether it is running ahead of or behind the last one.
 *
 * It lays itself out absolutely along the bottom of whatever positioned parent
 * it is given, takes no space, and measures that box rather than being told its
 * size. It never takes a touch.
 *
 * Both months share one x scale by day of month, so a 30-day month ends a day
 * short of a 31-day one rather than being stretched to meet it.
 */
export function SpendAreaChart({
  current,
  previous,
  dayIndex,
  showToday,
  accessibilityLabel,
  color,
  contrast,
}: SpendAreaChartProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (event: LayoutChangeEvent) => {
    const { width: nextWidth, height: nextHeight } = event.nativeEvent.layout;
    setSize({ width: nextWidth, height: nextHeight });
  };

  const { width, height } = size;

  const length = current.length;
  const plotWidth = Math.max(0, width - MARK_INSET);
  const baselineY = height - BASELINE_INSET;
  const plotHeight = baselineY - MARK_INSET;

  const tallest = Math.max(
    ...current.map((value) => value ?? 0),
    ...(previous ?? []).map((value) => value ?? 0),
  );
  /* An empty month would divide by zero; any positive ceiling draws it flat. */
  const ceiling = tallest > 0 ? tallest * HEADROOM : 1;
  const toY = (value: number) => baselineY - (value / ceiling) * plotHeight;

  const thisMonth = toPoints(current, length, plotWidth, toY, dayIndex);
  const lastMonth = previous === null ? [] : toPoints(previous, length, plotWidth, toY);
  const today = thisMonth[thisMonth.length - 1];

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      pointerEvents="none"
      onLayout={onLayout}
      className="absolute bottom-0 left-0 right-0"
      style={{ height: CHART_HEIGHT }}>
      {width > 0 && height > 0 && (
        <Svg width={width} height={height} importantForAccessibility="no-hide-descendants">
          <Defs>
            <LinearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={FILL_OPACITY} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {lastMonth.length > 1 && (
            <Path
              d={monotonePath(lastMonth)}
              fill="none"
              stroke={contrast}
              strokeWidth={LAST_MONTH_LINE_WIDTH}
              strokeOpacity={LAST_MONTH_OPACITY}
              strokeLinecap="round"
            />
          )}

          {thisMonth.length > 1 && (
            <>
              <Path d={areaPath(thisMonth, height)} fill={`url(#${GRADIENT_ID})`} />
              <Path
                d={monotonePath(thisMonth)}
                fill="none"
                stroke={color}
                strokeWidth={LINE_WIDTH}
                strokeOpacity={LINE_OPACITY}
                strokeLinecap="round"
              />
            </>
          )}

          {showToday && today !== undefined && (
            <Circle
              cx={today.x}
              cy={today.y}
              r={TODAY_RADIUS}
              fill={contrast}
              fillOpacity={TODAY_OPACITY}
              stroke={color}
              strokeOpacity={LINE_OPACITY}
              strokeWidth={TODAY_RING_WIDTH}
            />
          )}
        </Svg>
      )}
    </View>
  );
}
