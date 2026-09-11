import type { DatabaseSync } from 'node:sqlite';

import { insertExpense, openMigratedDatabase, seedCatalogue } from './support';

/*
 * The question `hasExpenseCreatedBetween` asks for the daily reminder (D16):
 * was anything entered today? Mirrors the repository's query, so the half-open
 * window and the soft-delete filter are held to the real schema.
 */
const LOGGED_BETWEEN = `
  select id from expenses
  where deleted_at is null and created_at >= ? and created_at < ?
  limit 1
`;

const DAY_START = 1_760_000_000_000;
const DAY_END = DAY_START + 86_400_000;

let db: DatabaseSync;

beforeEach(() => {
  db = openMigratedDatabase();
  seedCatalogue(db);
});

afterEach(() => {
  db.close();
});

const loggedToday = () => db.prepare(LOGGED_BETWEEN).get(DAY_START, DAY_END) !== undefined;

describe('whether anything was logged today (D16)', () => {
  it('is false on an empty day', () => {
    expect(loggedToday()).toBe(false);
  });

  it('is true once an expense is entered within the day', () => {
    insertExpense(db, { id: 'e1', period: '2025-10', amountMinor: 100, createdAt: DAY_START + 1 });
    expect(loggedToday()).toBe(true);
  });

  it('goes by when it was entered, not when it happened — a backfill counts', () => {
    insertExpense(db, {
      id: 'e1',
      period: '2025-09',
      amountMinor: 100,
      occurredAt: DAY_START - 30 * 86_400_000,
      createdAt: DAY_START + 1,
    });
    expect(loggedToday()).toBe(true);
  });

  it('ignores a deleted expense, so undoing the only entry brings the reminder back', () => {
    insertExpense(db, {
      id: 'e1',
      period: '2025-10',
      amountMinor: 100,
      createdAt: DAY_START + 1,
      deleted: true,
    });
    expect(loggedToday()).toBe(false);
  });

  it('is half-open: midnight belongs to the day that starts there', () => {
    insertExpense(db, { id: 'before', period: '2025-10', amountMinor: 100, createdAt: DAY_START - 1 });
    insertExpense(db, { id: 'next', period: '2025-10', amountMinor: 100, createdAt: DAY_END });
    expect(loggedToday()).toBe(false);

    insertExpense(db, { id: 'first', period: '2025-10', amountMinor: 100, createdAt: DAY_START });
    expect(loggedToday()).toBe(true);
  });
});
