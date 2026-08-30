/**
 * A real SQLite database for the repository tests.
 *
 * Uses Node's built-in `node:sqlite` rather than a dependency, and applies the
 * *generated* migration rather than a hand-written schema — so these tests fail
 * when `drizzle/` and `schema.ts` drift apart, which is the failure that would
 * otherwise only surface on a device.
 *
 * They exercise the SQL contract, not the TypeScript repository wrappers:
 * `expo-sqlite` is native and has no Node build, so the drizzle instance the
 * repositories import cannot be constructed here. What that still covers is
 * every constraint, every aggregate and every cascade — which is where §8's
 * three named invariants actually live.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(process.cwd(), 'drizzle');

export function openMigratedDatabase(): DatabaseSync {
  const database = new DatabaseSync(':memory:');
  database.exec('PRAGMA foreign_keys = ON');

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name: string) => name.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    throw new Error('No migrations found — run `pnpm db:generate`.');
  }

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint')) {
      if (statement.trim().length > 0) database.exec(statement.trim());
    }
  }

  return database;
}

/** Effective spend, settlements deducted — the expression the app queries with. */
export const EFFECTIVE =
  'sum(max(0, e.amount_minor - coalesce(s.settled_total, 0)))';

export const SETTLED_JOIN = `
  left join (
    select expense_id, sum(amount_minor) as settled_total
    from settlements where deleted_at is null group by expense_id
  ) s on s.expense_id = e.id
`;

const NOW = 1_760_000_000_000;

export function seedCatalogue(database: DatabaseSync): void {
  database.exec(
    `insert into categories (id,name,icon,color_token,chart_tone,is_system,sort_order,is_archived,created_at,updated_at)
     values ('c-food','Food','UtensilsCrossed','accent','chart-1',1,0,0,${NOW},${NOW})`,
  );
  database.exec(
    `insert into accounts (id,name,type,credit_limit_minor,statement_day,color_token,sort_order,is_archived,created_at,updated_at)
     values ('a-card','HDFC','credit_card',400000,31,'accent',0,0,${NOW},${NOW})`,
  );
}

export type ExpenseSeed = {
  id: string;
  period: string;
  amountMinor: number;
  countsToBudget?: boolean;
  deleted?: boolean;
  occurredAt?: number;
  item?: string;
  accountId?: string | null;
};

export function insertExpense(database: DatabaseSync, seed: ExpenseSeed): string {
  database.exec(
    `insert into expenses
       (id,occurred_at,budget_period,amount_minor,currency,item,category_id,account_id,counts_to_budget,created_at,updated_at,deleted_at)
     values (
       '${seed.id}', ${seed.occurredAt ?? NOW}, '${seed.period}', ${seed.amountMinor}, 'INR',
       '${seed.item ?? seed.id}', 'c-food',
       ${seed.accountId === null ? 'null' : `'${seed.accountId ?? 'a-card'}'`},
       ${seed.countsToBudget === false ? 0 : 1}, ${NOW}, ${NOW},
       ${seed.deleted === true ? NOW : 'null'}
     )`,
  );
  return seed.id;
}

export function insertSettlement(
  database: DatabaseSync,
  id: string,
  expenseId: string,
  amountMinor: number,
  deleted = false,
): void {
  database.exec(
    `insert into settlements (id,expense_id,amount_minor,settled_at,created_at,updated_at,deleted_at)
     values ('${id}','${expenseId}',${amountMinor},${NOW},${NOW},${NOW},${deleted ? NOW : 'null'})`,
  );
}

/** True when the statement was rejected — the shape most constraint tests want. */
export function rejects(database: DatabaseSync, sql: string): boolean {
  try {
    database.exec(sql);
    return false;
  } catch {
    return true;
  }
}
