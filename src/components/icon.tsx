import type { LucideIcon } from 'lucide-react-native';

import { useAppColor, type AppColor } from '@/theme';

export type IconProps = {
  icon: LucideIcon;
  /** Theme token to paint the icon with. Never pass a raw color. */
  color?: AppColor;
  size?: number;
  strokeWidth?: number;
};

/**
 * Thin wrapper that paints a Lucide icon from a design token, so screens never
 * have to resolve a color themselves.
 */
export function Icon({ icon: LucideGlyph, color = 'foreground', size = 22, strokeWidth = 1.8 }: IconProps) {
  const value = useAppColor(color);

  return <LucideGlyph color={value} size={size} strokeWidth={strokeWidth} />;
}
