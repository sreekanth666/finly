import { Typography } from 'heroui-native';
import { Undo2 } from 'lucide-react-native';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';

import { Icon } from './icon';

export type UndoToastProps = {
  message: string;
  /** Called when the window closes without the user undoing. */
  onExpire: () => void;
  onUndo: () => void;
  /** How long the offer stands. */
  durationMs?: number;
};

const DEFAULT_DURATION = 6000;

/**
 * The offer to take a deletion back.
 *
 * Soft delete is what makes this nearly free — the row is still there, so undo
 * is a single flag flip rather than a re-insert with a new id that would break
 * every reference to it.
 *
 * The toast is deliberately not a confirmation dialog. Deleting one expense is
 * not worth a modal, and a dialog before every delete is worse than an undo
 * after the rare wrong one.
 */
export function UndoToast({
  message,
  onExpire,
  onUndo,
  durationMs = DEFAULT_DURATION,
}: UndoToastProps) {
  useEffect(() => {
    const timer = setTimeout(onExpire, durationMs);
    return () => clearTimeout(timer);
    // Re-arms whenever the message changes, so a second delete during the first
    // window gets its own full window rather than inheriting the remainder.
  }, [message, durationMs, onExpire]);

  return (
    <View
      accessibilityRole="alert"
      className="mx-5 mb-4 flex-row items-center gap-3 rounded-2xl bg-surface-secondary px-4 py-3">
      <Typography type="body-sm" className="flex-1" truncate>
        {message}
      </Typography>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Undo delete"
        hitSlop={8}
        onPress={onUndo}
        className="flex-row items-center gap-1.5 active:opacity-60">
        <Icon icon={Undo2} color="accent" size={14} />
        <Typography type="body-sm" weight="semibold" className="text-accent">
          Undo
        </Typography>
      </Pressable>
    </View>
  );
}
