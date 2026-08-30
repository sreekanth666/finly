import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from './icon';

/** Spelled out per state rather than templated, so the compiler sees both. */
const BUTTON = {
  enabled: 'size-8 items-center justify-center rounded-lg active:bg-surface-secondary',
  disabled: 'size-8 items-center justify-center rounded-lg opacity-30',
} as const;

export type ReorderButtonsProps = {
  label: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
};

/**
 * Move up / move down, in place of a drag handle. Two buttons hold their
 * position for a screen reader and need no gesture state, which a list this
 * short does not miss.
 */
export function ReorderButtons({
  label,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
}: ReorderButtonsProps) {
  return (
    <View className="flex-row items-center">
      <Pressable
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Move ${label} up`}
        accessibilityState={{ disabled: !canMoveUp }}
        disabled={!canMoveUp}
        onPress={onMoveUp}
        className={canMoveUp ? BUTTON.enabled : BUTTON.disabled}>
        <Icon icon={ChevronUp} color="muted" size={16} />
      </Pressable>

      <Pressable
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={`Move ${label} down`}
        accessibilityState={{ disabled: !canMoveDown }}
        disabled={!canMoveDown}
        onPress={onMoveDown}
        className={canMoveDown ? BUTTON.enabled : BUTTON.disabled}>
        <Icon icon={ChevronDown} color="muted" size={16} />
      </Pressable>
    </View>
  );
}
