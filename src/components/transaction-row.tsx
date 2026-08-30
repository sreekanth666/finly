import { Typography } from 'heroui-native';
import { Pressable, View } from 'react-native';

import { Amount } from './amount';
import { Icon } from './icon';

import { CATEGORIES } from '@/data/categories';
import type { Transaction } from '@/data/transactions';
import { speakMinor, ZERO_MINOR, type Minor } from '@/domain/money';
import { summariseSettlements } from '@/domain/settlement';

export type TransactionRowProps = {
  transaction: Transaction;
  /**
   * Total already returned against this expense, from the query's SUM. When it
   * is non-zero the row shows what the expense originally cost struck through,
   * beside what it actually cost (§7.3).
   */
  settledMinor?: Minor;
  onPress?: () => void;
};

/** One entry in the feed: category tile · description · amount over its time. */
export function TransactionRow({
  transaction,
  settledMinor = ZERO_MINOR,
  onPress,
}: TransactionRowProps) {
  const { title, categoryId, amountMinor, time } = transaction;
  const category = CATEGORIES[categoryId];

  /*
   * There is no income (D4) and amounts are unsigned by constraint, so the row
   * no longer has two directions to distinguish. The colour that used to carry
   * that distinction now carries a more useful one: whether the expense was
   * settled.
   */
  const { effectiveMinor, isSettled, isPartlySettled } = summariseSettlements(
    amountMinor,
    settledMinor,
  );
  const wasSettled = isSettled || isPartlySettled;

  const spoken = [
    title,
    category.label,
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
      className="flex-row items-center gap-3 rounded-2xl px-3 py-2.5 active:opacity-60">
      <View className="size-10 items-center justify-center rounded-xl bg-surface-secondary">
        <Icon icon={category.icon} color={category.tone} size={18} />
      </View>

      <View className="flex-1 gap-0.5">
        <Typography type="body-sm" weight="semibold" truncate>
          {title}
        </Typography>
        <Typography type="body-xs" color="muted">
          {category.label}
        </Typography>
      </View>

      <View className="items-end gap-0.5">
        <View className="flex-row items-baseline gap-1.5">
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
            className={`type-amount-sm ${isSettled ? 'text-muted' : 'text-expense'}`}
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
