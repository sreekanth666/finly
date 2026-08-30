import { router } from 'expo-router';
import { Typography } from 'heroui-native';
import { Plus, Receipt, Search, X } from 'lucide-react-native';
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ErrorState } from '@/components/error-state';
import { FilterChipBar, type FilterOption } from '@/components/filter-chip-bar';
import { Icon } from '@/components/icon';
import { SafeAreaView } from '@/components/safe-area-view';
import { ScreenHeader } from '@/components/screen-header';
import { SwipeToDelete } from '@/components/swipe-to-delete';
import { TransactionFilters } from '@/components/transaction-filters';
import { TransactionRow, TRANSACTION_ROW_HEIGHT } from '@/components/transaction-row';
import { UndoToast } from '@/components/undo-toast';
import { restoreExpense, softDeleteExpense } from '@/db/repositories/expenses';
import type { ExpenseListItem } from '@/db/repositories/expenses';
import { useAction } from '@/db/use-action';
import { flattenGroups, type FeedRow } from '@/domain/feed';
import { addPeriods, currentPeriod } from '@/domain/period';
import { useAccounts, useCategories } from '@/features/catalog/hooks';
import { useExpenseFeed } from '@/features/expenses/hooks';
import { useAppColor } from '@/theme';

/** One page of the feed. The list asks for more as it reaches the end. */
const PAGE_SIZE = 60;
const HEADER_HEIGHT = 36;

type FilterId = 'all' | string;

