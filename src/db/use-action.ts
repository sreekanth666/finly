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
import { createSubmitLatch } from './submit-latch';

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
  /* Collapses calls that genuinely overlap — an async export, a restore. It is
     not the double-tap guard it was once described as: the repository writes are
     synchronous, so for those this is only ever true inside a single tick. See
     `useSubmitOnce` below, and the note on `src/db/submit-latch.ts`. */
  const inFlight = useRef(false);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  const run = useCallback(async (...args: Args): Promise<ActionOutcome<Result>> => {
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

export type SubmitOnce<Args extends unknown[]> = {
  /** Safe to wire straight to `onPress`. Later taps are simply nothing. */
  submit: (...args: Args) => Promise<void>;
  /** Arms it again, for a surface the user is meant to use more than once. */
  reset: () => void;
};

/**
 * Wraps a whole save-and-leave handler so it happens once, however many times
 * the button is pressed.
 *
 * The guard has to sit out here rather than inside `useAction`, for two reasons.
 * The write and the navigation that follows it are one indivisible intent — a
 * second tap duplicated the row *and* popped an extra screen, so guarding only
 * the write would still leave the user two screens back. And a single action is
 * often shared between a terminal button and a repeatable one: new-expense uses
 * one `save` for both Save and Save & add another, and latching the action would
 * take the second one away.
 *
 * `handler` returns whether the thing actually happened. Return `false` for a
 * save that failed and the latch reopens, so the button still works.
 */
export function useSubmitOnce<Args extends unknown[]>(
  handler: (...args: Args) => Promise<boolean> | boolean,
): SubmitOnce<Args> {
  /* The latch is state rather than a ref purely so it can be built once without
     writing to a ref mid-render, which the compiler rules disallow. It is never
     set again, so it never causes a render. */
  const [latch] = useState(createSubmitLatch);

  const submit = async (...args: Args) => {
    await latch.run(() => handler(...args));
  };

  return { submit, reset: latch.reset };
}
