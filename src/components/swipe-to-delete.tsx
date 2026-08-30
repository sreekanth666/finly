import { Typography } from 'heroui-native';
import { Trash2 } from 'lucide-react-native';
import { useRef, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';

import { Icon } from './icon';

export type SwipeToDeleteProps = {
  children: ReactNode;
  /** Announced to a screen reader, which cannot swipe. */
  accessibilityLabel: string;
  onDelete: () => void;
};

/**
 * Swipe left to reveal Delete, per §7.3.
 *
 * The swipe uncovers the button; the button is what deletes. Opening used to
 * delete on its own, which made the pane a label rather than a control and put
 * a destructive, irreversible-looking action behind a gesture that is easy to
 * make by accident while scrolling a list.
 *
 * The row closes itself as the delete fires rather than staying open. The
 * delete is a soft one and the list refetches from underneath, so leaving the
 * pane open would show it attached to whichever row slid up into that position.
 *
 * A swipe is invisible to assistive technology, so the action is also exposed as
 * an accessibility action.
 */
export function SwipeToDelete({ children, accessibilityLabel, onDelete }: SwipeToDeleteProps) {
  const ref = useRef<Swipeable>(null);

  return (
    <Swipeable
      ref={ref}
      /* 1:1 with the finger. At 2 the row travelled half the distance of the
         gesture, which reads as the list resisting rather than responding. */
      friction={1}
      rightThreshold={48}
      overshootRight={false}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Delete ${accessibilityLabel}`}
          onPress={() => {
            ref.current?.close();
            onDelete();
          }}
          className="my-1 ml-2 w-24 items-center justify-center rounded-2xl bg-danger active:opacity-60">
          <Icon icon={Trash2} color="danger-foreground" size={16} />
          <Typography type="body-xs" weight="semibold" className="text-danger-foreground">
            Delete
          </Typography>
        </Pressable>
      )}>
      <View
        /* Opaque, and that is load-bearing.
         *
         * Swipeable renders the action pane as an absolute fill and then
         * translates this layer across it, so the pane is always *behind* the
         * row rather than beside it. A transparent row therefore shows the red
         * of the Delete button straight through its own item and amount from
         * the first pixel of the drag, instead of the row sliding away to
         * uncover it. The sliding layer has to paint, and that is this
         * component's business rather than every row's. */
        className="bg-background"
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
