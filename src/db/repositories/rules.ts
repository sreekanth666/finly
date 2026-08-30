/**
 * Rules, across their three tables.
 *
 * Conditions and actions are child rows from day one (§4.6) so that amount
 * conditions, date conditions and alert actions arrive as inserts rather than as
 * a reshaping of every existing rule.
 *
 * `rule_actions.value` is a single TEXT column carrying an id for
 * set_category and set_account, and '0'/'1' for set_counts_to_budget. The
 * mapping between that and the discriminated union the domain works in lives
 * here and nowhere else.
 */

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import type {
  Rule,
  RuleAction,
  RuleCondition,
  RuleMatchMode,
} from '@/domain/rules';

import { db, type DbLike } from '../client';
import { NotFoundError, ValidationError } from '../errors';
import { newId } from '../id';
import { ruleActions, rules, ruleConditions, type RuleActionRow, type RuleRow } from '../schema';
import { writeTransaction } from '../transaction';

const alive = isNull(rules.deletedAt);

export type RuleInput = {
  name: string;
  priority: number;
  isEnabled: boolean;
  matchMode: RuleMatchMode;
  conditions: RuleCondition[];
  actions: RuleAction[];
};

/* -------------------------------------------------------------------------- */
/* Mapping                                                                      */
/* -------------------------------------------------------------------------- */

function toAction(row: RuleActionRow): RuleAction | null {
  switch (row.type) {
    case 'set_category':
      return { type: 'set_category', categoryId: row.value };
    case 'set_account':
      return { type: 'set_account', accountId: row.value };
    case 'set_counts_to_budget':
      return { type: 'set_counts_to_budget', countsToBudget: row.value === '1' };
    default:
      // A restored backup could carry an action type this build predates.
      // Dropping it is better than refusing to show the rule at all.
      return null;
  }
}

const actionValue = (action: RuleAction): string => {
  switch (action.type) {
    case 'set_category':
      return action.categoryId;
    case 'set_account':
      return action.accountId;
    case 'set_counts_to_budget':
      return action.countsToBudget ? '1' : '0';
  }
};

/* -------------------------------------------------------------------------- */
/* Reads                                                                        */
/* -------------------------------------------------------------------------- */

function assemble(rows: RuleRow[], database: DbLike): Rule[] {
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);

  // Two queries for the children rather than two per rule, so a screen with
  // twenty rules still costs three round trips in total.
  const conditionRows = database
    .select()
    .from(ruleConditions)
    .where(inArray(ruleConditions.ruleId, ids))
    .all();
  const actionRows = database
    .select()
    .from(ruleActions)
    .where(inArray(ruleActions.ruleId, ids))
    .all();

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    priority: row.priority,
    isEnabled: row.isEnabled,
    matchMode: row.matchMode,
    timesApplied: row.timesApplied,
    conditions: conditionRows
      .filter((condition) => condition.ruleId === row.id)
      .map((condition) => ({
        field: condition.field,
        operator: condition.operator,
        value: condition.value,
      })),
    actions: actionRows
      .filter((action) => action.ruleId === row.id)
      .map(toAction)
      .filter((action): action is RuleAction => action !== null),
  }));
}

export const listRules = (database: DbLike = db): Rule[] =>
  assemble(
    database.select().from(rules).where(alive).orderBy(desc(rules.priority)).all(),
    database,
  );

/** Enabled rules only — what expense entry actually evaluates against. */
export const listActiveRules = (database: DbLike = db): Rule[] =>
  listRules(database).filter((rule) => rule.isEnabled);

export function getRule(id: string, database: DbLike = db): Rule | null {
  const row = database.select().from(rules).where(and(eq(rules.id, id), alive)).get();
  if (row === undefined) return null;
  return assemble([row], database)[0] ?? null;
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                       */
/* -------------------------------------------------------------------------- */

function validate(input: RuleInput): void {
  if (input.name.trim().length === 0) {
    throw new ValidationError('name', 'A rule needs a name.');
  }
  if (input.conditions.every((condition) => condition.value.trim().length === 0)) {
    throw new ValidationError('conditions', 'A rule needs at least one condition to match on.');
  }
  if (input.actions.length === 0) {
    throw new ValidationError('actions', 'A rule needs at least one thing to fill in.');
  }
}

/** Children are always written together with their parent, in one transaction. */
function writeChildren(ruleId: string, input: RuleInput, tx: DbLike, now: number): void {
  for (const condition of input.conditions) {
    if (condition.value.trim().length === 0) continue;
    tx.insert(ruleConditions)
      .values({
        id: newId(),
        ruleId,
        field: condition.field,
        operator: condition.operator,
        value: condition.value.trim(),
        createdAt: now,
      })
      .run();
  }

  for (const action of input.actions) {
    tx.insert(ruleActions)
      .values({
        id: newId(),
        ruleId,
        type: action.type,
        value: actionValue(action),
        createdAt: now,
      })
      .run();
  }
}

export function createRule(input: RuleInput, database: DbLike = db): string {
  validate(input);

  const id = newId();
  const now = Date.now();

  writeTransaction((tx) => {
    tx.insert(rules)
      .values({
        id,
        name: input.name.trim(),
        priority: input.priority,
        isEnabled: input.isEnabled,
        matchMode: input.matchMode,
        timesApplied: 0,
        lastAppliedAt: null,
        createdAt: now,
        updatedAt: now,
      })
      .run();

    writeChildren(id, input, tx, now);
  });

  return id;
}

export function updateRule(id: string, input: RuleInput, database: DbLike = db): void {
  validate(input);

  const existing = database.select().from(rules).where(eq(rules.id, id)).get();
  if (existing === undefined) throw new NotFoundError('Rule', id);

  const now = Date.now();

  writeTransaction((tx) => {
    tx.update(rules)
      .set({
        name: input.name.trim(),
        priority: input.priority,
        isEnabled: input.isEnabled,
        matchMode: input.matchMode,
        updatedAt: now,
      })
      .where(eq(rules.id, id))
      .run();

    /* Replace rather than reconcile. Conditions and actions have no identity of
       their own from the user's point of view — the editor hands back the whole
       set — and diffing them would only invent one. */
    tx.delete(ruleConditions).where(eq(ruleConditions.ruleId, id)).run();
    tx.delete(ruleActions).where(eq(ruleActions.ruleId, id)).run();

    writeChildren(id, input, tx, now);
  });
}

export function setRuleEnabled(id: string, isEnabled: boolean, database: DbLike = db): void {
  database
    .update(rules)
    .set({ isEnabled, updatedAt: Date.now() })
    .where(eq(rules.id, id))
    .run();
}

export function softDeleteRule(id: string, database: DbLike = db): void {
  database
    .update(rules)
    .set({ deletedAt: Date.now(), updatedAt: Date.now() })
    .where(eq(rules.id, id))
    .run();
}

/**
 * Counts a rule as having been used.
 *
 * The "used 34 times" stat has rendered since the design pass and nothing has
 * ever incremented it. Called when a rule's suggestion survives all the way to a
 * saved expense — not when it merely matches while typing, which would count
 * every keystroke that passed through "swig".
 */
export function recordRuleApplied(id: string, database: DbLike = db): void {
  database
    .update(rules)
    .set({
      timesApplied: sql`${rules.timesApplied} + 1`,
      lastAppliedAt: Date.now(),
      updatedAt: Date.now(),
    })
    .where(eq(rules.id, id))
    .run();
}
