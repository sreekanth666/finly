import { Typography } from 'heroui-native';
import { ChevronDown } from '@/components/icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from './icon';
import { InboxButton } from './inbox-button';
import { MonthPickerSheet } from './month-picker-sheet';

import type { PeriodResult } from '@/domain/budget';
import { formatPeriodLong, formatPeriodMonth, type PeriodKey } from '@/domain/period';

export type HomeHeaderProps = {
  /** The month on screen. */
  period: PeriodKey;
  /** Every month on record, oldest first. */
  periods: readonly PeriodResult[];
  /** Whether the month on screen is in the same calendar year as today. */
  isThisYear: boolean;
  onSelectPeriod: (period: PeriodKey) => void;
};

/**
 * Which month this is, as the control that changes it. Days left are not
 * repeated here: the spend card already says them beside the daily figure.
 *
 * The greeting and the avatar used to take this row and said nothing the
 * screen did not already say. The month name is the control: it opens a list of
 * every month with what each one cost, which reaches any of them in two taps
 * where stepping with arrows took one per month. Settings is in the floating
 * bar, which leaves the inbox as the only thing on the right.
 */
export function HomeHeader({
  period,
  periods,
  isThisYear,
  onSelectPeriod,
}: HomeHeaderProps) {
  /* Mounted for the life of the header and only opened and closed, for the
     reason TransactionFilters gives: a sheet mounted by the press that opens it
     has not been laid out, and the first tap opens nothing. */
  const [isOpen, setIsOpen] = useState(false);

  const month = isThisYear ? formatPeriodMonth(period) : formatPeriodLong(period);

  return (
    <View className="flex-row items-center justify-between gap-3">
      {/* One child beside the inbox: the sheet's own root renders a View, and as
          a sibling it would collect a share of this row's gap. */}
      <View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${month}. Choose a month`}
          accessibilityState={{ expanded: isOpen }}
          hitSlop={6}
          onPress={() => setIsOpen(true)}
          className="min-h-8 flex-row items-center gap-1 self-start active:opacity-60">
          <Typography type="body" weight="semibold">
            {month}
          </Typography>
          <Icon icon={ChevronDown} color="foreground" size={18} />
        </Pressable>

        <MonthPickerSheet
          isOpen={isOpen}
          onOpenChange={setIsOpen}
          periods={periods}
          selected={period}
          onSelect={onSelectPeriod}
        />
      </View>

      <InboxButton />
    </View>
  );
}
