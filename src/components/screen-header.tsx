import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { EllipsisVertical } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { IconButton } from './icon-button';
import { ProfileAvatar } from './profile-avatar';

import { greetingFor } from '@/domain/profile';
import { useProfileName } from '@/features/profile/hooks';

export type ScreenHeaderProps = {
  /** The screen's name, so each tab announces itself. */
  title?: string;
  /**
   * Whether to address the user by name beside the avatar. One screen's job —
   * a greeting repeated on all four tabs stops being a greeting.
   */
  greeting?: boolean;
};

/**
 * The row every tab opens with.
 *
 * The avatar here once showed the hardcoded initials "SK" beside a bell with no
 * handler, and both were removed: there was no name to draw initials from, and
 * notifications are an explicit §2 non-goal. The bell stays gone. The avatar is
 * back because the first thing onboarding now asks for is what to call someone,
 * so it has a real name behind it and somewhere to go — which are the two things
 * it was missing.
 */
export function ScreenHeader({ title, greeting = false }: ScreenHeaderProps) {
  const name = useProfileName();

  /* Undefined while the read is in flight. Rendering the greeting without the
     name would show "Good evening," and then reflow a frame later, so the whole
     line waits for the answer rather than flashing half of it. */
  const stored = name.data;

  const label = stored === undefined || stored === null ? 'Profile' : `Profile, ${stored}`;

  return (
    <View className="flex-row items-center gap-3">
      {/* App chrome, so it routes directly rather than making all four tabs
          pass the same handler down. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={8}
        onPress={() => router.push('/profile')}
        className="active:opacity-60">
        <ProfileAvatar name={stored ?? null} />
      </Pressable>

      {/* Shrinks rather than grows: the spacer below owns the slack, so a long
          name truncates instead of pushing the settings button off the row. */}
      {greeting && stored !== undefined && (
        <Typography type="body-sm" weight="semibold" className="shrink" numberOfLines={1}>
          {stored === null ? greetingFor() : `${greetingFor()}, ${stored}`}
        </Typography>
      )}

      {title !== undefined && (
        <Typography type="body-sm" weight="semibold" color="muted">
          {title}
        </Typography>
      )}

      <View className="flex-1" />
      <IconButton
        icon={EllipsisVertical}
        label="Settings"
        onPress={() => router.push('/settings')}
      />
    </View>
  );
}
