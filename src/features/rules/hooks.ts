/**
 * Rules, live.
 */

import { useDbQuery, type TableName } from '@/db/live';
import { getRule, listActiveRules, listRules } from '@/db/repositories/rules';
import type { Rule } from '@/domain/rules';

/* A rule is its three tables; a change to any of them changes the rule. */
const RULE_TABLES: readonly TableName[] = ['rules', 'rule_conditions', 'rule_actions'];

export function useRules() {
  return useDbQuery<Rule[]>('rules', RULE_TABLES, (database) => listRules(database));
}

/** What expense entry evaluates against while the item is being typed. */
export function useActiveRules() {
  return useDbQuery<Rule[]>('rules:active', RULE_TABLES, (database) => listActiveRules(database));
}

export function useRule(id: string) {
  return useDbQuery<Rule | null>(`rule:${id}`, RULE_TABLES, (database) => getRule(id, database));
}
