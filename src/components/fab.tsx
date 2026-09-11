import type { LucideIcon } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { Icon } from './icon';

export type FabProps = {
  icon: LucideIcon;
  /** Announced to screen readers — the button has no visible text. */
  label: string;
  onPress: () => void;
};

/**
 * The one floating action a screen gets. Positioning belongs to the caller:
 * it is absolute against whatever the screen wraps its scroll view in, and
 * only the screen knows what it has to clear.
 */
export function Fab({ icon, label, onPress }: FabProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="absolute bottom-5 right-5 size-14 items-center justify-center rounded-full bg-accent active:opacity-80">
      <Icon icon={icon} color="accent-foreground" size={24} strokeWidth={2.2} />
    </Pressable>
  );
}
