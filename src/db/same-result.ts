/**
 * Whether two query results hold the same data.
 *
 * useDbQuery re-reads whenever a watched table is written, and most writes do
 * not change what a given screen shows. Keeping the previous result when the
 * new one matches it is what stops every write from re-rendering every screen.
 * Results are rows of plain values, so a structural walk is enough; anything
 * that is not a plain object, array, date or error compares by reference.
 *
 * Kept free of expo-sqlite so the node test suite can load it.
 */
export function sameResult(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((value, index) => sameResult(value, b[index]));
  }

  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }

  /* A query that keeps failing the same way should not re-render each time. */
  if (a instanceof Error || b instanceof Error) {
    return a instanceof Error && b instanceof Error && a.message === b.message;
  }

  if (Object.getPrototypeOf(a) !== Object.prototype || Object.getPrototypeOf(b) !== Object.prototype) {
    return false;
  }

  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  return keys.every(
    (key) =>
      Object.hasOwn(b, key) &&
      sameResult((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
  );
}
