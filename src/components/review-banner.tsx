import { Typography } from 'heroui-native';
import { ChevronRight, Inbox } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { Icon } from './icon';

import { useReviewCount } from '@/features/capture/hooks';
import { useNavigateOnce } from '@/features/navigation/hooks';

/**
 * "3 payments to review", on Balance, only while something is waiting (D17).
 * Safe-to-spend is only as right as what was logged, and a payment sitting in
 * the inbox is a payment the ring does not know about yet.
 */
export function ReviewBanner() {
  const navigate = useNavigateOnce();
  const count = useReviewCount();
  const pending = count.data ?? 0;
  if (pending === 0) return null;

  const label = pending === 1 ? '1 payment to review' : `${pending} payments to review`;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}. Open the review inbox`}
      onPress={() => navigate('/inbox')}
      className="flex-row items-center gap-2 rounded-2xl bg-surface px-4 py-3 active:opacity-60">
      <Icon icon={Inbox} color="accent" size={14} />
      <Typography type="body-xs" color="muted" className="flex-1">
        {`${label} — not counted until you confirm`}
      </Typography>
      <Icon icon={ChevronRight} color="muted" size={14} />
    </Pressable>
  );
}
