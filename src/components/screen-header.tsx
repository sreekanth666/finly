import { Typography } from 'heroui-native';
import { EllipsisVertical } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { IconButton } from './icon-button';
import { ProfileAvatar } from './profile-avatar';

import { greetingFor } from '@/domain/profile';
import { useProfileName } from '@/features/profile/hooks';
import { useNavigateOnce } from '@/features/navigation/hooks';

export type ScreenHeaderProps = {
  /**
   * Whether to address the user by name beside the avatar. One screen's job —
   * a greeting repeated on all four tabs stops being a greeting.
   */
  greeting?: boolean;
  /**
   * A screen's own action, placed just before Settings — e.g. the "?" on
   * Rules. Kept to icon buttons so the row reads the same on every tab.
   */
  trailing?: ReactNode;
};

/**
 * The row every tab opens with.
 *
 * The avatar here once showed the hardcoded initials "SK" beside a bell with no
 * handler, and both were removed: there was no name to draw initials from, and
 * notifications were a §1 non-goal. D16 has since allowed one daily reminder,
 * but it is set up in Settings and leaves nothing behind to read, so the bell
 * stays gone. The avatar is back because the first thing onboarding now asks
 * for is what to call someone, so it has a real name behind it and somewhere to
 * go — which are the two things it was missing.
 */
export function ScreenHeader({ greeting = false, trailing }: ScreenHeaderProps) {
  /* One push per press: the row stays tappable for the whole transition. */
  const navigate = useNavigateOnce();

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
        onPress={() => navigate('/profile')}
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

      <View className="flex-1" />
      {trailing}
      <IconButton
        icon={EllipsisVertical}
        label="Settings"
        onPress={() => navigate('/settings')}
      />
    </View>
  );
}
