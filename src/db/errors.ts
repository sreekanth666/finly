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
export class SettlementExceedsExpenseError extends RepositoryError {
  readonly userMessage: string;

  constructor(readonly remainingMinor: number) {
    super(`settlement exceeds the expense by more than ${remainingMinor} paise`);
    this.userMessage = 'That is more than is still outstanding on this expense.';
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
