/**
 * Constrains a bottom sheet's drag to the vertical axis.
 *
 * gorhom wraps every sheet body in a `Gesture.Pan()` with no offsets
 * configured (`BottomSheetDraggableView`), and an unconstrained pan claims a
 * drag in *any* direction. A plain React Native `ScrollView` is not part of the
 * gesture-handler arena, so it loses that race every time and never scrolls —
 * which is why the horizontal chip rows inside a sheet sat dead while the same
 * component scrolls fine on a screen, where nothing competes for the gesture.
 *
 * `activeOffsetY` makes the sheet wait for vertical movement before it claims
 * anything; `failOffsetX` makes it give up once the finger has committed
 * sideways. The window is wide enough that a thumb dragging the sheet down is
 * never mistaken for a sideways swipe.
 *
 * gorhom shares these props between the content pan and the handle pan, so the
 * handle also stops responding to a mostly-horizontal drag. That is the right
 * behaviour for a handle anyway.
 */
export const VERTICAL_ONLY_PAN: {
  activeOffsetY: [start: number, end: number];
  failOffsetX: [start: number, end: number];
} = {
  activeOffsetY: [-5, 5],
  failOffsetX: [-15, 15],
};
