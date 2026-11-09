import { Typography } from 'heroui-native';
import { ArrowDownRight, ArrowUpRight, ChevronRight, Minus } from '@/components/icons';
import { Pressable, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Amount } from './amount';
import { Icon } from './icon';
import { SpendAreaChart } from './spend-area-chart';

import type { PeriodResult } from '@/domain/budget';
import { budgetUsage, healthStops, type HealthRole } from '@/domain/budget-health';
import { colorAtStops, mixColor } from '@/domain/color';
import {
  absMinor,
  asMinor,
  formatMinor,
  speakMinor,
  ZERO_MINOR,
  type Minor,
} from '@/domain/money';
import { formatPeriodMonth, formatPeriodShort, previousPeriod } from '@/domain/period';
import { splitSpend, type BudgetScope } from '@/domain/spend';
import type { SpendCurve } from '@/features/budget/hooks';
import { useAppColor } from '@/theme';

export type SpendOverviewCardProps = {
  period: PeriodResult;
  /** Null when the off-budget figure could not be read. */
  offBudgetMinor: Minor | null;
  /**
   * The chart's data. Undefined while it loads and null when it could not be
   * read: either way the card simply has no chart behind its figure, and since
   * the chart takes no space of its own, nothing moves when it arrives.
   */
  curve: SpendCurve | null | undefined;
  /** Whether the month on screen is the one being lived in. */
  isCurrent: boolean;
  /** Days left in the month on screen, today included. */
  daysLeft: number;
  /** Opens the feed narrowed to one side, for the month on screen. */
  onPressScope: (scope: BudgetScope) => void;
};

/**
 * Class strings are spelled out per direction and per side rather than built
 * from a template, so the CSS compiler can see every utility this renders.
 */
const DELTAS: Record<'less' | 'more' | 'same', { icon: typeof Minus }> = {
  less: { icon: ArrowDownRight },
  more: { icon: ArrowUpRight },
  same: { icon: Minus },
};

/**
 * Each side's name and its card's tint: a light, solid wash of the side's tone
 * over the canvas, spelled out so the CSS compiler sees both classes.
 */
const SIDES: Record<BudgetScope, { title: string; tint: string }> = {
  budget: { title: 'Budget', tint: 'bg-accent/15' },
  'off-budget': { title: 'Off budget', tint: 'bg-iris/15' },
};

/**
 * How far the health ground is pulled toward the app's ink at the two corners
 * of the hero card, mixed in RGB. The top-left corner is the ground itself; the
 * bottom-right is the darker, which is what gives the card its weight. 0.54
 * takes the "good" emerald to the deep forest the card has always ended on.
 */
const GRADIENT_START_INK = 0;
const GRADIENT_END_INK = 0.54;
const GRADIENT_ID = 'hero-gradient';

type HeroGradientProps = { from: string; to: string };

/**
 * The hero card's ground: a diagonal fade from its top-left to its bottom-right
 * corner. It fills the card and is clipped by the card's own rounded corners.
 * For the eye only.
 */
