import { Typography } from 'heroui-native';
import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from './icon';

import { CURRENCIES, formatMinor, type Currency, type CurrencyCode } from '@/domain/money';
import { asMinor } from '@/domain/money';

const SAMPLE = asMinor(12405050);

export type CurrencyPickerProps = {
  selected: CurrencyCode;
  onSelect: (currency: Currency) => void;
};

/**
 * Picks the app's display currency, showing each option formatted as itself.
 *
 * The sample matters: grouping differs between them, and ₹1,24,050.50 beside
 * $124,050.50 makes that visible in a way a symbol on its own would not.
 */
export function CurrencyPicker({ selected, onSelect }: CurrencyPickerProps) {
  const options = Object.values(CURRENCIES);

  return (
    <View className="rounded-3xl bg-surface">
      {options.map((currency, index) => {
        const isSelected = currency.code === selected;

        return (
          <Pressable
            key={currency.code}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${currency.name}, shown as ${formatMinor(SAMPLE, { currency })}`}
            hitSlop={4}
            onPress={() => onSelect(currency)}
            className={
              index === 0
                ? 'flex-row items-center gap-3 px-4 py-3.5 active:opacity-60'
                : 'flex-row items-center gap-3 border-t border-border px-4 py-3.5 active:opacity-60'
            }>
            <View className="w-10">
              <Typography type="body-sm" weight="semibold">
                {currency.code}
              </Typography>
            </View>

            <View className="flex-1 gap-0.5">
              <Typography type="body-sm" weight="medium" truncate>
                {currency.name}
              </Typography>
              <Typography type="body-xs" color="muted">
                {formatMinor(SAMPLE, { currency })}
              </Typography>
            </View>

            {isSelected && <Icon icon={Check} color="accent" size={16} />}
          </Pressable>
        );
      })}
    </View>
  );
}
