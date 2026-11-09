import { Typography } from 'heroui-native';
import { Inbox } from '@/components/icons';
import { Pressable, View } from 'react-native';

import { Icon } from './icon';

import { useReviewCount } from '@/features/capture/hooks';
import { useNavigateOnce } from '@/features/navigation/hooks';

/**
 * The way into the review inbox (D17), on the right of the Balance header.
 *
 * Always shown, whether or not detection is on. With it off the inbox is still
 * where a pasted payment message goes and where the switch to turn detection on
 * is offered, and hiding the button left no way to either from Balance. The
 * badge is only there while something is waiting, and counts only what might be
 * spending; see `countsTowardBadge`.
 */
export function InboxButton() {
  const navigate = useNavigateOnce();
  const count = useReviewCount();

  const pending = count.data ?? 0;

  const label = pending === 0 ? 'Review inbox' : `Review inbox, ${pending} to review`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      onPress={() => navigate('/inbox')}
      className="size-10 items-center justify-center rounded-full active:opacity-60">
      <Icon icon={Inbox} color="foreground" size={22} />
      {pending > 0 && (
        <View className="absolute right-0.5 top-0.5 min-w-4 items-center rounded-full bg-accent px-1">
          <Typography type="body-xs" weight="semibold" className="text-accent-foreground">
            {pending > 99 ? '99+' : String(pending)}
          </Typography>
        </View>
      )}
    </Pressable>
  );
}
