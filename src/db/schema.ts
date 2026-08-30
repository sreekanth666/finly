/**
 * The database, as §5 of the MVP plan defines it. This file is the single source
 * of truth: `pnpm db:generate` reads it and emits the versioned SQL in drizzle/,
 * and every row type in the app is inferred from it rather than hand-written.
 *
 * Conventions worth knowing before editing:
 *
 * - Every column name is spelled out. Relying on a `casing` setting means a
 *   mismatch shows up as drizzle-kit generating an *extra* column on the next
 *   migration instead of failing, which is a very quiet way to lose data.
 * - Timestamps are epoch milliseconds, stored as plain integers. Not
 *   `mode: 'timestamp'` — that is seconds, and §4.2 is explicit about ms.
 * - Money columns carry the `Minor` brand so a rupee value cannot be inserted
 *   where paise belong.
 * - Ids are UUID v4 text, not autoincrement, so a restored backup or a future
 *   sync can never collide.
 * - `deleted_at` is present wherever user data is destructible. Soft delete is
 *   what makes undo free and keeps history honest.
 */

import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import type { Minor } from '@/domain/money';

/** Payment sources: credit cards, bank accounts, cash, wallets. */
export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    type: text('type').notNull().$type<AccountType>(),
    issuer: text('issuer'),
    /** Last four digits, for telling two cards from the same issuer apart. */
    last4: text('last4'),
    /** Credit cards only — §5 requires it for them and forbids it elsewhere. */
    creditLimitMinor: integer('credit_limit_minor').$type<Minor>(),
    /** Credit cards only. 1–31; short months clamp (§4.5). */
    statementDay: integer('statement_day'),
    /** A theme token name, never a hex — see scripts/check-colors.mjs. */
    colorToken: text('color_token').notNull().default('accent'),
    sortOrder: integer('sort_order').notNull().default(0),
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (table) => [
    check('accounts_type', sql`${table.type} in ('credit_card','bank','cash','wallet')`),
    check(
      'accounts_statement_day',
      sql`${table.statementDay} is null or (${table.statementDay} between 1 and 31)`,
    ),
    check(
      'accounts_card_needs_limit',
      sql`${table.type} <> 'credit_card' or ${table.creditLimitMinor} is not null`,
    ),
    index('idx_accounts_order').on(table.sortOrder),
  ],
);

export const categories = sqliteTable(
  'categories',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** A lucide icon name, resolved to a component by the icon registry. */
    icon: text('icon').notNull(),
    colorToken: text('color_token').notNull(),
    /** One of the five chart slots, pinned so a category keeps its colour. */
    chartTone: text('chart_tone').notNull(),
    /** Seeded rows the user may archive but not delete. */
    isSystem: integer('is_system', { mode: 'boolean' }).notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    isArchived: integer('is_archived', { mode: 'boolean' }).notNull().default(false),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (table) => [index('idx_categories_order').on(table.sortOrder)],
);

