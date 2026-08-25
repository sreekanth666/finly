import { Typography } from 'heroui-native';
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Amount } from './amount';
import { Icon } from './icon';

import type { AppColor } from '@/theme';

/** The two card treatments from the mockup. */
export type StatCardTone = 'iris' | 'accent';

export type StatCardProps = {
  tone: StatCardTone;
  title: string;
  caption: string;
  amount: number;
  icon: LucideIcon;
};

/**
 * Class strings are spelled out per tone rather than built from a template, so
 * the CSS compiler can see every utility this component can render.
 */
const TONES: Record<
  StatCardTone,
  { card: string; badge: string; text: string; icon: AppColor }
> = {
  iris: {
    card: 'bg-iris',
    badge: 'bg-iris-hover',
    text: 'text-iris-foreground',
    icon: 'iris-foreground',
  },
  accent: {
    card: 'bg-accent',
    badge: 'bg-accent-hover',
    text: 'text-accent-foreground',
    icon: 'accent-foreground',
  },
};

export function StatCard({ tone, title, caption, amount, icon }: StatCardProps) {
  const styles = TONES[tone];

  return (
    <View className={`flex-1 justify-between gap-10 rounded-3xl p-4 ${styles.card}`}>
      <View className="flex-row items-start justify-between gap-2">
        <Typography type="body" weight="semibold" className={`flex-1 ${styles.text}`}>
          {title}
        </Typography>
        <View className={`size-9 items-center justify-center rounded-xl ${styles.badge}`}>
          <Icon icon={icon} color={styles.icon} size={18} />
        </View>
      </View>

      <View className="gap-1">
        <Typography type="body-xs" className={styles.text}>
          {caption}
        </Typography>
        <Amount value={amount} className={`type-amount ${styles.text}`} />
      </View>
    </View>
  );
}
