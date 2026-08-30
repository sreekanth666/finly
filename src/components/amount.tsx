import { Typography } from 'heroui-native';
import { Text } from 'react-native';

import { formatMinorParts, speakMinor, type Minor, type MoneySign } from '@/domain/money';

export type AmountProps = {
  /** Integer paise. Never a rupee float — see domain/money.ts. */
  value: Minor;
  /**
   * Overrides the default `.type-amount` style. Pass one of the money classes
   * from theme/typography.css (`type-balance`, `type-metric`) plus a color —
   * Tailwind's `font-*` weights do nothing here, since weight is selected by
   * font family.
   */
  className?: string;
  /**
   * Overrides the default `.type-amount-cents` style. Leave the color out — the
   * paise inherit it from the parent so they can't drift from the amount they
   * belong to.
   */
  fractionClassName?: string;
  /** `always` renders a leading + for positive values, e.g. money returning. */
  sign?: MoneySign;
  /** Whole-rupee figures in the design drop the paise entirely. */
  showFraction?: boolean;
};

/**
 * Currency with the paise set a step smaller, as in the mockups:
 * `₹1,24,050` at full size followed by a smaller `.50`.
 *
 * The two `Text` nodes would otherwise be read out as two separate utterances,
 * so the whole figure is also spelled out for a screen reader.
 */
export function Amount({
  value,
  className = 'type-amount',
  fractionClassName = 'type-amount-cents',
  sign = 'negative',
  showFraction = true,
}: AmountProps) {
  const parts = formatMinorParts(value, { sign, showFraction });

  return (
    <Typography className={className} accessibilityLabel={speakMinor(value)}>
      {`${parts.sign}${parts.symbol}${parts.whole}`}
      {showFraction && <Text className={fractionClassName}>{`.${parts.fraction}`}</Text>}
    </Typography>
  );
}
