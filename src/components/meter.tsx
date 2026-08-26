import { View } from 'react-native';

/**
 * Class strings are spelled out per tone so the CSS compiler can see every
 * utility this component can render.
 */
const FILLS = {
  accent: 'bg-accent',
  warning: 'bg-warning',
  danger: 'bg-danger',
} as const;

export type MeterTone = keyof typeof FILLS;

export type MeterProps = {
  /** Share of the track that is filled, 0–1. */
  progress: number;
  tone?: MeterTone;
};

/**
 * A single ratio against a limit. A meter rather than a chart — one number
 * against one ceiling doesn't need axes, and a one-bar bar chart would be
 * more chrome than data.
 */
export function Meter({ progress, tone = 'accent' }: MeterProps) {
  const filled = Math.min(Math.max(progress, 0), 1);

  return (
    <View className="h-2 overflow-hidden rounded-full bg-surface-secondary">
      <View className={`h-full rounded-full ${FILLS[tone]}`} style={{ width: `${filled * 100}%` }} />
    </View>
  );
}
