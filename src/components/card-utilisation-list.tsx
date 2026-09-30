import { Typography } from 'heroui-native';
import {
  ChevronRight,
  CircleAlert,
  CircleCheck,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Amount } from './amount';
import { Icon } from './icon';
import { Meter, type MeterTone } from './meter';

import type { CardStanding } from '@/features/accounts/hooks';
import type { UtilisationBand } from '@/domain/utilisation';
import { absMinor, speakMinor } from '@/domain/money';
import type { AppColor } from '@/theme';

export type UtilisationStatus = {
  meter: MeterTone;
  icon: LucideIcon;
  iconTone: AppColor;
  text: string;
  label: string;
};

/**
 * Utilisation is a status, so it ships with an icon and a word — never the bar
 * colour on its own. Class strings are spelled out per state.
 */
export const UTILISATION_STATUSES: Record<UtilisationBand, UtilisationStatus> = {
  healthy: {
    meter: 'accent',
    icon: CircleCheck,
    iconTone: 'accent',
    text: 'text-muted',
    label: 'Comfortable',
  },
  high: {
    meter: 'warning',
    icon: TriangleAlert,
    iconTone: 'warning',
    text: 'text-warning',
    label: 'High usage',
  },
  critical: {
    meter: 'danger',
    icon: CircleAlert,
    iconTone: 'danger',
    text: 'text-danger',
    label: 'Near limit',
  },
};

/**
 * Class strings spelled out per position and per whether the row opens its
 * card, so the CSS compiler sees every one.
 */
const ROWS = {
  first: 'gap-2.5',
  rest: 'gap-2.5 border-t border-border pt-4',
  firstPressable: 'gap-2.5 active:opacity-60',
  restPressable: 'gap-2.5 border-t border-border pt-4 active:opacity-60',
} as const;

export type CardUtilisationListProps = {
  cards: readonly CardStanding[];
  /** Opens a card. Without it the rows are figures only. */
  onPressCard?: (id: string) => void;
};

/** "₹15,200 owed" for a tracked card (D20), "₹24,000" of cycle spend otherwise. */
const spokenUse = (card: CardStanding): string =>
  card.owedMinor === null
    ? `${speakMinor(card.cycleSpendMinor)} of ${speakMinor(card.creditLimitMinor)} spent this cycle`
    : card.owedMinor < 0
      ? `${speakMinor(absMinor(card.owedMinor))} in credit, ${speakMinor(card.creditLimitMinor)} limit`
      : `${speakMinor(card.owedMinor)} owed of ${speakMinor(card.creditLimitMinor)}`;

export function CardUtilisationList({ cards, onPressCard }: CardUtilisationListProps) {
  return (
    <View className="gap-4 rounded-3xl bg-surface p-4">
      {cards.map((card, index) => {
        /* The band comes from domain/utilisation.ts now — the thresholds used to
           be magic numbers here, where nothing could test them. */
        const status = UTILISATION_STATUSES[card.band];
        const percent = Math.round(card.utilisation * 100);
        const isFirst = index === 0;
        const label = `${card.name}: ${spokenUse(card)}, ${status.label}, ${card.daysToStatement} days to statement`;

        const content = (
          <>
            <View className="flex-row items-center justify-between gap-3">
              <Typography type="body-sm" weight="semibold" className="flex-1" truncate>
                {card.name}
              </Typography>
              <Typography type="body-xs" color="muted">
                {card.daysToStatement === 1 ? '1 day to statement' : `${card.daysToStatement}d to statement`}
              </Typography>
              {onPressCard !== undefined && <Icon icon={ChevronRight} color="muted" size={14} />}
            </View>

            <Meter progress={card.utilisation} tone={status.meter} />

            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-row items-center gap-1.5">
                <Icon icon={status.icon} color={status.iconTone} size={12} />
                <Typography type="body-xs" className={status.text}>
                  {`${status.label} · ${percent}%`}
                </Typography>
              </View>

              <View className="flex-row items-center gap-1">
                <Amount
                  value={card.owedMinor === null ? card.cycleSpendMinor : absMinor(card.owedMinor)}
                  className="type-amount-sm text-foreground"
                  fractionClassName="type-amount-sm"
                  showFraction={false}
                />
                <Typography type="body-xs" color="muted">
                  {card.owedMinor === null ? 'of' : card.owedMinor < 0 ? 'in credit ·' : 'owed of'}
                </Typography>
                <Amount
                  value={card.creditLimitMinor}
                  className="type-amount-sm text-muted"
                  showFraction={false}
                />
              </View>
            </View>
          </>
        );

        /* The bar and the icon are both visual; the label carries the same
           information in words for a screen reader. */
        return onPressCard === undefined ? (
          <View
            key={card.id}
            accessible
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: percent }}
            accessibilityLabel={label}
            className={isFirst ? ROWS.first : ROWS.rest}>
            {content}
          </View>
        ) : (
          <Pressable
            key={card.id}
            accessibilityRole="button"
            accessibilityLabel={`${label}. Open card`}
            onPress={() => onPressCard(card.id)}
            className={isFirst ? ROWS.firstPressable : ROWS.restPressable}>
            {content}
          </Pressable>
        );
      })}
    </View>
  );
}
