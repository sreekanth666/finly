import { Typography } from 'heroui-native';
import { Pressable, View } from 'react-native';

import { Amount } from './amount';
import { Icon } from './icon';
import { iconFor } from './icon-registry';

import type { ExpenseListItem } from '@/db/repositories/expenses';
import { speakMinor } from '@/domain/money';
import { formatTime } from '@/domain/period';
import { toAppColor } from '@/theme';

export type TransactionRowProps = {
  expense: ExpenseListItem;
  onPress?: () => void;
};

/** The fixed height the flattened feed reports to getItemLayout. */
export const TRANSACTION_ROW_HEIGHT = 60;

/** One entry in the feed: category tile · description · amount over its time. */
export function TransactionRow({ expense, onPress }: TransactionRowProps) {
  const { item, amountMinor, effectiveMinor, occurredAt, category, settledMinor } = expense;
  const wasSettled = settledMinor > 0;

  /*
   * A category can be missing: it is nullable in the schema, and a restored
   * backup can reference one this build has never seen. "Uncategorised" is a
   * better answer than a crash.
   */
  const categoryName = category?.name ?? 'Uncategorised';
  const categoryIcon = iconFor(category?.icon);
  const categoryTone = toAppColor(category?.colorToken ?? 'muted', 'muted');

  const time = formatTime(occurredAt);
  const spoken = [
    item,
    categoryName,
    wasSettled
      ? `${speakMinor(effectiveMinor)}, reduced from ${speakMinor(amountMinor)}`
      : speakMinor(amountMinor),
    time,
  ].join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      /* Four separate Text nodes would otherwise be read out as four unrelated
         fragments, which is unusable. */
      accessibilityLabel={spoken}
      onPress={onPress}
      className="h-[60px] flex-row items-center gap-3 rounded-2xl px-3">
      <View className="size-10 items-center justify-center rounded-xl bg-surface-secondary">
        <Icon icon={categoryIcon} color={categoryTone} size={18} />
      </View>

      <View className="flex-1 gap-0.5">
        <Typography type="body-sm" weight="semibold" truncate>
          {item}
        </Typography>
        <Typography type="body-xs" color="muted">
          {categoryName}
        </Typography>
      </View>

      <View className="items-end gap-0.5">
        <View className="flex-row items-baseline gap-1.5">
          {/* The original stays visible: a settlement offsets an expense, it
              never rewrites what was actually spent (D1, §7.3). */}
          {wasSettled && (
            <Amount
              value={amountMinor}
              className="type-amount-sm text-muted line-through"
              fractionClassName="type-amount-sm"
              showFraction={false}
            />
          )}
          <Amount
            value={effectiveMinor}
            className={`type-amount-sm ${effectiveMinor === 0 ? 'text-muted' : 'text-expense'}`}
            fractionClassName="type-amount-sm"
          />
        </View>
        <Typography type="body-xs" color="muted">
          {time}
        </Typography>
      </View>
    </Pressable>
  );
}
