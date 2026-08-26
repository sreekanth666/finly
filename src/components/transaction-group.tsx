import { Typography } from 'heroui-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { TransactionRow } from './transaction-row';

import type { Transaction } from '@/data/transactions';

/** Rows shown before the group has to be expanded. */
const PREVIEW_COUNT = 3;

export type TransactionGroupProps = {
  label: string;
  transactions: Transaction[];
};

/**
 * One day of the feed: a labelled header over a card of rows. Long days are
 * capped at `PREVIEW_COUNT` and expand in place, so a busy day can't push the
 * next one off the screen.
 */
export function TransactionGroup({ label, transactions }: TransactionGroupProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const isCapped = transactions.length > PREVIEW_COUNT;
  const visible = isExpanded || !isCapped ? transactions : transactions.slice(0, PREVIEW_COUNT);

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between px-1">
        <Typography type="body-sm" color="muted">
          {label}
        </Typography>
        {isCapped && (
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setIsExpanded((expanded) => !expanded)}
            className="active:opacity-60">
            <Typography type="body-sm" className="text-link">
              {isExpanded ? 'See less' : 'See more'}
            </Typography>
          </Pressable>
        )}
      </View>

      <View className="gap-1 rounded-3xl bg-surface p-2">
        {visible.map((transaction) => (
          <TransactionRow key={transaction.id} transaction={transaction} />
        ))}
      </View>
    </View>
  );
}
