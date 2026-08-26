import { Avatar, Typography } from 'heroui-native';
import { Bell, EllipsisVertical } from 'lucide-react-native';
import { View } from 'react-native';

import { IconButton } from './icon-button';

export type ScreenHeaderProps = {
  /** Initials shown until a real profile image exists. */
  initials?: string;
};

/**
 * The account row every tab opens with: avatar on the left, notifications and
 * overflow on the right. Shared so the tabs can't drift apart.
 */
export function ScreenHeader({ initials = 'SK' }: ScreenHeaderProps) {
  return (
    <View className="flex-row items-center">
      <Avatar size="sm">
        <Avatar.Fallback>
          <Typography type="body-sm" weight="semibold">
            {initials}
          </Typography>
        </Avatar.Fallback>
      </Avatar>
      <View className="flex-1" />
      <IconButton icon={Bell} label="Notifications" />
      <IconButton icon={EllipsisVertical} label="More options" />
    </View>
  );
}
