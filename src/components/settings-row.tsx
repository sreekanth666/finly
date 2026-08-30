import { Typography } from 'heroui-native';
import { ChevronRight, type LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from './icon';

import type { AppColor } from '@/theme';

/**
 * Class strings spelled out per position — `divide-y` compiles to a
 * child-combinator selector, which renders no separator at all on native.
 */
const ROW = {
  first: 'flex-row items-center gap-3 px-4 py-3.5 active:opacity-60',
  rest: 'flex-row items-center gap-3 border-t border-border px-4 py-3.5 active:opacity-60',
} as const;

export type SettingsRowProps = {
  label: string;
  isFirst: boolean;
  icon?: LucideIcon;
  iconTone?: AppColor;
  /** Right-hand detail: the current value, a count, a version. */
  value?: string;
  /** Replaces the value and chevron entirely — a switch, a pair of buttons. */
  trailing?: ReactNode;
  description?: string;
  onPress?: () => void;
  /** Used only by the hidden dev-seed action on the About row. */
  onLongPress?: () => void;
};

/** One line of a settings list: icon · label · value · chevron. */
export function SettingsRow({
  label,
  isFirst,
  icon,
  iconTone = 'foreground',
  value,
  trailing,
  description,
  onPress,
  onLongPress,
}: SettingsRowProps) {
  return (
    <Pressable
      accessibilityRole={onPress ?? onLongPress ? 'button' : undefined}
      disabled={!onPress && !onLongPress}
      onPress={onPress}
      onLongPress={onLongPress}
      className={isFirst ? ROW.first : ROW.rest}>
      {icon && (
        <View className="size-9 items-center justify-center rounded-xl bg-surface-secondary">
          <Icon icon={icon} color={iconTone} size={16} />
        </View>
      )}

      <View className="flex-1 gap-0.5">
        <Typography type="body-sm" weight="medium" truncate>
          {label}
        </Typography>
        {description && (
          <Typography type="body-xs" color="muted" truncate>
            {description}
          </Typography>
        )}
      </View>

      {trailing ?? (
        <View className="flex-row items-center gap-1.5">
          {value && (
            <Typography type="body-sm" color="muted" truncate>
              {value}
            </Typography>
          )}
          {onPress && <Icon icon={ChevronRight} color="muted" size={16} />}
        </View>
      )}
    </Pressable>
  );
}
