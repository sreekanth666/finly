/**
 * Rule evaluation — pure, and deliberately free of React and of storage.
 *
 * This is the logic §4.6 of the MVP plan describes: highest priority first,
 * first match wins, matching case-insensitively. Keeping it here rather than in
 * the screen is what will let it be unit-tested and reused by the rules
 * editor's "how many existing expenses would match" preview.
 */

import type { CategoryId } from '@/data/categories';
import type { Rule, RuleCondition } from '@/data/rules';

/** What a matching rule wants to fill in. Every field is optional. */
export type RuleFill = {
  rule: Rule;
  categoryId?: CategoryId;
  /** Matched against `Account.name` until accounts become real entities in M3. */
  accountName?: string;
  countsToBudget?: boolean;
};

/** What a rule is tested against: the free-text fields of an expense. */
export type MatchTarget = { item: string; note: string };

const testCondition = ({ field, operator, value }: RuleCondition, draft: MatchTarget) => {
  const subject = draft[field].trim().toLowerCase();
  const needle = value.trim().toLowerCase();

  if (subject.length === 0 || needle.length === 0) return false;

  switch (operator) {
    case 'contains':
      return subject.includes(needle);
    case 'equals':
      return subject === needle;
    case 'starts_with':
      return subject.startsWith(needle);
  }
};

const toFill = (rule: Rule): RuleFill =>
  rule.actions.reduce<RuleFill>((fill, action) => {
    switch (action.type) {
      case 'set_category':
        return { ...fill, categoryId: action.categoryId };
      case 'set_account':
        return { ...fill, accountName: action.label };
      case 'set_counts_to_budget':
        return { ...fill, countsToBudget: action.countsToBudget };
    }
  }, { rule });

/**
 * Whether a rule's conditions hold for a target, ignoring whether it is
 * enabled — the editor's match preview has to work on a draft that is still
 * switched off. A rule with no conditions matches nothing rather than
 * everything, so an unfinished rule can't claim the whole ledger.
 */
export function ruleMatches(
  rule: Pick<Rule, 'matchMode' | 'conditions'>,
  target: MatchTarget
): boolean {
  if (rule.conditions.length === 0) return false;

  return rule.matchMode === 'all'
    ? rule.conditions.every((condition) => testCondition(condition, target))
    : rule.conditions.some((condition) => testCondition(condition, target));
}

/**
 * The highest-priority enabled rule whose conditions the draft satisfies, or
 * null. Disabled rules are never consulted.
 */
export function matchRule(rules: Rule[], draft: MatchTarget): RuleFill | null {
  const candidate = [...rules]
    .filter((rule) => rule.isEnabled)
    .sort((a, b) => b.priority - a.priority)
    .find((rule) => ruleMatches(rule, draft));

  return candidate ? toFill(candidate) : null;
}

/** How many of a set of expenses a rule would claim — the editor's preview. */
export const countMatches = (
  rule: Pick<Rule, 'matchMode' | 'conditions'>,
  targets: MatchTarget[]
) => targets.filter((target) => ruleMatches(rule, target)).length;
