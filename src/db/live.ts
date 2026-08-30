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

export type TableName =
  | 'accounts'
  | 'categories'
  | 'expenses'
  | 'settlements'
  | 'budgets'
  | 'rules'
  | 'rule_conditions'
  | 'rule_actions'
  | 'settings';

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

  const [state, setState] = useState<ReadState<T>>(() => runRead(read));
  // Which key the value in state answers, so a key change is reflected in the
  // same render rather than one frame late.
  const answeredKey = useRef(key);

  const refetch = useCallback(() => {
    setState(runRead(readRef.current));
  }, []);

  if (answeredKey.current !== key) {
    answeredKey.current = key;
    setState(runRead(read));
  }

  useEffect(() => {
    const watched = new Set(tablesKey.split(','));
    let scheduled: number | null = null;

    const schedule = () => {
      if (scheduled !== null) return;
      scheduled = requestAnimationFrame(() => {
        scheduled = null;
        setState(runRead(readRef.current));
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

    // A write may have landed between the initial read and this subscription.
    schedule();

    return () => {
      subscription.remove();
      stopPulse();
      if (scheduled !== null) cancelAnimationFrame(scheduled);
    };
  }, [tablesKey]);

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
