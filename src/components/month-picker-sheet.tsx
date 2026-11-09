import { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { BottomSheet, Typography } from 'heroui-native';
import { Check } from '@/components/icons';
import { useMemo } from 'react';
import { Pressable, View } from 'react-native';

import { Amount } from './amount';
import { Icon } from './icon';
import { VERTICAL_ONLY_PAN } from './sheet-pan';

import type { PeriodResult } from '@/domain/budget';
import { formatMinor, speakMinor } from '@/domain/money';
import {
  currentPeriod,
  formatPeriodLong,
  formatPeriodMonth,
  parsePeriod,
  type PeriodKey,
} from '@/domain/period';

export type MonthPickerSheetProps = {
  isOpen: boolean;
  onOpenChange: (next: boolean) => void;
  /** Every month on record, oldest first, as the budget history returns them. */
  periods: readonly PeriodResult[];
  /** The month on screen. */
  selected: PeriodKey;
  onSelect: (period: PeriodKey) => void;
};

/** Pinned for the reason RulesHelpSheet gives; the list scrolls inside it. */
const SNAP_POINTS = ['60%'];

/**
 * Which month Balance shows, from the month name in its header.
 *
 * Newest first, so the first row is always the month being lived in: it is
 * the way back from any older one, and says "This month" rather than naming a
 * month the header is already naming. Each row carries what that month cost
 * against its budget, which is most of what anyone opens a list of months to
 * find.
 *
 * Controlled from the header and mounted for its whole life, for the reason
 * TransactionFilters gives.
 */
export function MonthPickerSheet({
  isOpen,
  onOpenChange,
  periods,
  selected,
  onSelect,
}: MonthPickerSheetProps) {
  const rows = useMemo(() => [...periods].reverse(), [periods]);

  const now = currentPeriod();
  const thisYear = parsePeriod(now).year;

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={SNAP_POINTS}
          enableDynamicSizing={false}
          enableOverDrag={false}
          {...VERTICAL_ONLY_PAN}
          contentContainerClassName="h-full">
          <BottomSheetScrollView>
            <View className="gap-2 pb-8">
              <BottomSheet.Title>Choose a month</BottomSheet.Title>

              <View>
                {rows.map((row) => {
                  const isSelected = row.period === selected;
                  const isNow = row.period === now;
                  const name =
                    parsePeriod(row.period).year === thisYear
                      ? formatPeriodMonth(row.period)
                      : formatPeriodLong(row.period);
                  const budget = formatMinor(row.budget, { showFraction: false });

                  return (
                    <Pressable
                      key={row.period}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={`${isNow ? 'This month, ' : ''}${name}, ${speakMinor(row.spent)} spent of ${budget}`}
                      onPress={() => {
                        onSelect(row.period);
                        onOpenChange(false);
                      }}
                      className="flex-row items-center gap-3 border-b border-border py-3 active:opacity-60">
                      <View className="flex-1">
                        <Typography type="body" weight={isSelected ? 'semibold' : 'medium'}>
                          {isNow ? 'This month' : name}
                        </Typography>
                        {isNow && (
                          <Typography type="body-xs" color="muted">
                            {name}
                          </Typography>
                        )}
                      </View>

                      <View className="items-end">
                        <Amount
                          value={row.spent}
                          className="type-amount-sm text-foreground"
                          fractionClassName="type-amount-sm"
                          showFraction={false}
                        />
                        <Typography type="body-xs" color="muted">
                          {`of ${budget}`}
                        </Typography>
                      </View>

                      {/* Reserved on every row so the figures stay in one column. */}
                      <View className="w-5 items-center">
                        {isSelected && <Icon icon={Check} color="accent" size={18} />}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
