import { Typography } from 'heroui-native';
import { View } from 'react-native';

import { Amount } from './amount';
import { Icon } from './icon';

import { CATEGORIES } from '@/data/categories';
import type { TopItem } from '@/data/insights';

/**
 * A ranked table rather than a chart. Five labelled rows with their amounts
 * answer "what did I keep buying" directly; encoding them as another five
 * colours would add a legend without adding an answer.
 */
export function TopItemsList({ items }: { items: TopItem[] }) {
  return (
    <View className="gap-1 rounded-3xl bg-surface p-2">
      {items.map((item, index) => {
        const category = CATEGORIES[item.categoryId];

        return (
          <View key={item.id} className="flex-row items-center gap-3 px-2 py-2">
            <Typography type="body-xs" color="muted" className="w-4">
              {index + 1}
            </Typography>

            <View className="size-8 items-center justify-center rounded-lg bg-surface-secondary">
              <Icon icon={category.icon} color={category.tone} size={14} />
            </View>

            <View className="flex-1 gap-0.5">
              <Typography type="body-sm" weight="semibold" truncate>
                {item.item}
              </Typography>
              <Typography type="body-xs" color="muted">
                {`${category.label} · ${item.count === 1 ? 'once' : `${item.count} times`}`}
              </Typography>
            </View>

            <Amount
              value={item.amount}
              className="type-amount-sm text-foreground"
              centsClassName="type-amount-sm"
            />
          </View>
        );
      })}
    </View>
  );
}
