import { Typography } from 'heroui-native';
import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { Amount } from './amount';
import { Icon } from './icon';
import { iconFor } from './icon-registry';

import type { ExpenseListItem } from '@/db/repositories/expenses';
import { speakMinor } from '@/domain/money';
import { formatDayShort } from '@/domain/period';
import { toAppColor } from '@/theme';

export type TransactionRowProps = {
  expense: ExpenseListItem;
  onPress?: () => void;
  /**
   * What sits under the amount. `'date'` is the day the spend happened, for
   * lists that mix days (Home); `'none'` is for the feed, whose day headers
   * already say it.
   */
  meta?: 'date' | 'none';
};

/** The fixed height the flattened feed reports to getItemLayout. */
export const TRANSACTION_ROW_HEIGHT = 60;

/** One entry in the feed: category tile · description · amount over its time. */
function TransactionRowBase({ expense, onPress, meta = 'date' }: TransactionRowProps) {
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

  const when = meta === 'date' ? formatDayShort(occurredAt) : null;
  const spoken = [
    item,
    categoryName,
    wasSettled
      ? `${speakMinor(effectiveMinor)}, reduced from ${speakMinor(amountMinor)}`
      : speakMinor(amountMinor),
    when,
  ]
    .filter((part) => part !== null)
    .join(', ');

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
        {when !== null && (
          <Typography type="body-xs" color="muted">
            {when}
          </Typography>
        )}
      </View>
    </Pressable>
  );
}

/**
 * Memoised because the feed re-renders wholesale whenever a filter, the search
 * term or a single row's data changes, and every row is otherwise rebuilt. The
 * props are a row object and a callback, both stable per row between renders.
 */
export const TransactionRow = memo(TransactionRowBase);
