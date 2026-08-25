import { Typography } from 'heroui-native';
import type { LucideIcon } from 'lucide-react-native';
import { forwardRef } from 'react';
import { Pressable, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon } from './icon';

import type { TabTriggerSlotProps } from 'expo-router/ui';

/**
 * Styled container for the tab bar. Rendered through `<TabList asChild>` so the
 * triggers stay direct children of the list — expo-router discovers them by
 * walking the element tree, and a wrapper component would hide them.
 */
export const TabBarSurface = forwardRef<View, ViewProps>(({ style, ...props }, ref) => {
  const insets = useSafeAreaInsets();

  return (
    <View
      ref={ref}
      className="flex-row border-t border-border bg-background px-2 pt-3"
      style={[{ paddingBottom: insets.bottom + 12 }, style]}
      {...props}
    />
  );
});

TabBarSurface.displayName = 'TabBarSurface';

export type TabItemProps = TabTriggerSlotProps & {
  icon: LucideIcon;
  label: string;
};

/** A single tab: icon over label, white when focused and muted otherwise. */
export const TabItem = forwardRef<View, TabItemProps>(
  ({ icon, label, isFocused, style, ...props }, ref) => (
    <Pressable
      ref={ref}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      className="flex-1 items-center gap-1 py-1"
      /**
       * TabTrigger injects `flexDirection: 'row'` and `justifyContent:
       * 'space-between'`, which lands after the className styles and lays the
       * icon beside the label. Override it last so the label sits underneath.
       */
      style={(state) => [
        typeof style === 'function' ? style(state) : style,
        { flexDirection: 'column', justifyContent: 'center' },
      ]}
      {...props}>
      <Icon icon={icon} color={isFocused ? 'foreground' : 'muted'} size={22} />
      <Typography type="body-xs" className={isFocused ? 'text-foreground' : 'text-muted'}>
        {label}
      </Typography>
    </Pressable>
  )
);

TabItem.displayName = 'TabItem';
