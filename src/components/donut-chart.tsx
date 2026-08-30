import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { useChartPalette, type ChartTone } from '@/theme/chart';

export type DonutSegment = {
  id: string;
  value: number;
  tone: ChartTone;
};

export type DonutChartProps = {
  /** Passed through so a caller can hide a chart its ranked list already says. */
  accessibilityElementsHidden?: boolean;
  importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
  size: number;
  segments: DonutSegment[];
  strokeWidth?: number;
  /** Centre content — the total the ring adds up to. */
  children?: ReactNode;
};

/** Surface left between adjacent fills, so two segments never bleed together. */
const SEGMENT_GAP = 3;

/**
 * Part-to-whole at a glance. Deliberately capped at the palette's five slots:
 * a donut stops being readable past six segments, and the ranked list beside it
 * is what answers "which is bigger" — the ring only answers "how is it split".
 *
 * Segments are drawn as dashes on one circle rather than as arc paths, so the
 * gap between them is a property of the dash pattern and can't drift.
 */
/*
 * The chart carries no text of its own, and the ranked list rendered beside it
 * by CategoryBreakdown says the same thing in words. Rather than read out a
 * meaningless stack of SVG paths, it is hidden from assistive technology and the
 * list is left to answer for both.
 */
export function DonutChart({
  accessibilityElementsHidden,
  importantForAccessibility, size, segments, strokeWidth = 20, children }: DonutChartProps) {
  const palette = useChartPalette();
  const center = size / 2;
  const radius = center - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  let cursor = 0;
  const arcs = segments.map((segment) => {
    const length = total > 0 ? (segment.value / total) * circumference : 0;
    const drawn = Math.max(length - SEGMENT_GAP, 0);
    const arc = {
      id: segment.id,
      color: palette[segment.tone],
      dash: `${drawn} ${circumference - drawn}`,
      /* Half a gap of lead-in keeps the gap centred on the boundary. */
      offset: -(cursor + SEGMENT_GAP / 2),
    };

    cursor += length;

    return arc;
  });

  return (
    <View
      className="items-center justify-center"
      style={{ width: size, height: size }}
      accessibilityElementsHidden={accessibilityElementsHidden}
      importantForAccessibility={importantForAccessibility}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        {/* Start at twelve o'clock rather than three. */}
        <G transform={`rotate(-90 ${center} ${center})`}>
          {arcs.map((arc) => (
            <Circle
              key={arc.id}
              cx={center}
              cy={center}
              r={radius}
              stroke={arc.color}
              strokeWidth={strokeWidth}
              strokeDasharray={arc.dash}
              strokeDashoffset={arc.offset}
              fill="none"
            />
          ))}
        </G>
      </Svg>
      {children}
    </View>
  );
}
