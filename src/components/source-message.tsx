import { Typography } from 'heroui-native';
import { MessageSquareText } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from './icon';

export type SourceMessageProps = {
  /** `sourceTextOf`'s output: one line of where and when, then the message. */
  text: string;
  /** Open from the start, for a screen whose whole point is the message. */
  initiallyOpen?: boolean;
};

/**
 * The payment alert an expense was confirmed from (D17), kept verbatim.
 *
 * Collapsed to its first lines by default — it is a reference, not the record —
 * and selectable when open, so a reference number can be copied out with a long
 * press and no clipboard dependency.
 */
export function SourceMessage({ text, initiallyOpen = false }: SourceMessageProps) {
  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const newline = text.indexOf('\n');
  const header = newline === -1 ? null : text.slice(0, newline);
  const body = newline === -1 ? text : text.slice(newline + 1);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ expanded: isOpen }}
      accessibilityLabel={isOpen ? 'Original message, shown' : 'Original message, tap to show'}
      onPress={() => setIsOpen((current) => !current)}
      className="gap-2 rounded-2xl bg-surface px-4 py-3 active:opacity-80">
      <View className="flex-row items-center gap-2">
        <Icon icon={MessageSquareText} color="muted" size={14} />
        <Typography type="body-xs" color="muted" className="flex-1" truncate>
          {header ?? 'Original message'}
        </Typography>
        <Typography type="body-xs" className="text-link">
          {isOpen ? 'Hide' : 'Show'}
        </Typography>
      </View>
      <Typography
        type="body-sm"
        selectable={isOpen}
        numberOfLines={isOpen ? undefined : 2}>
        {body}
      </Typography>
    </Pressable>
  );
}
