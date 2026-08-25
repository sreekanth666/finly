import type { ReactNode } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { useAppColor, type AppColor } from '@/theme';

export type ProgressRingProps = {
  /** Outer diameter in points. */
  size: number;
  /** Completed share of the ring, 0–1. */
  progress: number;
  strokeWidth?: number;
  /** Where the arc begins, in degrees clockwise from 12 o'clock. */
  startAngle?: number;
  /** The mockup sweeps anti-clockwise from just left of top. */
  direction?: 'clockwise' | 'anticlockwise';
  trackColor?: AppColor;
  progressColor?: AppColor;
  children?: ReactNode;
};

const polarToCartesian = (center: number, radius: number, angleDegrees: number) => {
  const angle = ((angleDegrees - 90) * Math.PI) / 180;

  return { x: center + radius * Math.cos(angle), y: center + radius * Math.sin(angle) };
};

const describeArc = (center: number, radius: number, fromAngle: number, toAngle: number) => {
  const start = polarToCartesian(center, radius, fromAngle);
  const end = polarToCartesian(center, radius, toAngle);
  const delta = toAngle - fromAngle;

  return [
    `M ${start.x} ${start.y}`,
    `A ${radius} ${radius} 0 ${Math.abs(delta) > 180 ? 1 : 0} ${delta >= 0 ? 1 : 0} ${end.x} ${end.y}`,
  ].join(' ');
};

/**
 * The Safe-to-Spend ring: a track, a rounded progress arc, and a dot marking
 * where the arc begins. Center content is slotted through `children`.
 */
export function ProgressRing({
  size,
  progress,
  strokeWidth = 3,
  startAngle = -6,
  direction = 'anticlockwise',
  trackColor = 'border',
  progressColor = 'foreground',
  children,
}: ProgressRingProps) {
  const [track, arc] = useAppColor([trackColor, progressColor]);
  const center = size / 2;
  const radius = center - strokeWidth * 2;
  const sweep = Math.min(Math.max(progress, 0), 1) * 359.99;
  const endAngle = direction === 'clockwise' ? startAngle + sweep : startAngle - sweep;
  const start = polarToCartesian(center, radius, startAngle);

  return (
    <View className="items-center justify-center" style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={center} cy={center} r={radius} stroke={track} strokeWidth={strokeWidth} fill="none" />
        <Path
          d={describeArc(center, radius, startAngle, endAngle)}
          stroke={arc}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          fill="none"
        />
        <Circle cx={start.x} cy={start.y} r={strokeWidth * 1.4} fill={arc} />
      </Svg>
      {children}
    </View>
  );
}
