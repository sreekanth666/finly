import { Typography } from 'heroui-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from './icon';

/** Spelled out per state so the compiler sees both. */
const ARROW = {
  enabled: 'size-9 items-center justify-center rounded-full active:bg-surface-secondary',
  disabled: 'size-9 items-center justify-center rounded-full opacity-30',
} as const;

export type MonthSwitcherProps = {
  label: string;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
  /** Shown only when the view has moved off the latest month. */
  onReturnToCurrent?: () => void;
};

/**
 * Inline month control for the Balance header — a header, not a screen, so
 * moving a month costs one tap and never loses your place.
 *
 * Forward stops at the newest month rather than wrapping: there is no spending
 * recorded in the future, and an empty screen would look like a bug.
 */
export function MonthSwitcher({
  label,
  canGoBack,
  canGoForward,
  onBack,
  onForward,
  onReturnToCurrent,
}: MonthSwitcherProps) {
  return (
    <View className="flex-row items-center justify-center gap-1">
      <Pressable
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        accessibilityState={{ disabled: !canGoBack }}
        disabled={!canGoBack}
        onPress={onBack}
        className={canGoBack ? ARROW.enabled : ARROW.disabled}>
        <Icon icon={ChevronLeft} color="foreground" size={18} />
      </Pressable>

      <Pressable
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={onReturnToCurrent ? `${label}. Return to this month` : label}
        disabled={!onReturnToCurrent}
        onPress={onReturnToCurrent}
        className="min-w-36 items-center gap-0.5 px-2 active:opacity-60">
        <Typography type="body-sm" weight="semibold">
          {label}
        </Typography>
        {onReturnToCurrent && (
          <Typography type="body-xs" className="text-link">
            Back to this month
          </Typography>
        )}
      </Pressable>

      <Pressable
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Next month"
        accessibilityState={{ disabled: !canGoForward }}
        disabled={!canGoForward}
        onPress={onForward}
        className={canGoForward ? ARROW.enabled : ARROW.disabled}>
        <Icon icon={ChevronRight} color="foreground" size={18} />
      </Pressable>
    </View>
  );
}
