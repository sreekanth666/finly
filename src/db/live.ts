/**
 * The one way a screen reads the database.
 *
 * Drizzle ships `useLiveQuery` for expo-sqlite and this app deliberately does
 * not use it: it throws on raw `sql` and on subqueries, which every budget and
 * insights aggregate needs, and it derives its invalidation from a single table,
 * so a joined query goes stale when the joined-to table changes. Running two
 * reactivity models across nineteen screens would guarantee drift, so there is
 * one hook and it covers everything.
 *
 * Reads are synchronous (see transaction.ts), so there is no loading state and
 * no chance of a slow query overwriting a fast one. What this hook still has to
 * get right is invalidation.
 */

import { addDatabaseChangeListener } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import { db, sqlite, type Db } from './client';
import { toError } from './errors';
import { sameResult } from './same-result';

export type TableName =
  | 'accounts'
  | 'categories'
  | 'expenses'
  | 'settlements'
  | 'card_payments'
  | 'budgets'
  | 'rules'
  | 'rule_conditions'
  | 'rule_actions'
  | 'settings'
  | 'captured_messages'
  | 'detected_transactions'
  | 'capture_templates'
  | 'detector_labels';

export type QueryResult<T> =
  | { data: T; error: null; refetch: () => void }
  | { data: undefined; error: Error; refetch: () => void };

/* -------------------------------------------------------------------------- */
/* Bulk-write suppression                                                       */
/* -------------------------------------------------------------------------- */

/**
 * A change event fires per row. Importing two thousand expenses would otherwise
 * wake every mounted screen two thousand times, which locks the app up long
 * enough to look like a crash. Bulk writes run inside `withSuppressedInvalidation`
 * and the screens are woken once, at the end.
 */
let suppressionDepth = 0;
const pulseListeners = new Set<() => void>();

export const isInvalidationSuppressed = (): boolean => suppressionDepth > 0;

export function onBulkChange(listener: () => void): () => void {
  pulseListeners.add(listener);
  return () => {
    pulseListeners.delete(listener);
  };
}

export async function withSuppressedInvalidation<T>(task: () => Promise<T> | T): Promise<T> {
  suppressionDepth += 1;
  try {
    return await task();
  } finally {
    suppressionDepth -= 1;
    if (suppressionDepth === 0) {
      for (const listener of pulseListeners) listener();
    }
  }
}

/* -------------------------------------------------------------------------- */
/* Write clock                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * How many writes each table has seen, so a query can tell whether anything it
 * reads changed since it last looked. Registered at import, ahead of every
 * hook's own listener, so a count is always current by the time a hook hears
 * about the same write. It counts during bulk writes too; the pulse at the end
 * wakes the screens either way.
 */
const tableVersions = new Map<string, number>();

addDatabaseChangeListener((event) => {
  // The file, not the schema name; see the comment in useDbQuery's listener.
  if (event.databaseFilePath !== sqlite.databasePath) return;
  tableVersions.set(event.tableName, (tableVersions.get(event.tableName) ?? 0) + 1);
});

/** Versions only grow, so the sum moves exactly when one of the tables was written. */
const stampOf = (tables: Iterable<string>): number => {
  let stamp = 0;
  for (const table of tables) stamp += tableVersions.get(table) ?? 0;
  return stamp;
};

/* -------------------------------------------------------------------------- */
/* useDbQuery                                                                   */
/* -------------------------------------------------------------------------- */

type ReadState<T> = { data: T; error: null } | { data: undefined; error: Error };

function runRead<T>(read: (database: Db) => T): ReadState<T> {
  try {
    return { data: read(db), error: null };
  } catch (cause) {
    return { data: undefined, error: toError(cause) };
  }
}

/**
 * @param key    Everything the query depends on, serialised. A string rather
 *               than a dependency array so that the React Compiler's memoisation
 *               of the inline `read` closure can never decide when a query
 *               refires — that is this argument's job alone.
 * @param tables Which tables' writes should invalidate this query. Include every
 *               table the query joins, not just the one it selects from.
 * @param read   Runs synchronously against the database. Always read from a ref
 *               so a fresh closure each render doesn't resubscribe.
 */
export function useDbQuery<T>(
  key: string,
  tables: readonly TableName[],
  read: (database: Db) => T,
): QueryResult<T> {
  const readRef = useRef(read);
  readRef.current = read;

  const tablesKey = tables.join(',');

  // The write clock as the first read saw it. Taken before that read, so a
  // write that lands during it still counts as unseen.
  const [mounted] = useState(() => ({ tablesKey, stamp: stampOf(tables) }));
  const [state, setState] = useState<ReadState<T>>(() => runRead(read));
  // Which key the value in state answers, so a key change is reflected in the
  // same render rather than one frame late.
  const answeredKey = useRef(key);

  // A re-read that finds the same rows keeps the old result, so the screen does
  // not re-render for a write that changed nothing it shows.
  const keepIfSame = useCallback((next: ReadState<T>) => {
    setState((previous) => (sameResult(previous, next) ? previous : next));
  }, []);

  const refetch = useCallback(() => {
    keepIfSame(runRead(readRef.current));
  }, [keepIfSame]);

  if (answeredKey.current !== key) {
    answeredKey.current = key;
    // A different question: always answer it, and in this render.
    setState(runRead(read));
  }

  useEffect(() => {
    const watched = new Set(tablesKey.split(','));
    let scheduled: number | null = null;

    const schedule = () => {
      if (scheduled !== null) return;
      scheduled = requestAnimationFrame(() => {
        scheduled = null;
        keepIfSame(runRead(readRef.current));
      });
    };

    const subscription = addDatabaseChangeListener((event) => {
      /*
       * `event.databaseName` is SQLite's SCHEMA name — 'main' for the primary
       * database, and something else only for an ATTACHed one. It is NOT the
       * file name. Comparing it against 'finly.db' silently discarded every
       * event, which left the whole app showing stale data until a screen
       * remounted. The absolute path is the field that identifies the file.
       */
      if (event.databaseFilePath !== sqlite.databasePath) return;
      if (!watched.has(event.tableName)) return;
      if (isInvalidationSuppressed()) return;
      schedule();
    });
    const stopPulse = onBulkChange(schedule);

    // A write may have landed between the first read and this subscription. The
    // write clock says whether one did, so a quiet mount reads only once. A
    // change of tables was never read against, so it always reads.
    if (mounted.tablesKey !== tablesKey || stampOf(watched) !== mounted.stamp) schedule();

    return () => {
      subscription.remove();
      stopPulse();
      if (scheduled !== null) cancelAnimationFrame(scheduled);
    };
  }, [keepIfSame, mounted, tablesKey]);

  return { ...state, refetch } as QueryResult<T>;
}

/**
 * The first failure among several queries, or null.
 *
 * A screen usually runs one query it cannot render without and several it can
 * degrade around. This is for the former: collapse them and show one error,
 * rather than each falling back to `?? []` and reporting a read failure to the
 * user as "you have no data".
 */
export const firstError = (
  ...results: readonly { error: Error | null }[]
): Error | null => results.find((result) => result.error !== null)?.error ?? null;
