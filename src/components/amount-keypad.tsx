import { Typography } from 'heroui-native';
import { Delete } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon } from './icon';

import type { KeypadKey } from '@/domain/amount-entry';

const ROWS: KeypadKey[][] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
];

export type AmountKeypadProps = {
  onKeyPress: (key: KeypadKey) => void;
};

/**
 * The in-app keypad. The OS numeric keyboard would do the job, but it puts the
 * digits in a different place on every device and steals the bottom of the
 * screen from the fields below — an amount-first flow can afford neither.
 */
export function AmountKeypad({ onKeyPress }: AmountKeypadProps) {
  return (
    <View className="gap-1">
      {ROWS.map((row) => (
        <View key={row.join('')} className="flex-row gap-1">
          {row.map((key) => (
            <Pressable
              key={key}
              accessibilityRole="button"
              accessibilityLabel={key === 'backspace' ? 'Delete' : key}
              onPress={() => onKeyPress(key)}
              className="h-14 flex-1 items-center justify-center rounded-2xl active:bg-surface-secondary">
              {key === 'backspace' ? (
                <Icon icon={Delete} color="muted" size={22} />
              ) : (
                <Typography type="h5" weight="medium">
                  {key}
                </Typography>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}
