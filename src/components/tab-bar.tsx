import type { LucideIcon } from '@/components/icons';
import { forwardRef, type ReactNode } from 'react';
import { Pressable, View, type ViewProps } from 'react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FLOATING_BAR_GAP, FLOATING_BAR_HEIGHT } from './floating-bar';
import { Icon } from './icon';

import type { TabTriggerSlotProps } from 'expo-router/ui';

/**
 * The floating pill. Rendered through `<TabList asChild>`, so the triggers
 * stay direct children of the list — expo-router discovers them by walking the
 * element tree, and a wrapper component would hide them. Anything that is not
 * a `TabTrigger` (the add and Settings buttons) is ignored by that walk, which
 * is what lets them sit between the tabs.
 *
 * Hidden while the keyboard is up. On Android an absolute bar would otherwise
 * ride up with the keyboard and sit on top of the Transactions search field.
 * It is hidden with `display: 'none'` rather than unmounted, so the tab state
 * and the triggers survive the keyboard coming and going.
 */
export const FloatingTabBar = forwardRef<View, ViewProps & { children: ReactNode }>(
  ({ style, ...props }, ref) => {
    const insets = useSafeAreaInsets();
    const isKeyboardVisible = useKeyboardState((state) => state.isVisible);

    return (
      <View
        ref={ref}
        className="absolute left-6 right-6 flex-row items-center justify-between rounded-full border border-border bg-surface px-2"
        style={[
          style,
          {
            height: FLOATING_BAR_HEIGHT,
            bottom: insets.bottom + FLOATING_BAR_GAP,
            display: isKeyboardVisible ? 'none' : 'flex',
          },
        ]}
        {...props}
      />
    );
  },
);

FloatingTabBar.displayName = 'FloatingTabBar';

export type TabIconProps = TabTriggerSlotProps & {
  icon: LucideIcon;
  label: string;
};

/**
 * A tab: an icon in a 48pt hit target, filled when focused. Icon-only, so the
 * label is the accessibility label and nothing else.
 */
export const TabIcon = forwardRef<View, TabIconProps>(
  ({ icon, label, isFocused, style, ...props }, ref) => (
    <Pressable
      ref={ref}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: isFocused }}
      className={`size-12 items-center justify-center rounded-full ${isFocused ? 'bg-foreground' : ''}`}
      /**
       * TabTrigger injects `flexDirection: 'row'` and `justifyContent:
       * 'space-between'`, which lands after the className styles and pushes the
       * icon off-centre. Override it last so the icon stays in the middle.
       */
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        { flexDirection: 'column', justifyContent: 'center' },
      ]}
      {...props}>
      <Icon icon={icon} color={isFocused ? 'background' : 'muted'} size={22} />
    </Pressable>
  ),
);

TabIcon.displayName = 'TabIcon';

export type BarButtonProps = {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
};

/** The centre add button: the one filled-accent control in the bar. */
export function AddButton({ icon, label, onPress }: BarButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="size-12 items-center justify-center rounded-full bg-accent active:opacity-80">
      <Icon icon={icon} color="accent-foreground" size={24} strokeWidth={2.2} />
    </Pressable>
  );
}

/** A destination that is not a tab (Settings): same footprint, never "selected". */
export function BarLink({ icon, label, onPress }: BarButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      className="size-12 items-center justify-center rounded-full active:opacity-60">
      <Icon icon={icon} color="muted" size={22} />
    </Pressable>
  );
}
