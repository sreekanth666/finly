import type { DatabaseSync } from 'node:sqlite';

import {
  insertExpense,
  insertSettlement,
  openMigratedDatabase,
  seedCatalogue,
  SETTLED_JOIN,
} from './support';

/*
 * The per-row query behind the home chart (`budgetSpendEntries`). It returns
 * rows, not sums, and does no day grouping in SQL: the domain buckets by local
 * day (see domain/feed.ts for why). What is pinned here is which rows survive.
 */

let db: DatabaseSync;

beforeEach(() => {
  db = openMigratedDatabase();
  seedCatalogue(db);
});

afterEach(() => {
  db.close();
});

type Row = { occurredAt: number; budgetPeriod: string; effectiveMinor: number };

/** Mirrors the SQL `budgetSpendEntries` builds, over the same settled-total join. */
const entries = (...periods: string[]): Row[] =>
  db
    .prepare(
      `select e.occurred_at as occurredAt, e.budget_period as budgetPeriod,
              max(0, e.amount_minor - coalesce(s.settled_total, 0)) as effectiveMinor
       from expenses e ${SETTLED_JOIN}
       where e.deleted_at is null and e.counts_to_budget = 1
         and e.budget_period in (${periods.map(() => '?').join(',')})
       order by e.occurred_at`,
    )
    .all(...periods) as Row[];

describe('the spend-curve rows', () => {
  it('returns one row per expense, not a total', () => {
    insertExpense(db, { id: 'a', period: '2026-08', amountMinor: 100, occurredAt: 1000 });
    insertExpense(db, { id: 'b', period: '2026-08', amountMinor: 250, occurredAt: 2000 });

    expect(entries('2026-08')).toEqual([
      { occurredAt: 1000, budgetPeriod: '2026-08', effectiveMinor: 100 },
      { occurredAt: 2000, budgetPeriod: '2026-08', effectiveMinor: 250 },
    ]);
  });

  it('leaves out a soft-deleted expense', () => {
    insertExpense(db, { id: 'kept', period: '2026-08', amountMinor: 100 });
    insertExpense(db, { id: 'gone', period: '2026-08', amountMinor: 900, deleted: true });

    expect(entries('2026-08').map((row) => row.effectiveMinor)).toEqual([100]);
  });

  it('leaves out off-budget spending', () => {
    insertExpense(db, { id: 'food', period: '2026-08', amountMinor: 100 });
    insertExpense(db, { id: 'laptop', period: '2026-08', amountMinor: 4_500_000, countsToBudget: false });

    expect(entries('2026-08').map((row) => row.effectiveMinor)).toEqual([100]);
  });

  it('nets a settlement against its expense, ignoring a deleted settlement', () => {
    insertExpense(db, { id: 'dinner', period: '2026-08', amountMinor: 1000 });
    insertSettlement(db, 's1', 'dinner', 400);
    insertSettlement(db, 's2', 'dinner', 300, true);

    expect(entries('2026-08').map((row) => row.effectiveMinor)).toEqual([600]);
  });

  it('shows a fully settled expense as zero rather than dropping or negating it', () => {
    insertExpense(db, { id: 'dinner', period: '2026-08', amountMinor: 1000 });
    insertSettlement(db, 's1', 'dinner', 1000);

    expect(entries('2026-08').map((row) => row.effectiveMinor)).toEqual([0]);
  });

  it('returns only the periods asked for', () => {
    insertExpense(db, { id: 'jul', period: '2026-07', amountMinor: 10 });
    insertExpense(db, { id: 'aug', period: '2026-08', amountMinor: 20 });
    insertExpense(db, { id: 'sep', period: '2026-09', amountMinor: 30 });

    const rows = entries('2026-07', '2026-08');
    expect(rows.map((row) => row.budgetPeriod).sort()).toEqual(['2026-07', '2026-08']);
  });
});
