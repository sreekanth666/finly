/**
 * How a rule reads on screen.
 */

import type { RuleConditionOperator } from '@/domain/rules';

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
