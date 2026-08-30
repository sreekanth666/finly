/**
 * Failures the user is allowed to see.
 *
 * SQLite reports a violated constraint as `SQLITE_CONSTRAINT: CHECK constraint
 * failed`, which tells the user nothing and tells us only slightly more. The
 * repository layer catches its own rule breaches before they reach SQLite and
 * throws one of these instead, each carrying a sentence a screen can render.
 */

export abstract class RepositoryError extends Error {
  abstract readonly userMessage: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** A field the user typed is not acceptable. `field` lets the form point at it. */
export class ValidationError extends RepositoryError {
  constructor(
    readonly field: string,
    readonly userMessage: string,
  ) {
    super(`${field}: ${userMessage}`);
  }
}

export class NotFoundError extends RepositoryError {
  readonly userMessage = 'That record no longer exists.';

  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`);
  }
}

/**
 * §5: total settlements for an expense may not exceed its amount. SQLite cannot
 * express a constraint that spans rows, so the repository enforces it.
 */
/**
 * The rule can be broken from either side: by settling more than the expense is
 * worth, or by editing the expense down below what has already come back. Both
 * land here, and each needs its own sentence — "more than is outstanding" is
 * meaningless when the user was editing an amount.
 */
export type SettlementCapBreach = 'settling-too-much' | 'lowering-below-settled';

export class SettlementExceedsExpenseError extends RepositoryError {
  readonly userMessage: string;

  constructor(
    readonly boundaryMinor: number,
    readonly breach: SettlementCapBreach = 'settling-too-much',
  ) {
    super(`settlement cap breached (${breach}) at ${boundaryMinor} paise`);
    this.userMessage =
      breach === 'settling-too-much'
        ? 'That is more than is still outstanding on this expense.'
        : 'This expense already has more returned against it than that. Remove a settlement first.';
  }
}

/** §5: an account with history is archived, never deleted. */
export class AccountInUseError extends RepositoryError {
  readonly userMessage: string;

  constructor(readonly referenceCount: number) {
    super(`account still referenced by ${referenceCount} rows`);
    this.userMessage =
      referenceCount === 1
        ? 'One expense still uses this account. Archive it instead.'
        : `${referenceCount} records still use this account. Archive it instead.`;
  }
}

export const toError = (cause: unknown): Error =>
  cause instanceof Error ? cause : new Error(String(cause));
