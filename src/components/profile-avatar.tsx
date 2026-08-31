import { Typography } from 'heroui-native';
import { User } from 'lucide-react-native';
import { View } from 'react-native';

import { Icon } from './icon';

import { initialsOf } from '@/domain/profile';

export type ProfileAvatarProps = {
  /** Null when the name has never been set — the step is skippable. */
  name: string | null;
  size?: 'sm' | 'lg';
};

/*
 * Spelled out per size rather than built from a template, so the CSS compiler
 * can see every utility this component can render — the same reason
 * FilterChipBar does it.
 */
const SIZES = {
  sm: { frame: 'size-10 rounded-full', text: 'body-sm', icon: 18 },
  lg: { frame: 'size-24 rounded-full', text: 'h2', icon: 40 },
} as const;

/**
 * Initials on the accent fill, or a neutral glyph when there is no name.
 *
 * The nameless state is not a failure — every onboarding step is skippable —
 * so it gets a quiet surface rather than the accent, and reads as "not set"
 * instead of as a broken avatar.
 */
export function ProfileAvatar({ name, size = 'sm' }: ProfileAvatarProps) {
  const initials = name === null ? null : initialsOf(name);
  const { frame, text, icon } = SIZES[size];

  if (initials === null) {
    return (
      <View className={`${frame} items-center justify-center bg-surface-secondary`}>
        <Icon icon={User} color="muted" size={icon} />
      </View>
    );
  }

  return (
    <View className={`${frame} items-center justify-center bg-accent`}>
      <Typography type={text} weight="semibold" className="text-accent-foreground">
        {initials}
      </Typography>
    </View>
  );
}
