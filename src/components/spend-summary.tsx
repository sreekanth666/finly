import { Typography } from 'heroui-native';
import { ChevronRight } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Amount } from './amount';
import { Icon } from './icon';

import { speakMinor, ZERO_MINOR, type Minor } from '@/domain/money';
import { splitSpend, type BudgetScope } from '@/domain/spend';
import type { AppColor } from '@/theme';

export type SpendSummaryProps = {
  /** What the month spent against the budget — the ring's own `spent`. */
  budgetMinor: Minor;
  /** Null when the off-budget figure could not be read. */
  offBudgetMinor: Minor | null;
  /** Opens the feed narrowed to one side, for the month on screen. */
  onPressScope: (scope: BudgetScope) => void;
};

/**
 * Class strings are spelled out per side rather than built from a template, so
 * the CSS compiler can see every utility this component can render.
 */
const SIDES: Record<
  BudgetScope,
  { title: string; card: string; fill: string; text: string; icon: AppColor }
> = {
  budget: {
    title: 'Budget',
    card: 'bg-accent',
    fill: 'bg-accent',
    text: 'text-accent-foreground',
    icon: 'accent-foreground',
  },
  'off-budget': {
    title: 'Off budget',
    card: 'bg-iris',
    fill: 'bg-iris',
    text: 'text-iris-foreground',
    icon: 'iris-foreground',
  },
};

/**
 * Everything the month cost, and the two parts it is made of.
 *
 * The ring answers "how much of the budget is left", which by design ignores
 * anything marked not to count (D3). That left no figure anywhere for what was
 * actually spent — the laptop and the groceries together. This is that figure,
 * with each part a way into the expenses behind it.
 */
export function SpendSummary({ budgetMinor, offBudgetMinor, onPressScope }: SpendSummaryProps) {
  const { totalMinor, budgetShare } = splitSpend(budgetMinor, offBudgetMinor ?? ZERO_MINOR);
  const isUnavailable = offBudgetMinor === null;

  const half = (scope: BudgetScope, amount: Minor | null) => {
    const side = SIDES[scope];

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          amount === null
            ? `${side.title}, could not be read. Show transactions`
            : `${side.title}, ${speakMinor(amount)} spent. Show transactions`
        }
        onPress={() => onPressScope(scope)}
        className={`flex-1 gap-4 rounded-2xl p-3.5 active:opacity-60 ${side.card}`}>
        <View className="flex-row items-center justify-between gap-2">
          <Typography type="body-sm" weight="semibold" className={`flex-1 ${side.text}`}>
            {side.title}
          </Typography>
          <Icon icon={ChevronRight} color={side.icon} size={16} />
        </View>
        {amount === null ? (
          <Typography className={`type-amount ${side.text}`}>—</Typography>
        ) : (
          <Amount value={amount} className={`type-amount ${side.text}`} />
        )}
      </Pressable>
    );
  };

  return (
    <View className="gap-4 rounded-3xl bg-surface p-4">
      <View className="gap-1">
        <Typography type="body-sm" color="muted">
          Total spent
        </Typography>
        {/* A failed read must not render as the budget figure alone — that is a
            total the user would believe. */}
        {isUnavailable ? (
          <Typography className="type-metric text-foreground">—</Typography>
        ) : (
          <Amount value={totalMinor} className="type-metric text-foreground" />
        )}
      </View>

      {/* The halves below carry both numbers, so the bar is for the eye only. */}
      {!isUnavailable && totalMinor > 0 && (
        <View
          className="h-2 flex-row overflow-hidden rounded-full bg-surface-secondary"
          accessible={false}
          importantForAccessibility="no-hide-descendants">
          <View className={`h-full ${SIDES.budget.fill}`} style={{ width: `${budgetShare * 100}%` }} />
          <View className={`h-full flex-1 ${SIDES['off-budget'].fill}`} />
        </View>
      )}

      <View className="flex-row gap-3">
        {half('budget', budgetMinor)}
        {half('off-budget', offBudgetMinor)}
      </View>
    </View>
  );
}
