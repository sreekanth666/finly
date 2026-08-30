import { Typography } from 'heroui-native';
import { CircleAlert, CircleCheck, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Amount } from './amount';
import { Icon } from './icon';
import { Meter, type MeterTone } from './meter';

import type { CardStanding } from '@/features/accounts/hooks';
import type { UtilisationBand } from '@/domain/utilisation';
import { speakMinor } from '@/domain/money';
import type { AppColor } from '@/theme';

type UtilisationStatus = {
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
const STATUSES: Record<UtilisationBand, UtilisationStatus> = {
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

export function CardUtilisationList({ cards }: { cards: readonly CardStanding[] }) {
  return (
    <View className="gap-4 rounded-3xl bg-surface p-4">
      {cards.map((card, index) => {
        /* The band comes from domain/utilisation.ts now — the thresholds used to
           be magic numbers here, where nothing could test them. */
        const status = STATUSES[card.band];
        const percent = Math.round(card.utilisation * 100);

        return (
          <View
            key={card.id}
            /* The bar and the icon are both visual; the label carries the same
               information in words for a screen reader. */
            accessible
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: percent }}
            accessibilityLabel={`${card.name}: ${speakMinor(card.cycleSpendMinor)} of ${speakMinor(card.creditLimitMinor)} used, ${status.label}, ${card.daysToStatement} days to statement`}
            className={index === 0 ? 'gap-2.5' : 'gap-2.5 border-t border-border pt-4'}>
            <View className="flex-row items-center justify-between gap-3">
              <Typography type="body-sm" weight="semibold" className="flex-1" truncate>
                {card.name}
              </Typography>
              <Typography type="body-xs" color="muted">
                {card.daysToStatement === 1 ? '1 day to statement' : `${card.daysToStatement}d to statement`}
              </Typography>
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
                  value={card.cycleSpendMinor}
                  className="type-amount-sm text-foreground"
                  fractionClassName="type-amount-sm"
                  showFraction={false}
                />
                <Typography type="body-xs" color="muted">
                  of
                </Typography>
                <Amount
                  value={card.creditLimitMinor}
                  className="type-amount-sm text-muted"
                  showFraction={false}
                />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
