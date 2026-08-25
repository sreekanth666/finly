import type { LucideIcon } from 'lucide-react-native';
import { Pressable, type PressableProps } from 'react-native';

import { Icon } from './icon';

import type { AppColor } from '@/theme';

export type IconButtonProps = PressableProps & {
  icon: LucideIcon;
  /** Announced to screen readers — icon-only controls need it. */
  label: string;
  color?: AppColor;
  size?: number;
};

/** Round, borderless control used for the header actions. */
export function IconButton({
  icon,
  label,
  color = 'foreground',
  size = 22,
  ...props
}: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      className="size-10 items-center justify-center rounded-full active:opacity-60"
      {...props}>
      <Icon icon={icon} color={color} size={size} />
    </Pressable>
  );
}