function HeroGradient({ from, to }: HeroGradientProps) {
  return (
    <View className="absolute inset-0" pointerEvents="none">
      <Svg width="100%" height="100%" importantForAccessibility="no-hide-descendants">
        <Defs>
          <LinearGradient id={GRADIENT_ID} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={from} />
            <Stop offset="1" stopColor={to} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${GRADIENT_ID})`} />
      </Svg>
    </View>
  );
}

type SpendHeroCardProps = Pick<
  SpendOverviewCardProps,
  'period' | 'curve' | 'isCurrent' | 'daysLeft'
>;

/**
 * What is left, and how worried to be about it: the card's hue is the share of
 * the limit already spent, blended smoothly from green through amber to red
 * (budget-health.ts), so the month's standing reads before any figure does.
 *
 * The ground is drawn deep, not bright: the theme's health tones, as a diagonal
 * gradient that darkens toward the app's ink, so green is a forest and red a
 * crimson, and everything on it is snow, the token for text on a fill. (Chalk,
 * the body text, falls just under AA on the lighter corner of the green.) The
 * lighter status tones are kept for the chart line, which stands out against it.
 */
function SpendHeroCard({ period, curve, isCurrent, daysLeft }: SpendHeroCardProps) {
  const [good, watch, over, success, warning, danger, ink, contrast] = useAppColor([
    'health-good',
    'health-watch',
    'health-over',
    'success',
    'warning',
    'danger',
    'background',
    'accent-foreground',
  ]);

  /* Two scales over the same stops: a deep one for the card's ground, and the
     light status tones for the chart line that has to stand out against it. */
  const grounds: Record<HealthRole, string> = { good, watch, over };
  const lines: Record<HealthRole, string> = { good: success, watch: warning, over: danger };
  const usage = period.isOverspent ? 1 : budgetUsage(period.spent, period.available);
  const ground = colorAtStops(
    healthStops.map((stop) => ({ at: stop.at, color: grounds[stop.role] })),
    usage,
  );
  const tint = colorAtStops(
    healthStops.map((stop) => ({ at: stop.at, color: lines[stop.role] })),
    usage,
  );
  const gradientFrom = mixColor(ground, ink, GRADIENT_START_INK);
  const gradientTo = mixColor(ground, ink, GRADIENT_END_INK);

  const remaining = absMinor(period.remaining);

  /*
   * P1: the design pass showed a total balance, upcoming bills and auto savings.
   * None of them had anything behind them — D4 excludes an income ledger and
   * account balances, and there is no bills or savings table. The daily figure
   * is derived from what the app actually knows, and answers the question the
   * plan says the home screen exists to answer.
   */
  const perDay =
    isCurrent && daysLeft > 0 && period.remaining > 0
      ? asMinor(Math.floor(period.remaining / daysLeft))
      : ZERO_MINOR;

  const available = formatMinor(period.available, { showFraction: false });
  /* Split so the amount can carry the weight: it is the one number on the card
     the user acts on today. */
  const paceAmount = perDay === 0 ? null : formatMinor(perDay, { showFraction: false });
  const paceRest = daysLeft === 1 ? 'for the last day' : `a day for ${daysLeft} days`;
  const pace = paceAmount === null ? null : `${paceAmount} ${paceRest}`;
  const paceShort = daysLeft === 1 ? 'last day' : `a day · ${daysLeft} days`;

  const monthName = formatPeriodMonth(period.period);
  const lastMonth = previousPeriod(period.period);
  const comparison = curve?.comparison;
  const delta = comparison?.deltaPercent == null ? null : DELTAS[comparison.direction];

  /* Last month with nothing spent is no line to compare against, only a flat
     one along the bottom that reads as "you spent nothing". */
  const hasLastMonth = curve?.previous.some((value) => value !== null && value > 0) ?? false;

  /* A month with nothing spent has no shape to draw, only a flat line that
     reads as a rule under the figure. */
  const hasSpend = curve?.current.some((value) => value !== null && value > 0) ?? false;

  const deltaLabel =
    comparison?.deltaPercent == null
      ? null
      : comparison.direction === 'same'
        ? `About the same as ${formatPeriodMonth(lastMonth)}`
        : `${comparison.deltaPercent}% ${comparison.direction} than ${formatPeriodMonth(lastMonth)}`;

  const chartLabel = (() => {
    if (curve === undefined || curve === null) return '';
    const spentSoFar = curve.current[curve.dayIndex] ?? ZERO_MINOR;
    const day = curve.dayIndex + 1;
    const base = `Spent ${speakMinor(spentSoFar)} by ${day} ${monthName}`;
    if (comparison?.deltaPercent == null) return `${base}.`;
    const against = `by ${day} ${formatPeriodMonth(lastMonth)}`;
    return comparison.direction === 'same'
      ? `${base}, about the same as ${against}.`
      : `${base}, ${comparison.deltaPercent}% ${comparison.direction} than ${against}.`;
  })();

  /* One reading for the whole card: its parts are short fragments that make
     little sense said one by one. */
  const summary = [
    period.isOverspent
      ? `Overspent by ${speakMinor(remaining)} of ${speakMinor(period.available)} available`
      : `${speakMinor(remaining)} left of ${speakMinor(period.available)}`,
    pace,
    period.carryOver > 0 ? `${speakMinor(period.carryOver)} carried in` : null,
    deltaLabel,
  ]
    .filter((part) => part !== null)
    .join('. ');

  return (
    <View
      accessible
      accessibilityLabel={`${summary}.`}
      className="relative z-10 overflow-hidden rounded-2xl"
      style={{ backgroundColor: gradientTo }}>
      <HeroGradient from={gradientFrom} to={gradientTo} />

      {/* The chart is this section's background: absolute along its bottom edge,
          so it needs no row of its own and the text above it is never moved. */}
      <View className="relative flex-row items-start justify-between gap-3 px-5 pb-6 pt-5">
        {curve != null && hasSpend && (
          <SpendAreaChart
            current={curve.current}
            previous={hasLastMonth ? curve.previous : null}
            dayIndex={curve.dayIndex}
            showToday={isCurrent}
            accessibilityLabel={chartLabel}
            color={tint}
            contrast={contrast}
          />
        )}

        <View className="flex-1 gap-1">
          <View className="flex-row items-baseline gap-2">
            <Amount
              value={remaining}
              className="type-balance text-accent-foreground"
              showFraction={false}
            />
            {period.isOverspent && (
              <Typography type="body" weight="semibold" className="text-accent-foreground">
                over
              </Typography>
            )}
          </View>
          <Typography type="body-sm" className="text-accent-foreground opacity-70">
            {period.isOverspent ? `over the ${available} available` : `left of ${available}`}
          </Typography>
          {/* §7.1: a carry-over line, but only when there is one. */}
          {period.carryOver > 0 && (
            <View className="mt-1 self-start rounded-full bg-accent-foreground/10 px-2.5 py-1">
              <Typography type="body-xs" className="text-accent-foreground">
                {`${formatMinor(period.carryOver, { showFraction: false })} carried in`}
              </Typography>
            </View>
          )}
        </View>

        {/* The right column was empty beside the figure: the comparison on top,
            and under it the daily allowance, the one number acted on today. */}
        <View className="items-end gap-3">
          {delta !== null && comparison?.deltaPercent != null && (
            <View className="flex-row items-center gap-1 rounded-full bg-accent-foreground/10 px-2.5 py-1">
              <Icon icon={delta.icon} color="accent-foreground" size={14} />
              <Typography type="body-xs" weight="semibold" className="text-accent-foreground">
                {comparison.direction === 'same'
                  ? `Same as ${formatPeriodShort(lastMonth)}`
                  : `${comparison.deltaPercent}% vs ${formatPeriodShort(lastMonth)}`}
              </Typography>
            </View>
          )}
          {paceAmount !== null && (
            <View className="items-end">
              <Typography className="type-amount-sm text-accent-foreground">{paceAmount}</Typography>
              <Typography type="body-xs" className="text-accent-foreground opacity-70">
                {paceShort}
              </Typography>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

type TotalLipProps = Pick<SpendOverviewCardProps, 'period' | 'offBudgetMinor' | 'isCurrent'>;

/**
 * The month's whole cost, on a band tucked under the hero card: as wide as it
 * is and square where it meets it, so the two read as one card with a base. The
 * hero card sits above it (z-10) and hides the overlap.
 *
 * Off-budget spending (D3) is deliberately outside the figure at the top, so
 * this is where the laptop and the groceries are finally seen together.
 */
function TotalLip({ period, offBudgetMinor, isCurrent }: TotalLipProps) {
  const { totalMinor } = splitSpend(period.spent, offBudgetMinor ?? ZERO_MINOR);

  return (
    <View className="-mt-4 flex-row items-center justify-between gap-3 rounded-b-2xl bg-surface-secondary px-4 pb-3 pt-6">
      <Typography type="body-sm" color="muted">
        {isCurrent ? 'Total spent this month' : `Total spent in ${formatPeriodMonth(period.period)}`}
      </Typography>
      {/* A failed read must not render as the budget figure alone — that is
          a total the user would believe. */}
      {offBudgetMinor === null ? (
        <Typography className="type-amount-sm text-foreground">—</Typography>
      ) : (
        <Amount
          value={totalMinor}
          className="type-amount-sm text-foreground"
          fractionClassName="type-amount-sm"
          showFraction={false}
        />
      )}
    </View>
  );
}

type ScopeCardProps = {
  scope: BudgetScope;
  /** Null when the figure could not be read. */
  amount: Minor | null;
  onPress: (scope: BudgetScope) => void;
};

/**
 * One side of the D3 split, a way into the expenses behind its figure. Its
 * side is told by a soft solid tint of its tone, not by a mark beside the label.
 */
function ScopeCard({ scope, amount, onPress }: ScopeCardProps) {
  const side = SIDES[scope];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        amount === null
          ? `${side.title}, could not be read. Show transactions`
          : `${side.title}, ${speakMinor(amount)} spent. Show transactions`
      }
      onPress={() => onPress(scope)}
      className={`flex-1 gap-1 rounded-2xl p-4 active:opacity-60 ${side.tint}`}>
      <View className="flex-row items-center gap-2">
        <Typography type="body-xs" color="muted" className="flex-1">
          {side.title}
        </Typography>
        <Icon icon={ChevronRight} color="muted" size={14} />
      </View>
      {amount === null ? (
        <Typography className="type-amount-sm text-foreground">—</Typography>
      ) : (
        <Amount
          value={amount}
          className="type-amount-sm text-foreground"
          fractionClassName="type-amount-sm"
          showFraction={false}
        />
      )}
    </Pressable>
  );
}

/**
 * The home screen's one answer, as a stack: what is left on a card tinted by
 * how much of the limit is gone, what the month has cost in total tucked under
 * it, and the two parts of that total as cards of their own.
 */
export function SpendOverviewCard({
  period,
  offBudgetMinor,
  curve,
  isCurrent,
  daysLeft,
  onPressScope,
}: SpendOverviewCardProps) {
  return (
    <View className="gap-3">
      <View>
        <SpendHeroCard period={period} curve={curve} isCurrent={isCurrent} daysLeft={daysLeft} />
        <TotalLip period={period} offBudgetMinor={offBudgetMinor} isCurrent={isCurrent} />
      </View>

      <View className="flex-row gap-3">
        <ScopeCard scope="budget" amount={period.spent} onPress={onPressScope} />
        <ScopeCard scope="off-budget" amount={offBudgetMinor} onPress={onPressScope} />
      </View>
    </View>
  );
}
