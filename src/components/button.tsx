import { Typography } from 'heroui-native';
import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { Icon } from './icon';

import type { AppColor } from '@/theme';

export type ButtonTone = 'primary' | 'secondary';
export type ButtonSize = 'sm' | 'md';

type Variant = { root: string; label: string; icon: AppColor; iconSize: number };

/**
 * Class strings are spelled out per variant rather than built from a template,
 * so the CSS compiler can see every utility this component can render.
 *
 * Width is left to the caller: in a column the button stretches, in a row it
 * sizes to its content, which is all either placement has ever needed.
 */
const VARIANTS: Record<`${ButtonTone}-${ButtonSize}`, Variant> = {
  'primary-md': {
    root: 'flex-row items-center justify-center gap-2 rounded-2xl border border-accent bg-accent px-4 py-3.5 active:opacity-60',
    label: 'text-accent-foreground',
    icon: 'accent-foreground',
    iconSize: 18,
  },
  'primary-sm': {
    root: 'flex-row items-center justify-center gap-1.5 rounded-full border border-accent bg-accent px-3.5 py-2 active:opacity-60',
    label: 'text-accent-foreground',
    icon: 'accent-foreground',
    iconSize: 15,
  },
  'secondary-md': {
    root: 'flex-row items-center justify-center gap-2 rounded-2xl border border-border bg-default px-4 py-3.5 active:opacity-60',
    label: 'text-foreground',
    icon: 'foreground',
    iconSize: 18,
  },
  'secondary-sm': {
    root: 'flex-row items-center justify-center gap-1.5 rounded-full border border-border bg-default px-3.5 py-2 active:opacity-60',
    label: 'text-foreground',
    icon: 'foreground',
    iconSize: 15,
  },
};

export type ButtonProps = {
  label: string;
  onPress: () => void;
  tone?: ButtonTone;
  size?: ButtonSize;
  icon?: LucideIcon;
  isDisabled?: boolean;
  /** Announced to screen readers when the visible label is abbreviated. */
  accessibilityLabel?: string;
};

export function Button({
  label,
  onPress,
  tone = 'primary',
  size = 'md',
  icon,
  isDisabled = false,
  accessibilityLabel,
}: ButtonProps) {
  const variant = VARIANTS[`${tone}-${size}`];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      /* Dimming is an inline style so the variant table stays one entry per
         tone-and-size instead of doubling for a disabled copy of each. */
      style={isDisabled ? { opacity: 0.4 } : undefined}
      className={variant.root}>
      {icon && <Icon icon={icon} color={variant.icon} size={variant.iconSize} strokeWidth={2.2} />}
      <Typography type="body-sm" weight="semibold" className={variant.label} truncate>
        {label}
      </Typography>
    </Pressable>
  );
}
