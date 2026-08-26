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

type Draft = { item: string; note: string };

const testCondition = ({ field, operator, value }: RuleCondition, draft: Draft) => {
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
 * The highest-priority enabled rule whose conditions the draft satisfies, or
 * null. Disabled rules are never consulted.
 */
export function matchRule(rules: Rule[], draft: Draft): RuleFill | null {
  const candidate = [...rules]
    .filter((rule) => rule.isEnabled)
    .sort((a, b) => b.priority - a.priority)
    .find((rule) =>
      rule.matchMode === 'all'
        ? rule.conditions.every((condition) => testCondition(condition, draft))
        : rule.conditions.some((condition) => testCondition(condition, draft))
    );

  return candidate ? toFill(candidate) : null;
}
