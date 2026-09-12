/**
 * How a rule reads on screen.
 */

import type {
  RuleCondition,
  RuleConditionField,
  RuleConditionOperator,
  RuleMatchMode,
} from '@/domain/rules';

/** Reads as a sentence next to a field name: `item contains "swiggy"`. */
export const OPERATOR_LABELS: Record<RuleConditionOperator, string> = {
  contains: 'contains',
  equals: 'is',
  starts_with: 'starts with',
};

export const OPERATOR_OPTIONS = (Object.keys(OPERATOR_LABELS) as RuleConditionOperator[]).map(
  (id) => ({ id, label: OPERATOR_LABELS[id] }),
);

export const FIELD_OPTIONS = [
  { id: 'item' as const, label: 'Item' },
  { id: 'note' as const, label: 'Note' },
];

/** Reads as a sentence: `item contains "swiggy"`. */
export const describeCondition = ({ field, operator, value }: RuleCondition) =>
  `${field} ${OPERATOR_LABELS[operator]} "${value}"`;

/** Every condition, joined the way the match mode reads — RuleCard's line. */
export const describeConditions = (
  conditions: readonly RuleCondition[],
  matchMode: RuleMatchMode,
) => conditions.map(describeCondition).join(matchMode === 'all' ? ' and ' : ' or ');

const FIELD_LABELS: Record<RuleConditionField, string> = { item: 'Item', note: 'Note' };

/**
 * A short form for a list of many rules: the first few values, then a count.
 * "contains" is the default and goes unsaid; the other operators are named,
 * because they are the reason a value is written the way it is.
 *
 * `Item, any of: “swiggy”, “zomato”, “eatsure”, “uber eats” +2 more`
 */
export function summariseConditions(
  conditions: readonly RuleCondition[],
  matchMode: RuleMatchMode,
  limit = 4,
): string {
  const fields = new Set(conditions.map((condition) => condition.field));
  const sharedField = fields.size === 1 ? [...fields][0] : null;

  const parts = conditions.slice(0, limit).map(({ field, operator, value }) => {
    const quoted = operator === 'contains' ? `“${value}”` : `${OPERATOR_LABELS[operator]} “${value}”`;
    return sharedField === null ? `${FIELD_LABELS[field]} ${quoted}` : quoted;
  });
  const rest = conditions.length - parts.length;

  const lead = `${sharedField === null ? '' : `${FIELD_LABELS[sharedField]}, `}${matchMode === 'all' ? 'all of' : 'any of'}:`;
  return `${lead} ${parts.join(', ')}${rest > 0 ? ` +${rest} more` : ''}`;
}
