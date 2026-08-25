import { Typography } from 'heroui-native';
import { View } from 'react-native';

import { Amount } from './amount';

/** The two card treatments from the mockup. */
export type StatCardTone = 'iris' | 'accent';

export type StatCardProps = {
  tone: StatCardTone;
  title: string;
  caption: string;
  amount: number;
};

/**
 * Class strings are spelled out per tone rather than built from a template, so
 * the CSS compiler can see every utility this component can render.
 */
const TONES: Record<StatCardTone, { card: string; text: string }> = {
  iris: { card: 'bg-iris', text: 'text-iris-foreground' },
  accent: { card: 'bg-accent', text: 'text-accent-foreground' },
};

export function StatCard({ tone, title, caption, amount }: StatCardProps) {
  const styles = TONES[tone];

  return (
    <View className={`flex-1 justify-between gap-10 rounded-3xl p-4 ${styles.card}`}>
      <Typography type="body" weight="semibold" className={styles.text}>
        {title}
      </Typography>

      <View className="gap-1">
        <Typography type="body-xs" className={styles.text}>
          {caption}
        </Typography>
        <Amount
          value={amount}
          className={`text-2xl font-bold ${styles.text}`}
          centsClassName="text-base font-bold"
        />
      </View>
    </View>
  );
}