export const expenses = sqliteTable(
  'expenses',
  {
    id: text('id').primaryKey(),
    /** Epoch ms, UTC. Only the period below is derived in local time. */
    occurredAt: integer('occurred_at').notNull(),
    /** 'YYYY-MM' in the device's local zone, rewritten whenever the date moves. */
    budgetPeriod: text('budget_period').notNull(),
    amountMinor: integer('amount_minor').notNull().$type<Minor>(),
    currency: text('currency').notNull().default('INR'),
    item: text('item').notNull(),
    note: text('note'),
    categoryId: text('category_id').references(() => categories.id),
    accountId: text('account_id').references(() => accounts.id),
    countsToBudget: integer('counts_to_budget', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (table) => [
    check('expenses_amount_positive', sql`${table.amountMinor} > 0`),
    index('idx_expenses_period').on(table.budgetPeriod, table.deletedAt),
    index('idx_expenses_occurred').on(sql`${table.occurredAt} desc`),
    index('idx_expenses_account').on(table.accountId, sql`${table.occurredAt} desc`),
    index('idx_expenses_category').on(table.categoryId, table.budgetPeriod),
    /* Covers spent(P) end to end, so the carry-over walk never touches the table. */
    index('idx_expenses_period_budget').on(
      table.budgetPeriod,
      table.countsToBudget,
      table.deletedAt,
    ),
  ],
);

/** Money coming back against a specific expense (D1). */
export const settlements = sqliteTable(
  'settlements',
  {
    id: text('id').primaryKey(),
    expenseId: text('expense_id')
      .notNull()
      .references(() => expenses.id, { onDelete: 'cascade' }),
    amountMinor: integer('amount_minor').notNull().$type<Minor>(),
    settledAt: integer('settled_at').notNull(),
    /** Where the money landed. */
    accountId: text('account_id').references(() => accounts.id),
    note: text('note'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (table) => [
    check('settlements_amount_positive', sql`${table.amountMinor} > 0`),
    index('idx_settlements_expense').on(table.expenseId, table.deletedAt),
  ],
);

/** One row per month, created lazily on first use of that period. */
export const budgets = sqliteTable(
  'budgets',
  {
    id: text('id').primaryKey(),
    period: text('period').notNull(),
    amountMinor: integer('amount_minor').notNull().$type<Minor>(),
    /**
     * A snapshot of the carry-over the user last saw, not a value anything reads
     * for correctness — every total is derived live. Its job is to notice when a
     * settlement has retroactively changed a past month (§4.3).
     */
    carryOverMinor: integer('carry_over_minor').notNull().default(0).$type<Minor>(),
    carryRecomputedAt: integer('carry_recomputed_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [uniqueIndex('idx_budgets_period').on(table.period)],
);

export const rules = sqliteTable(
  'rules',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** Higher wins. Evaluation is highest-first, first match wins. */
    priority: integer('priority').notNull().default(0),
    isEnabled: integer('is_enabled', { mode: 'boolean' }).notNull().default(true),
    matchMode: text('match_mode').notNull().default('all').$type<RuleMatchMode>(),
    timesApplied: integer('times_applied').notNull().default(0),
    lastAppliedAt: integer('last_applied_at'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
    deletedAt: integer('deleted_at'),
  },
  (table) => [
    check('rules_match_mode', sql`${table.matchMode} in ('all','any')`),
    index('idx_rules_priority').on(sql`${table.priority} desc`, table.deletedAt),
  ],
);

export const ruleConditions = sqliteTable('rule_conditions', {
  id: text('id').primaryKey(),
  ruleId: text('rule_id')
    .notNull()
    .references(() => rules.id, { onDelete: 'cascade' }),
  /** item | note today; amount, account and weekday are additive later. */
  field: text('field').notNull().$type<RuleConditionField>(),
  operator: text('operator').notNull().$type<RuleConditionOperator>(),
  value: text('value').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const ruleActions = sqliteTable('rule_actions', {
  id: text('id').primaryKey(),
  ruleId: text('rule_id')
    .notNull()
    .references(() => rules.id, { onDelete: 'cascade' }),
  type: text('type').notNull().$type<RuleActionType>(),
  /** An id for set_category and set_account, '0'/'1' for set_counts_to_budget. */
  value: text('value').notNull(),
  createdAt: integer('created_at').notNull(),
});

/** Key/value app settings. See SettingKey for the ones that exist. */
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey().$type<SettingKey>(),
  value: text('value').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/* -------------------------------------------------------------------------- */
/* Column unions                                                               */
/* -------------------------------------------------------------------------- */

export const ACCOUNT_TYPES = ['credit_card', 'bank', 'cash', 'wallet'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export type RuleMatchMode = 'all' | 'any';

export const RULE_CONDITION_FIELDS = ['item', 'note'] as const;
export type RuleConditionField = (typeof RULE_CONDITION_FIELDS)[number];

export const RULE_CONDITION_OPERATORS = ['contains', 'equals', 'starts_with'] as const;
export type RuleConditionOperator = (typeof RULE_CONDITION_OPERATORS)[number];

export type RuleActionType = 'set_category' | 'set_account' | 'set_counts_to_budget';

export type SettingKey =
  | 'schema_seeded'
  | 'onboarding_done'
  | 'currency'
  | 'monthly_budget_minor'
  /** Earliest period whose carry-over snapshot is out of date. */
  | 'carry_dirty_from'
  /** JSON: which periods the last recompute actually moved, for the home notice. */
  | 'carry_changed_periods'
  | 'last_account_id'
  | 'last_export_at'
  | 'app_lock_enabled'
  | 'encryption_enabled';

/* -------------------------------------------------------------------------- */
/* Row types — these replace the hand-written types the fixtures used to carry  */
/* -------------------------------------------------------------------------- */

export type AccountRow = typeof accounts.$inferSelect;
export type NewAccountRow = typeof accounts.$inferInsert;
export type CategoryRow = typeof categories.$inferSelect;
export type NewCategoryRow = typeof categories.$inferInsert;
export type ExpenseRow = typeof expenses.$inferSelect;
export type NewExpenseRow = typeof expenses.$inferInsert;
export type SettlementRow = typeof settlements.$inferSelect;
export type NewSettlementRow = typeof settlements.$inferInsert;
export type BudgetRow = typeof budgets.$inferSelect;
export type NewBudgetRow = typeof budgets.$inferInsert;
export type RuleRow = typeof rules.$inferSelect;
export type NewRuleRow = typeof rules.$inferInsert;
export type RuleConditionRow = typeof ruleConditions.$inferSelect;
export type NewRuleConditionRow = typeof ruleConditions.$inferInsert;
export type RuleActionRow = typeof ruleActions.$inferSelect;
export type NewRuleActionRow = typeof ruleActions.$inferInsert;
export type SettingRow = typeof settings.$inferSelect;
