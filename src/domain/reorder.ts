/**
 * List reordering, shared by the accounts and categories screens so the
 * ordering rules exist in one place.
 */

/** Direction of travel: -1 moves an item earlier, 1 moves it later. */
export type MoveDirection = -1 | 1;

/**
 * A new list with the item at `index` swapped one place in `direction`. Moving
 * the first item earlier — or the last one later — returns the list unchanged
 * rather than wrapping, so a button at either end is simply inert.
 */
export function moveItem<T>(items: T[], index: number, direction: MoveDirection): T[] {
  const target = index + direction;

  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return items;
  }

  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];

  return next;
}

/** True when the item can't travel any further in that direction. */
export const isAtEdge = (items: unknown[], index: number, direction: MoveDirection) =>
  index + direction < 0 || index + direction >= items.length;
