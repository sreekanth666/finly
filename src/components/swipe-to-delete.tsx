import { Typography } from 'heroui-native';
import { Trash2 } from 'lucide-react-native';
import { useRef, type ReactNode } from 'react';
import { View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';

import { Icon } from './icon';

export type SwipeToDeleteProps = {
  children: ReactNode;
  /** Announced to a screen reader, which cannot swipe. */
  accessibilityLabel: string;
  onDelete: () => void;
};

/**
 * Swipe left to delete, per §7.3.
 *
 * The row closes itself immediately after firing rather than staying open. The
 * delete is a soft one and the list refetches from underneath, so leaving the
 * action pane open would show it attached to whichever row slid up into that
 * position.
 *
 * A swipe is invisible to assistive technology, so the action is also exposed as
 * an accessibility action.
 */
export function SwipeToDelete({ children, accessibilityLabel, onDelete }: SwipeToDeleteProps) {
  const ref = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={ref}
      friction={2}
      rightThreshold={48}
      overshootRight={false}
      onSwipeableOpen={(direction) => {
        if (direction !== 'right') return;
        ref.current?.close();
        onDelete();
      }}
      renderRightActions={() => (
        <View className="my-1 ml-2 w-24 items-center justify-center rounded-2xl bg-danger">
          <Icon icon={Trash2} color="danger-foreground" size={16} />
          <Typography type="body-xs" weight="semibold" className="text-danger-foreground">
            Delete
          </Typography>
        </View>
      )}>
      <View
        accessibilityActions={[{ name: 'delete', label: 'Delete' }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === 'delete') onDelete();
        }}
        accessibilityLabel={accessibilityLabel}>
        {children}
      </View>
    </Swipeable>
  );
}
