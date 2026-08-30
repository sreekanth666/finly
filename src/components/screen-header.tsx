import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { EllipsisVertical } from 'lucide-react-native';
import { View } from 'react-native';

import { IconButton } from './icon-button';

export type ScreenHeaderProps = {
  /** The screen's name, so each tab announces itself. */
  title?: string;
};

/**
 * The row every tab opens with.
 *
 * It used to carry an avatar showing the hardcoded initials "SK" and a bell with
 * no handler. There is no user table for the first — §1 is explicit that there
 * is no account — and notifications are an explicit §2 non-goal, so the bell was
 * a permanently dead control shipping on all four tabs. Both are gone; what is
 * left is the one thing that does something.
 */
export function ScreenHeader({ title }: ScreenHeaderProps) {
  return (
    <View className="flex-row items-center">
      {title !== undefined && (
        <Typography type="body-sm" weight="semibold" color="muted">
          {title}
        </Typography>
      )}
      <View className="flex-1" />
      {/* App chrome, so it routes directly rather than making all four tabs
          pass the same handler down. */}
      <IconButton
        icon={EllipsisVertical}
        label="Settings"
        onPress={() => router.push('/settings')}
      />
    </View>
  );
}
