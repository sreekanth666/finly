import { Typography } from 'heroui-native';
import { View } from 'react-native';

/** Spelled out per state so the compiler sees both fills. */
const SEGMENT = {
  done: 'h-1 flex-1 rounded-full bg-accent',
  todo: 'h-1 flex-1 rounded-full bg-surface-secondary',
} as const;

export type StepIndicatorProps = {
  steps: string[];
  /** Zero-based. */
  current: number;
};

/**
 * A segment per step rather than four labels — on a phone, only the step you
 * are on has room for a name, and the bar carries how far along you are.
 */
export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <View className="gap-2">
      <View className="flex-row gap-1.5">
        {steps.map((step, index) => (
          <View key={step} className={index <= current ? SEGMENT.done : SEGMENT.todo} />
        ))}
      </View>
      <Typography type="body-xs" color="muted">
        {`Step ${current + 1} of ${steps.length} · ${steps[current]}`}
      </Typography>
    </View>
  );
}
