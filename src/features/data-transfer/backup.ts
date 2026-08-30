/**
 * JSON backup and restore.
 *
 * §10 names device loss as the risk with no server behind it, and calls for a
 * backup that "restores fully". That is why this exports **raw rows**, including
 * soft-deleted ones: a restore that quietly dropped what was in the bin, or
 * re-minted ids, would be a migration rather than a restore, and the settlements
 * pointing at those expenses would land nowhere.
 */

import {
  accounts,
  budgets,
  categories,
  expenses,
  ruleActions,
  ruleConditions,
  rules,
  settings,
  type AccountRow,
  type BudgetRow,
  type CategoryRow,
  type ExpenseRow,
  type RuleActionRow,
  type RuleConditionRow,
  type RuleRow,
  type SettingRow,
  type SettlementRow,
} from '@/db/schema';
import { settlements } from '@/db/schema';
import { db, type DbLike } from '@/db/client';
import { withSuppressedInvalidation } from '@/db/live';
import { writeTransaction } from '@/db/transaction';
import { sql } from 'drizzle-orm';

export const BACKUP_FORMAT = 'finly.backup';
export const BACKUP_VERSION = 1;

export type BackupData = {
  categories: CategoryRow[];
  accounts: AccountRow[];
  expenses: ExpenseRow[];
  settlements: SettlementRow[];
  budgets: BudgetRow[];
  rules: RuleRow[];
  ruleConditions: RuleConditionRow[];
  ruleActions: RuleActionRow[];
  settings: SettingRow[];
};

export type Backup = {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  data: BackupData;
};

export function buildBackup(database: DbLike = db): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: Date.now(),
    data: {
      categories: database.select().from(categories).all(),
      accounts: database.select().from(accounts).all(),
      expenses: database.select().from(expenses).all(),
      settlements: database.select().from(settlements).all(),
      budgets: database.select().from(budgets).all(),
      rules: database.select().from(rules).all(),
      ruleConditions: database.select().from(ruleConditions).all(),
      ruleActions: database.select().from(ruleActions).all(),
      settings: database.select().from(settings).all(),
    },
  };
}

export class BackupFormatError extends Error {
  readonly userMessage = 'That file is not a Finly backup.';
}

export function validateBackup(value: unknown): Backup {
  if (typeof value !== 'object' || value === null) throw new BackupFormatError('not an object');

  const candidate = value as Partial<Backup>;
  if (candidate.format !== BACKUP_FORMAT) throw new BackupFormatError('wrong format marker');
  if (typeof candidate.version !== 'number') throw new BackupFormatError('no version');
  if (candidate.version > BACKUP_VERSION) {
    throw new BackupFormatError(
      `This backup was written by a newer version of Finly (v${candidate.version}).`,
    );
  }
  if (typeof candidate.data !== 'object' || candidate.data === null) {
    throw new BackupFormatError('no data');
  }
  if (!Array.isArray(candidate.data.expenses)) throw new BackupFormatError('no expenses');

  return candidate as Backup;
}

export type RestoreSummary = {
  expenses: number;
  settlements: number;
  accounts: number;
  categories: number;
  rules: number;
};

/**
 * Replaces everything on the device with the contents of the backup.
 *
 * One transaction, so a failure halfway leaves the existing data untouched
 * rather than half-replaced. Foreign keys are deferred for the duration: rows
 * arrive parent-first, but a settlement in the file may reference an expense
 * that has not been inserted yet within the same statement batch, and deferring
 * checks the whole graph at commit instead of row by row.
 */
export async function restoreBackup(
  backup: Backup,
  database: DbLike = db,
): Promise<RestoreSummary> {
  const { data } = backup;

  return withSuppressedInvalidation(() =>
    writeTransaction((tx) => {
      tx.run(sql`PRAGMA defer_foreign_keys = ON`);

      // Children first on the way out, so nothing is orphaned mid-delete.
      tx.delete(ruleActions).run();
      tx.delete(ruleConditions).run();
      tx.delete(settlements).run();
      tx.delete(expenses).run();
      tx.delete(rules).run();
      tx.delete(budgets).run();
      tx.delete(accounts).run();
      tx.delete(categories).run();
      tx.delete(settings).run();

      const insertAll = <T extends Record<string, unknown>>(
        table: Parameters<typeof tx.insert>[0],
        rows: T[] | undefined,
      ) => {
        if (rows === undefined || rows.length === 0) return 0;
        // Chunked: SQLite has a bound-parameter ceiling, and a few thousand
        // expenses times thirteen columns clears it comfortably.
        for (let index = 0; index < rows.length; index += 100) {
          tx.insert(table).values(rows.slice(index, index + 100)).run();
        }
        return rows.length;
      };

      insertAll(categories, data.categories);
      insertAll(accounts, data.accounts);
      insertAll(budgets, data.budgets);
      const expenseCount = insertAll(expenses, data.expenses);
      const settlementCount = insertAll(settlements, data.settlements);
      const ruleCount = insertAll(rules, data.rules);
      insertAll(ruleConditions, data.ruleConditions);
      insertAll(ruleActions, data.ruleActions);
      insertAll(settings, data.settings);

      return {
        expenses: expenseCount,
        settlements: settlementCount,
        accounts: data.accounts?.length ?? 0,
        categories: data.categories?.length ?? 0,
        rules: ruleCount,
      };
    }),
  );
}
