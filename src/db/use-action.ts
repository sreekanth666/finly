/**
 * Writes, from a screen's point of view.
 *
 * Every editor in the design pass navigated back the instant Save was pressed,
 * unconditionally — there was nothing to fail. Now there is: a settlement can
 * exceed its expense, an account can still be in use, a disk can be full. This
 * hook gives a button the three things it needs to behave honestly: whether the
 * write is in flight, what went wrong, and a promise that only resolves when the
 * write actually landed.
 */

import { useCallback, useRef, useState } from 'react';

import { scheduleCarryOverFlush } from './carry-over';
import { RepositoryError, toError } from './errors';

/**
 * Deliberately not `Result | undefined`. Half the repository writes return void,
 * so an undefined result would be indistinguishable from a failure and a screen
 * would never navigate away after a successful save.
 */
export type ActionOutcome<Result> =
  | { ok: true; value: Result }
  | { ok: false; error: Error };

export type ActionState<Args extends unknown[], Result> = {
  run: (...args: Args) => Promise<ActionOutcome<Result>>;
  isPending: boolean;
  error: Error | null;
  /** What to put in front of the user. Falls back to a generic line. */
  errorMessage: string | null;
  reset: () => void;
};

export function useAction<Args extends unknown[], Result>(
  action: (...args: Args) => Promise<Result> | Result,
): ActionState<Args, Result> {
  const actionRef = useRef(action);
  actionRef.current = action;

  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  // Guards the double tap. A disabled prop lands a frame too late to rely on.
  const inFlight = useRef(false);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  const run = useCallback(async (...args: Args): Promise<ActionOutcome<Result>> => {
    // A disabled prop lands a frame too late to stop a determined double tap.
    if (inFlight.current) {
      return { ok: false, error: new Error('Already saving.') };
    }
    inFlight.current = true;
    setIsPending(true);
    setError(null);

    try {
      const value = await actionRef.current(...args);
      /* Any write may have moved a month's totals. Cheap when nothing is
         dirty — the flush returns immediately. */
      scheduleCarryOverFlush();
      return { ok: true, value };
    } catch (cause) {
      const failure = toError(cause);
      setError(failure);
      return { ok: false, error: failure };
    } finally {
      inFlight.current = false;
      setIsPending(false);
    }
  }, []);

  const errorMessage =
    error === null
      ? null
      : error instanceof RepositoryError
        ? error.userMessage
        : 'Something went wrong and nothing was saved.';

  return { run, isPending, error, errorMessage, reset };
}
