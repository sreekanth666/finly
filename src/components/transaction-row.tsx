import { Typography } from 'heroui-native';
import { Pressable, View } from 'react-native';

import { Amount } from './amount';
import { Icon } from './icon';

import { CATEGORIES } from '@/data/categories';
import type { Transaction } from '@/data/transactions';

export type TransactionRowProps = {
  transaction: Transaction;
  onPress?: () => void;
};

/** One entry in the feed: category tile · description · amount over its time. */
export function TransactionRow({ transaction, onPress }: TransactionRowProps) {
  const { title, categoryId, amount, time } = transaction;
  const category = CATEGORIES[categoryId];
  const isIncome = amount > 0;

  return (
    <Pressable
      accessibilityRole="button"
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
        <Amount
          value={amount}
          signed
          className={`type-amount-sm ${isIncome ? 'text-income' : 'text-expense'}`}
          centsClassName="type-amount-sm"
        />
        <Typography type="body-xs" color="muted">
          {time}
        </Typography>
      </View>
    </Pressable>
  );
}
