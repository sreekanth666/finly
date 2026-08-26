import { Typography } from 'heroui-native';
import { CircleAlert, CircleCheck, TriangleAlert, type LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { Amount } from './amount';
import { Icon } from './icon';
import { Meter, type MeterTone } from './meter';

import type { CardUtilisation } from '@/data/insights';
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
const STATUSES: Record<'healthy' | 'high' | 'critical', UtilisationStatus> = {
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

const toStatus = (utilisation: number) => {
  if (utilisation >= 0.85) return STATUSES.critical;
  if (utilisation >= 0.6) return STATUSES.high;

  return STATUSES.healthy;
};

export function CardUtilisationList({ cards }: { cards: CardUtilisation[] }) {
  return (
    <View className="gap-4 rounded-3xl bg-surface p-4">
      {cards.map((card, index) => {
        const utilisation = card.creditLimit > 0 ? card.cycleSpend / card.creditLimit : 0;
        const status = toStatus(utilisation);

        return (
          <View
            key={card.id}
            className={index === 0 ? 'gap-2.5' : 'gap-2.5 border-t border-border pt-4'}>
            <View className="flex-row items-center justify-between gap-3">
              <Typography type="body-sm" weight="semibold" className="flex-1" truncate>
                {card.name}
              </Typography>
              <Typography type="body-xs" color="muted">
                {card.daysToStatement}d to statement
              </Typography>
            </View>

            <Meter progress={utilisation} tone={status.meter} />

            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-row items-center gap-1.5">
                <Icon icon={status.icon} color={status.iconTone} size={12} />
                <Typography type="body-xs" className={status.text}>
                  {`${status.label} · ${Math.round(utilisation * 100)}%`}
                </Typography>
              </View>

              <View className="flex-row items-center gap-1">
                <Amount
                  value={card.cycleSpend}
                  className="type-amount-sm text-foreground"
                  centsClassName="type-amount-sm"
                  showCents={false}
                />
                <Typography type="body-xs" color="muted">
                  of
                </Typography>
                <Amount value={card.creditLimit} className="type-amount-sm text-muted" showCents={false} />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}
