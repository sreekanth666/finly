import { BottomSheet, Typography } from 'heroui-native';
import { SlidersHorizontal } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';

import { Button } from './button';
import { FilterChipBar, type FilterOption } from './filter-chip-bar';
import { Icon } from './icon';
import { SectionHeader } from './section-header';

import type { AccountRow } from '@/db/schema';
import { addPeriods, currentPeriod, formatPeriodLong } from '@/domain/period';

/** As far back as the month picker offers. A year covers every carry-over. */
const MONTHS = 12;

/** The id the chip bars use for "not filtered", which is `null` everywhere else. */
const ANY = 'any';

export type TransactionFiltersProps = {
  monthsBack: number | null;
  onMonthsBackChange: (next: number | null) => void;
  accountId: string | null;
  onAccountIdChange: (next: string | null) => void;
  budgetOnly: boolean;
  onBudgetOnlyChange: (next: boolean) => void;
  accounts: AccountRow[];
  /** Undefined while the feed is still resolving, which only affects the label. */
  resultCount: number | undefined;
};

/**
 * Month, account and budget-only, behind one control beside the search field.
 *
 * These three used to sit on the screen as two more rows of chips under the
 * categories, which put three chip rows in a column and read as one
 * undifferentiated wall. Worse, each chip was a *cycle*: reaching June meant
 * tapping the month five times, and picking a third account meant tapping past
 * the first two. A sheet costs one extra tap to open and gives direct selection
 * in exchange, which is the better trade for everything except stepping back a
 * single month.
 *
 * The trigger and the sheet live together and the open state stays in here, so
 * the screen mounts one element beside its search box and never manages sheet
 * visibility.
 */
export function TransactionFilters({
  monthsBack,
  onMonthsBackChange,
  accountId,
  onAccountIdChange,
  budgetOnly,
  onBudgetOnlyChange,
  accounts,
  resultCount,
}: TransactionFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  /* The month a "months back" offset counts from. Re-anchored when the sheet
     opens rather than fixed at mount: this tab stays mounted for the life of
     the app, so a month rolling over underneath it would otherwise leave every
     option named for the wrong month. */
  const [monthAnchor, setMonthAnchor] = useState(currentPeriod);

  const open = () => {
    setMonthAnchor(currentPeriod());
    setIsOpen(true);
  };

  /* Only the three this sheet owns. Search and the category chips stay on the
     screen, so counting them here would label the button for filters the user
     can already see. */
  const activeCount =
    (monthsBack === null ? 0 : 1) + (accountId === null ? 0 : 1) + (budgetOnly ? 1 : 0);

  const monthOptions = useMemo<FilterOption<string>[]>(
    () => [
      { id: ANY, label: 'Any month' },
      ...Array.from({ length: MONTHS }, (_, index) => ({
        id: String(index),
        label: formatPeriodLong(addPeriods(monthAnchor, -index)),
      })),
    ],
    [monthAnchor],
  );

  const accountOptions = useMemo<FilterOption<string>[]>(
    () => [
      { id: ANY, label: 'Any account' },
      ...accounts.map((account) => ({ id: account.id, label: account.name })),
    ],
    [accounts],
  );

  /* Pinned rather than dynamic. gorhom has to measure the content before it
     knows where a dynamically-sized sheet's one snap point is, and until it
     does the sheet mounts part-way up — visible along the bottom of the screen
     before anyone has touched the button. The settlement sheet pins its height
     for the same reason. Two heights because the account section is
     conditional, and a sheet sized for a list that isn't there is mostly empty
     space. */
  const snapPoints = useMemo(() => [accounts.length > 0 ? '58%' : '46%'], [accounts.length]);

  const reset = () => {
    onMonthsBackChange(null);
    onAccountIdChange(null);
    onBudgetOnlyChange(false);
  };

  const applyLabel =
    resultCount === undefined
      ? 'Done'
      : resultCount === 1
        ? 'Show 1 expense'
        : `Show ${resultCount} expenses`;

  return (
    /* One element, not a fragment: BottomSheet's root renders a View of its own
       even though its content is portalled, and as a sibling of the trigger it
       collected a share of the search row's `gap` — leaving a dead margin to
       the right of the button. Wrapped, the row sees one child. */
    <View>
      <Pressable
        accessibilityRole="button"
        /* The count is a badge, and a badge says nothing out loud. */
        accessibilityLabel={activeCount === 0 ? 'Filters' : `Filters, ${activeCount} active`}
        accessibilityState={{ expanded: isOpen }}
        onPress={open}
        className={
          activeCount === 0
            ? 'flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl bg-surface px-3.5 active:opacity-60'
            : 'flex-1 flex-row items-center justify-center gap-1.5 rounded-2xl bg-accent px-3.5 active:opacity-60'
        }>
        <Icon
          icon={SlidersHorizontal}
          color={activeCount === 0 ? 'muted' : 'accent-foreground'}
          size={18}
        />
        {activeCount > 0 && (
          <Typography type="body-xs" weight="semibold" className="text-accent-foreground">
            {activeCount}
          </Typography>
        )}
      </Pressable>

      <BottomSheet isOpen={isOpen} onOpenChange={setIsOpen}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content
            snapPoints={snapPoints}
            enableDynamicSizing={false}
            enableOverDrag={false}>
            <View className="gap-5">
              <View className="flex-row items-center justify-between gap-3">
                <BottomSheet.Title>Filters</BottomSheet.Title>
                {activeCount > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Clear all filters"
                    hitSlop={8}
                    onPress={reset}
                    className="active:opacity-60">
                    <Typography type="body-sm" weight="medium" className="text-link">
                      Reset
                    </Typography>
                  </Pressable>
                )}
              </View>

              {/* The chip bars carry their own leading inset and are meant to
                  run off the edge, so they are pulled back out of the sheet's
                  own padding rather than nested inside it. */}
              <View className="gap-2">
                <SectionHeader label="Month" />
                <View className="-mx-5">
                  <FilterChipBar
                    options={monthOptions}
                    selectedId={monthsBack === null ? ANY : String(monthsBack)}
                    onSelect={(id) => onMonthsBackChange(id === ANY ? null : Number(id))}
                  />
                </View>
              </View>

              {/* No accounts yet means nothing to choose between — §5 seeds none. */}
              {accounts.length > 0 && (
                <View className="gap-2">
                  <SectionHeader label="Account" />
                  <View className="-mx-5">
                    <FilterChipBar
                      options={accountOptions}
                      selectedId={accountId ?? ANY}
                      onSelect={(id) => onAccountIdChange(id === ANY ? null : id)}
                    />
                  </View>
                </View>
              )}

              <View className="flex-row items-center gap-3 rounded-3xl bg-surface px-4 py-3.5">
                <View className="flex-1 gap-0.5">
                  <Typography type="body-sm" weight="semibold">
                    Budget only
                  </Typography>
                  <Typography type="body-xs" color="muted">
                    Hide anything set not to count toward the month.
                  </Typography>
                </View>
                <Switch
                  value={budgetOnly}
                  onValueChange={onBudgetOnlyChange}
                  accessibilityLabel="Show only expenses that count toward the budget"
                />
              </View>

              {/* The filters apply as they are tapped, so this only dismisses —
                  but it says what is waiting behind the sheet, which is the
                  question someone has while choosing. */}
              <Button label={applyLabel} onPress={() => setIsOpen(false)} />
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </View>
  );
}