export default function TransactionsScreen() {
  const [filter, setFilter] = useState<FilterId>('all');
  const [search, setSearch] = useState('');
  const [budgetOnly, setBudgetOnly] = useState(false);
  /* §7.3 names three filters. The repository has supported period and account
     since M1; only the category chips were ever wired up. */
  const [accountId, setAccountId] = useState<string | null>(null);
  const [monthsBack, setMonthsBack] = useState<number | null>(null);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [undoable, setUndoable] = useState<{ id: string; item: string } | null>(null);

  /*
   * Deferring the search keeps typing responsive: the query runs against the
   * settled value while the field itself stays on the latest keystroke.
   */
  const deferredSearch = useDeferredValue(search);
  const mutedColor = useAppColor('muted');

  const categories = useCategories();
  const accounts = useAccounts();

  const period = monthsBack === null ? undefined : addPeriods(currentPeriod(), -monthsBack);

  const filters = useMemo<FilterOption<FilterId>[]>(
    () => [
      { id: 'all', label: 'All' },
      ...(categories.data ?? []).map((category) => ({ id: category.id, label: category.name })),
    ],
    [categories.data],
  );

  const feed = useExpenseFeed(
    {
      period,
      categoryIds: filter === 'all' ? undefined : [filter],
      accountIds: accountId === null ? undefined : [accountId],
      search: deferredSearch,
      budgetOnly,
    },
    limit,
  );

  const rows = useMemo<FeedRow<ExpenseListItem>[]>(
    () => (feed.data === undefined ? [] : flattenGroups(feed.data.groups)),
    [feed.data],
  );

  const remove = useAction(softDeleteExpense);
  const restore = useAction(restoreExpense);

  const isFiltered =
    filter !== 'all' ||
    search.trim().length > 0 ||
    budgetOnly ||
    accountId !== null ||
    monthsBack !== null;

  const clearFilters = () => {
    setFilter('all');
    setSearch('');
    setBudgetOnly(false);
    setAccountId(null);
    setMonthsBack(null);
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* The header, title and filters sit outside the list so the filter stays
          reachable however far the feed is scrolled. */}
      <View className="gap-4 pt-2 pb-3">
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

        {/* items-stretch, so the filter trigger takes its height from the field
            beside it rather than needing one hard-coded to match. */}
        <View className="flex-row items-stretch gap-2 px-5">
          <View className="flex-1 flex-row items-center gap-2 rounded-2xl bg-surface px-3">
            <Icon icon={Search} color="muted" size={16} />
            <TextInput
              className="type-body-sm flex-1 py-2.5 text-foreground"
              placeholder="Search item or note"
              placeholderTextColor={mutedColor}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              returnKeyType="search"
              accessibilityLabel="Search transactions"
            />
            {search.length > 0 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={8}
                onPress={() => setSearch('')}>
                <Icon icon={X} color="muted" size={16} />
              </Pressable>
            )}
          </View>

          <TransactionFilters
            monthsBack={monthsBack}
            onMonthsBackChange={setMonthsBack}
            accountId={accountId}
            onAccountIdChange={setAccountId}
            budgetOnly={budgetOnly}
            onBudgetOnlyChange={setBudgetOnly}
            accounts={accounts.data ?? []}
            resultCount={feed.data?.total}
          />
        </View>

        <FilterChipBar options={filters} selectedId={filter} onSelect={setFilter} />

        {/* The count sat on the end of the budget-only row; with that row gone
            it lives under the categories, where it still answers "how much did
            the filters just cut away?". */}
        {feed.data !== undefined && (
          <View className="px-5">
            <Typography type="body-xs" color="muted">
              {feed.data.total === 1 ? '1 expense' : `${feed.data.total} expenses`}
            </Typography>
          </View>
        )}
      </View>

      {feed.error !== null ? (
        <ErrorState error={feed.error} onRetry={feed.refetch} />
      ) : (
        <FlatList
          className="flex-1"
          data={rows}
          keyExtractor={(row) => row.key}
          renderItem={({ item }) =>
            item.type === 'header' ? (
              <View className="h-9 justify-end pb-1">
                <Typography type="body-xs" weight="semibold" color="muted">
                  {item.label}
                </Typography>
              </View>
            ) : (
              <SwipeToDelete
                accessibilityLabel={item.item.item}
                onDelete={async () => {
                  const outcome = await remove.run(item.item.id);
                  /* Offer the undo only once the delete actually landed —
                     otherwise a failed write leaves an Undo for something that
                     was never deleted. */
                  if (outcome.ok) setUndoable({ id: item.item.id, item: item.item.item });
                }}>
                <TransactionRow
                  expense={item.item}
                  onPress={() => router.push(`/expense/${item.item.id}`)}
                />
              </SwipeToDelete>
            )
          }
          /* Uniform row heights are the whole reason the feed is flattened: a
             variable-height day group cannot supply this, and without it a fast
             scroll leaves blank space behind. */
          getItemLayout={(data, index) => {
            let offset = 0;
            for (let cursor = 0; cursor < index; cursor += 1) {
              offset += data?.[cursor]?.type === 'header' ? HEADER_HEIGHT : TRANSACTION_ROW_HEIGHT;
            }
            const length = data?.[index]?.type === 'header' ? HEADER_HEIGHT : TRANSACTION_ROW_HEIGHT;
            return { length, offset, index };
          }}
          initialNumToRender={12}
          maxToRenderPerBatch={10}
          windowSize={7}
          removeClippedSubviews
          onEndReachedThreshold={0.6}
          onEndReached={() => {
            if (feed.data?.hasMore === true) setLimit((current) => current + PAGE_SIZE);
          }}
          contentContainerClassName="px-5 pb-8"
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            isFiltered ? (
              <EmptyState
                icon={Search}
                title="Nothing matches"
                description="No expenses match this filter. Try widening it."
                action={{ label: 'Clear filters', onPress: clearFilters }}
              />
            ) : (
              <EmptyState
                icon={Receipt}
                title="No expenses yet"
                description="Add one by hand, or bring your history across from a spreadsheet in Settings."
                action={{ label: 'Add expense', icon: Plus, onPress: () => router.push('/expense/new') }}
              />
            )
          }
        />
      )}

      {undoable !== null && (
        <UndoToast
          message={`Deleted “${undoable.item}”`}
          onUndo={async () => {
            await restore.run(undoable.id);
            setUndoable(null);
          }}
          onExpire={() => setUndoable(null)}
        />
      )}
    </SafeAreaView>
  );
}
