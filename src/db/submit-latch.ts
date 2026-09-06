/**
 * A one-shot guard for an action the user can only mean once.
 *
 * `useAction` already refuses a second call while the first is in flight, and
 * that guard is worth nothing here: every repository write is synchronous.
 * `writeTransaction` goes through drizzle's `executeSync`, so `await` on a save
 * resolves on the very next microtask and the in-flight window is a fraction of
 * a millisecond inside one JS tick. A double tap arrives a couple of hundred
 * milliseconds later, finds nothing in flight, and saves again — a second row
 * with a fresh id that no unique constraint will collapse, plus a second
 * `router.back()` that pops a screen nobody asked to leave.
 *
 * The window that matters is not "while the write runs" but "after it has
 * already succeeded", which lasts until the screen is gone — the whole pop
 * animation, during which the button is still on screen and still accepting
 * touches. So the latch closes on the way in and stays closed on success.
 *
 * Failure reopens it, because a save that did not happen must be retryable, and
 * `reset` reopens it for the surfaces that are legitimately repeatable — a sheet
 * that closes while its screen stays put, a form that clears itself for the next
 * entry.
 *
 * Deliberately plain: no React, no database, no clock. That is what lets it be
 * tested, since the hooks that wrap it cannot be.
 */
export type SubmitLatch = {
  /**
   * Runs `body` unless the latch is already closed. `body` reports whether the
   * thing actually happened: `false` reopens the latch for another attempt.
   * Returns whether `body` ran to a settled result.
   */
  run: (body: () => Promise<boolean> | boolean) => Promise<boolean>;
  /** Reopens the latch for a surface that is meant to be used again. */
  reset: () => void;
  readonly isLatched: boolean;
};

export function createSubmitLatch(): SubmitLatch {
  let latched = false;

  return {
    async run(body) {
      if (latched) return false;
      latched = true;
      try {
        const settled = await body();
        if (!settled) latched = false;
        return settled;
      } catch (cause) {
        /* A throw is a save that did not land, so it must be retryable. The
           error still belongs to the caller. */
        latched = false;
        throw cause;
      }
    },
    reset() {
      latched = false;
    },
    get isLatched() {
      return latched;
    },
  };
}
