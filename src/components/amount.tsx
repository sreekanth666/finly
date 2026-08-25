import { Typography } from 'heroui-native';
import { Text } from 'react-native';

export type AmountProps = {
  value: number;
  /**
   * Overrides the default `.type-amount` style. Pass one of the money classes
   * from theme/typography.css (`type-balance`, `type-metric`) plus a color —
   * Tailwind's `font-*` weights do nothing here, since weight is selected by
   * font family.
   */
  className?: string;
  /**
   * Overrides the default `.type-amount-cents` style. Leave the color out — the
   * cents inherit it from the parent so they can't drift from the amount they
   * belong to.
   */
  centsClassName?: string;
  /** Render a leading + for positive values (used by transaction rows). */
  signed?: boolean;
  /** Whole-dollar figures in the design drop the cents entirely. */
  showCents?: boolean;
};

const groupThousands = (whole: string) => whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/**
 * Currency with the cents set a step smaller, as in the mockups:
 * `$1,280` at full size followed by a smaller `.29`.
 */
export function Amount({
  value,
  className = 'type-amount',
  centsClassName = 'type-amount-cents',
  signed = false,
  showCents = true,
}: AmountProps) {
  const [whole, cents] = Math.abs(value).toFixed(2).split('.');
  const sign = value < 0 ? '-' : signed ? '+' : '';

  return (
    <Typography className={className}>
      {`${sign}$${groupThousands(whole!)}`}
      {showCents && <Text className={centsClassName}>{`.${cents}`}</Text>}
    </Typography>
  );
}
