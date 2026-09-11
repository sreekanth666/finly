import { Typography } from 'heroui-native';
import type { Ref } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { acceptEntry } from '@/domain/amount-entry';
import { getActiveCurrency } from '@/domain/money';

/** Spelled out per state so the compiler sees both. */
const SYMBOL = {
  empty: 'type-metric text-muted',
  filled: 'type-metric text-foreground',
} as const;

/* Android pads an EditText for its font's ascenders unless told not to, which
   pushes a metric-sized figure off the symbol's baseline. */
const INPUT_STYLE = { includeFontPadding: false, textAlignVertical: 'center' } as const;

export type AmountInputProps = {
  /** The entry, as `acceptEntry` last left it. */
  value: string;
  onChangeValue: (entry: string) => void;
  accessibilityLabel: string;
  ref?: Ref<TextInput>;
} & Pick<TextInputProps, 'autoFocus' | 'onFocus' | 'onBlur'>;

/**
 * The amount, typed on the system number pad.
 *
 * This replaced an in-app keypad that could only append. A pre-filled amount
 * there was dead until it had been backspaced away; here the whole value is
 * selected on focus, so the first key replaces it.
 *
 * The field shows plain digits while typing. Regrouping "124050" into
 * "1,24,050" under the caret makes the caret jump on Android — grouping is for
 * everywhere the amount is read, not the one place it is written.
 */
export function AmountInput({
  value,
  onChangeValue,
  accessibilityLabel,
  ref,
  autoFocus,
  onFocus,
  onBlur,
}: AmountInputProps) {
  return (
    <View className="flex-row items-center justify-center">
      <Typography className={value.length > 0 ? SYMBOL.filled : SYMBOL.empty}>
        {getActiveCurrency().symbol}
      </Typography>
      <TextInput
        ref={ref}
        className="type-metric min-w-12 p-0 text-foreground"
        style={INPUT_STYLE}
        value={value}
        onChangeText={(typed) => onChangeValue(acceptEntry(value, typed))}
        placeholder="0"
        placeholderTextColorClassName="accent-muted"
        selectionColorClassName="accent-accent"
        cursorColorClassName="accent-accent"
        keyboardType="decimal-pad"
        selectTextOnFocus
        autoFocus={autoFocus}
        onFocus={onFocus}
        onBlur={onBlur}
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );
}
