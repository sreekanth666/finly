import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { FilterChipBar, type FilterOption } from '@/components/filter-chip-bar';
import { ScreenHeader } from '@/components/screen-header';
import { TransactionGroup } from '@/components/transaction-group';
import { CATEGORIES, type CategoryId } from '@/data/categories';
import { transactionDays } from '@/data/transactions';

type FilterId = 'all' | CategoryId;

/** Order the pills appear in — the mockup leads with the categories seen most. */
const FILTER_ORDER: CategoryId[] = [
  'income',
  'shopping',
  'bills',
  'housing',
  'food',
  'transport',
  'health',
  'personal',
  'other',
];

const FILTERS: FilterOption<FilterId>[] = [
  { id: 'all', label: 'All' },
  ...FILTER_ORDER.map((id) => ({ id, label: CATEGORIES[id].label })),
];

export default function TransactionsScreen() {
  const [filter, setFilter] = useState<FilterId>('all');

  /** Days keep their grouping under a filter; days left with nothing drop out. */
  const days = useMemo(() => {
    if (filter === 'all') {
      return transactionDays;
    }

    return transactionDays
      .map((day) => ({
        ...day,
        transactions: day.transactions.filter(({ categoryId }) => categoryId === filter),
      }))
      .filter((day) => day.transactions.length > 0);
  }, [filter]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* The header, title and filters sit outside the list so the filter stays
          reachable however far the feed is scrolled. */}
      <View className="gap-5 pt-2 pb-4">
        <View className="px-5">
          <ScreenHeader />
        </View>

        <View className="flex-row items-center justify-between gap-3 px-5">
          <Typography.Heading type="h2" weight="bold" className="flex-1" truncate>
            Transactions
          </Typography.Heading>
          <Button
            icon={Plus}
            label="Add"
            size="sm"
            accessibilityLabel="Add expense"
            onPress={() => router.push('/expense/new')}
          />
        </View>

        <FilterChipBar options={FILTERS} selectedId={filter} onSelect={setFilter} />
      </View>

      <FlatList
        className="flex-1"
        data={days}
        keyExtractor={(day) => day.id}
        renderItem={({ item }) => (
          <TransactionGroup label={item.label} transactions={item.transactions} />
        )}
        contentContainerClassName="gap-6 px-5 pb-8"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="items-center gap-1 py-16">
            <Typography type="body" weight="medium">
              Nothing here yet
            </Typography>
            <Typography type="body-sm" color="muted">
              No transactions match this filter.
            </Typography>
          </View>
        }
      />
    </SafeAreaView>
  );
}
