import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Height of the floating pill, border included. */
export const FLOATING_BAR_HEIGHT = 64;
/** Space between the pill and the bottom safe-area edge. */
export const FLOATING_BAR_GAP = 12;
/** Extra room so the last item of a list scrolls clear of the pill. */
const FLOATING_BAR_AIR = 24;

/**
 * Where the top of the floating tab bar sits above the bottom of the screen.
 * Anything pinned above it (the undo toast) adds its own gap to this.
 */
export function useFloatingBarTop(): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + FLOATING_BAR_GAP + FLOATING_BAR_HEIGHT;
}

/**
 * The bottom padding every tab's scroller needs. The bar floats over the tab
 * content instead of sitting under it, so without this the last row ends up
 * hidden behind the pill.
 */
export function useFloatingBarClearance(): number {
  return useFloatingBarTop() + FLOATING_BAR_AIR;
}
