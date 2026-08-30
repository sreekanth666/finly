import { Typography } from 'heroui-native';
import { RotateCw, TriangleAlert } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from './icon';

export type InlineErrorProps = {
  message?: string;
  onRetry?: () => void;
};

/**
 * A section that could not load, said out loud.
 *
 * The alternative — and what several screens did — is `?? []`, which renders the
 * section as empty. That reports a read failure as "you have no cards", which is
 * both wrong and unrecoverable, because nothing tells the user to try again.
 * Kept small so it can sit inside a section without taking the screen over; use
 * `ErrorState` when the whole screen has nothing to show.
 */
export function InlineError({
  message = "This couldn't be loaded.",
  onRetry,
}: InlineErrorProps) {
  return (
    <View className="flex-row items-center gap-2 rounded-2xl bg-surface px-4 py-3">
      <Icon icon={TriangleAlert} color="warning" size={14} />
      <Typography type="body-xs" color="muted" className="flex-1">
        {message}
      </Typography>
      {onRetry && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Try loading again"
          hitSlop={8}
          onPress={onRetry}
          className="flex-row items-center gap-1 active:opacity-60">
          <Icon icon={RotateCw} color="accent" size={12} />
          <Typography type="body-xs" weight="semibold" className="text-accent">
            Retry
          </Typography>
        </Pressable>
      )}
    </View>
  );
}
