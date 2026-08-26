/**
 * Mock data for the Rules screen.
 *
 * Design-pass placeholder — shaped after the `rules` / `rule_conditions` /
 * `rule_actions` tables in §5 of the MVP plan, so swapping it for a real query
 * is a one-file change. Conditions and actions are child collections here for
 * the same reason they are child tables there: amount conditions and alert
 * actions arrive later without reshaping a rule.
 */

import type { CategoryId } from './categories';

export type RuleConditionField = 'item' | 'note';
export type RuleConditionOperator = 'contains' | 'equals' | 'starts_with';

export type RuleCondition = {
  field: RuleConditionField;
  operator: RuleConditionOperator;
  value: string;
};

/**
 * `set_account` carries a label rather than an id — accounts become a real
 * entity in M3, and until then there is nothing to reference.
 */
export type RuleAction =
  | { type: 'set_category'; categoryId: CategoryId }
  | { type: 'set_account'; label: string }
  | { type: 'set_counts_to_budget'; countsToBudget: boolean };

export type Rule = {
  id: string;
  name: string;
  /** Higher wins. Evaluation is highest-first, first match wins. */
  priority: number;
  isEnabled: boolean;
  /** Whether every condition must match, or any one of them. */
  matchMode: 'all' | 'any';
  conditions: RuleCondition[];
  actions: RuleAction[];
  timesApplied: number;
};

/** Reads as a sentence next to a field name: `item contains "swiggy"`. */
export const OPERATOR_LABELS: Record<RuleConditionOperator, string> = {
  contains: 'contains',
  equals: 'is',
  starts_with: 'starts with',
};

export const rules: Rule[] = [
  {
    id: 'r-1',
    name: 'Food delivery',
    priority: 100,
    isEnabled: true,
    matchMode: 'any',
    conditions: [
      { field: 'item', operator: 'contains', value: 'swiggy' },
      { field: 'item', operator: 'contains', value: 'zomato' },
    ],
    actions: [
      { type: 'set_category', categoryId: 'food' },
      { type: 'set_account', label: 'HDFC Millennia' },
    ],
    timesApplied: 34,
  },
  {
    id: 'r-2',
    name: 'Cabs & metro',
    priority: 90,
    isEnabled: true,
    matchMode: 'any',
    conditions: [
      { field: 'item', operator: 'contains', value: 'uber' },
      { field: 'item', operator: 'contains', value: 'metro' },
    ],
    actions: [
      { type: 'set_category', categoryId: 'transport' },
      { type: 'set_account', label: 'Cash' },
    ],
    timesApplied: 21,
  },
  {
    id: 'r-3',
    name: 'Utility bills',
    priority: 80,
    isEnabled: true,
    matchMode: 'all',
    conditions: [{ field: 'item', operator: 'starts_with', value: 'electricity' }],
    actions: [
      { type: 'set_category', categoryId: 'bills' },
      { type: 'set_account', label: 'ICICI Bank' },
    ],
    timesApplied: 12,
  },
  {
    id: 'r-4',
    name: 'Monthly rent',
    priority: 70,
    isEnabled: true,
    matchMode: 'all',
    conditions: [{ field: 'item', operator: 'equals', value: 'rent' }],
    actions: [{ type: 'set_category', categoryId: 'housing' }],
    timesApplied: 6,
  },
  {
    id: 'r-5',
    name: 'One-off big buys',
    priority: 50,
    isEnabled: false,
    matchMode: 'all',
    conditions: [{ field: 'note', operator: 'contains', value: 'one-off' }],
    actions: [{ type: 'set_counts_to_budget', countsToBudget: false }],
    timesApplied: 3,
  },
  {
    id: 'r-6',
    name: 'Pharmacy runs',
    priority: 40,
    isEnabled: false,
    matchMode: 'all',
    conditions: [{ field: 'item', operator: 'contains', value: 'pharmacy' }],
    actions: [{ type: 'set_category', categoryId: 'health' }],
    timesApplied: 0,
  },
];
