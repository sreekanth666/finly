/**
 * Between the rule editor's fields and the rules tables.
 *
 * The editor holds `priority` as a string because it is a text input, and holds
 * the three possible actions as three separate nullable fields because that is
 * how they are laid out on screen. The tables want a number and a list.
 */

import type { RuleDraft } from '@/components/rule-editor';
import type { RuleInput } from '@/db/repositories/rules';
import type { Rule, RuleAction } from '@/domain/rules';

const DEFAULT_PRIORITY = 50;

export function draftToInput(draft: RuleDraft): RuleInput {
  const actions: RuleAction[] = [];

  if (draft.categoryId !== null) {
    actions.push({ type: 'set_category', categoryId: draft.categoryId });
  }
  if (draft.accountId !== null) {
    actions.push({ type: 'set_account', accountId: draft.accountId });
  }
  if (draft.countsToBudget !== null) {
    actions.push({ type: 'set_counts_to_budget', countsToBudget: draft.countsToBudget });
  }

  const priority = Number(draft.priority);

  return {
    name: draft.name,
    priority: Number.isFinite(priority) && draft.priority.trim() !== '' ? priority : DEFAULT_PRIORITY,
    isEnabled: draft.isEnabled,
    matchMode: draft.matchMode,
    conditions: draft.conditions,
    actions,
  };
}

export function ruleToDraft(rule: Rule): RuleDraft {
  const find = <T extends RuleAction['type']>(type: T) =>
    rule.actions.find((action) => action.type === type);

  const category = find('set_category');
  const account = find('set_account');
  const counts = find('set_counts_to_budget');

  return {
    name: rule.name,
    isEnabled: rule.isEnabled,
    priority: String(rule.priority),
    matchMode: rule.matchMode,
    conditions: rule.conditions,
    categoryId: category?.type === 'set_category' ? category.categoryId : null,
    accountId: account?.type === 'set_account' ? account.accountId : null,
    countsToBudget: counts?.type === 'set_counts_to_budget' ? counts.countsToBudget : null,
  };
}
