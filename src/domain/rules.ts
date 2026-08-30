/**
 * Rule evaluation — pure, and deliberately free of React and of storage.
 *
 * §4.6: highest priority first, first match wins, matching case-insensitively.
 * Keeping it here rather than in the screen is what lets it be unit-tested and
 * reused by the editor's "how many existing expenses would match" preview.
 *
 * Actions reference categories and accounts by **id**. The design pass carried a
 * display name for the account, which meant renaming a card silently detached
 * every rule that filled it in.
 */

export type RuleConditionField = 'item' | 'note';
export type RuleConditionOperator = 'contains' | 'equals' | 'starts_with';
export type RuleMatchMode = 'all' | 'any';

export type RuleCondition = {
  field: RuleConditionField;
  operator: RuleConditionOperator;
  value: string;
};

export type RuleAction =
  | { type: 'set_category'; categoryId: string }
  | { type: 'set_account'; accountId: string }
  | { type: 'set_counts_to_budget'; countsToBudget: boolean };

export type Rule = {
  id: string;
  name: string;
  /** Higher wins. Evaluation is highest-first, first match wins. */
  priority: number;
  isEnabled: boolean;
  /** Whether every condition must match, or any one of them. */
  matchMode: RuleMatchMode;
  conditions: RuleCondition[];
  actions: RuleAction[];
  timesApplied: number;
};

/** What a matching rule wants to fill in. Every field is optional. */
export type RuleFill = {
  rule: Rule;
  categoryId?: string;
  accountId?: string;
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

/** Later actions of the same type win, so a malformed rule still resolves. */
const toFill = (rule: Rule): RuleFill =>
  rule.actions.reduce<RuleFill>(
    (fill, action) => {
      switch (action.type) {
        case 'set_category':
          return { ...fill, categoryId: action.categoryId };
        case 'set_account':
          return { ...fill, accountId: action.accountId };
        case 'set_counts_to_budget':
          return { ...fill, countsToBudget: action.countsToBudget };
      }
    },
    { rule },
  );

/**
 * Whether a rule's conditions hold for a target, ignoring whether it is
 * enabled — the editor's match preview has to work on a draft that is still
 * switched off. A rule with no conditions matches nothing rather than
 * everything, so an unfinished rule can't claim the whole ledger.
 */
export function ruleMatches(
  rule: Pick<Rule, 'matchMode' | 'conditions'>,
  target: MatchTarget,
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
export function matchRule(rules: readonly Rule[], draft: MatchTarget): RuleFill | null {
  const candidate = [...rules]
    .filter((rule) => rule.isEnabled)
    .sort((a, b) => b.priority - a.priority)
    .find((rule) => ruleMatches(rule, draft));

  return candidate ? toFill(candidate) : null;
}

/** How many of a set of expenses a rule would claim — the editor's preview. */
export const countMatches = (
  rule: Pick<Rule, 'matchMode' | 'conditions'>,
  targets: readonly MatchTarget[],
) => targets.filter((target) => ruleMatches(rule, target)).length;
