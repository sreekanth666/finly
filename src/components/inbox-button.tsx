import { Typography } from 'heroui-native';
import { Inbox } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from './icon';

import { useCaptureEnabled, useReviewCount } from '@/features/capture/hooks';
import { useNavigateOnce } from '@/features/navigation/hooks';

/**
 * The way into the review inbox (D17), beside Settings on the Balance header.
 *
 * Shown while detection is on, or while anything is waiting — so switching the
 * feature off never strands candidates that already arrived. The count is only
 * what might be spending; see `countsTowardBadge`.
 */
export function InboxButton() {
  const navigate = useNavigateOnce();
  const enabled = useCaptureEnabled();
  const count = useReviewCount();

  const pending = count.data ?? 0;
  if (enabled.data !== true && pending === 0) return null;

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
