import { Typography } from 'heroui-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

export type ScreenHeaderProps = {
  title: string;
  /**
   * A screen's own action at the end of the row — icon buttons only, so the
   * row reads the same on every tab.
   */
  trailing?: ReactNode;
};

/**
 * The title row a tab opens with. Settings is in the floating bar and the
 * profile lives in Settings, so there is nothing else to put here.
 */
export function ScreenHeader({ title, trailing }: ScreenHeaderProps) {
  return (
    <View className="min-h-10 flex-row items-center justify-between gap-3">
      <Typography.Heading type="h2" weight="bold" className="flex-1" truncate>
        {title}
      </Typography.Heading>
      {trailing}
    </View>
  );
}
