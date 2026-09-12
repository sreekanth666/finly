/**
 * Ready-made rules, offered from the Rules tab to someone starting out.
 *
 * Each one is a real rule, and each teaches one thing about writing rules:
 * matching any of several names, narrowing with "Match all", using "is" or
 * "starts with" where "contains" would catch the wrong things, putting a
 * specific rule above a general one, keeping something out of the budget.
 * Taken together they are meant to be added side by side, so their priorities
 * are chosen against each other — and tested that way.
 *
 * `contains` is a plain substring test on lowercased text, and the engine trims
 * every value, so a trailing space cannot stand in for a word boundary. Any name
 * short enough to hide inside another word ("ola" in granola, "rent" in parent)
 * is matched with `is` or `starts with` instead, and the lesson says why.
 *
 * Categories are named, not referenced: seeded categories get a fresh id on
 * every install, and the user may have renamed one since. They are resolved at
 * the moment a template is opened. No template sets an account — none are
 * seeded, so there is nothing to name.
 */

import { findCategoryByName } from './categories';
import type { RuleCondition, RuleMatchMode } from './rules';

export type RuleTemplate = {
  id: string;
  name: string;
  /** A seeded category, resolved by name when the template is used. */
  categoryName: string;
  matchMode: RuleMatchMode;
  conditions: readonly RuleCondition[];
  priority: number;
  /** false keeps matching spend out of the monthly cap (D3); null leaves it alone. */
  countsToBudget: boolean | null;
  /** The one thing this template shows about building a rule. */
  lesson: string;
};

const has = (value: string): RuleCondition => ({ field: 'item', operator: 'contains', value });
const is = (value: string): RuleCondition => ({ field: 'item', operator: 'equals', value });
const startsWith = (value: string): RuleCondition => ({
  field: 'item',
  operator: 'starts_with',
  value,
});

/** In the order they would run — highest priority first — as the sheet lists them. */
export const RULE_TEMPLATES: readonly RuleTemplate[] = [
  {
    id: 'quick-commerce',
    name: 'Quick-commerce groceries',
    categoryName: 'Groceries',
    matchMode: 'any',
    priority: 85,
    countsToBudget: null,
    conditions: [
      has('instamart'),
      has('zepto'),
      has('blinkit'),
      has('bigbasket'),
      has('big basket'),
      has('amazon fresh'),
      has('flipkart minutes'),
      has('jiomart'),
    ],
    lesson:
      'A specific rule placed high. “Swiggy Instamart” is caught here before Food delivery ever sees “swiggy”, and “Amazon Fresh” before Online shopping sees “amazon”.',
  },
  {
    id: 'rent',
    name: 'Rent',
    categoryName: 'Housing',
    matchMode: 'any',
    priority: 80,
    countsToBudget: false,
    conditions: [
      is('rent'),
      startsWith('house rent'),
      startsWith('flat rent'),
      startsWith('monthly rent'),
      startsWith('pg rent'),
    ],
    lesson:
      'Keeps rent out of your monthly budget. It avoids “contains rent”, which would also catch parent, current bill and Torrent Power.',
  },
  {
    id: 'metro-recharge',
    name: 'Metro card recharge',
    categoryName: 'Transport',
    matchMode: 'all',
    priority: 75,
    countsToBudget: null,
    conditions: [has('metro'), has('recharge')],
    lesson:
      '“Match all” narrows two broad words to one meaning: “metro” alone catches Metro Shoes, “recharge” alone your phone plan.',
  },
  {
    id: 'fuel-tolls',
    name: 'Fuel & tolls',
    categoryName: 'Transport',
    matchMode: 'any',
    priority: 70,
    countsToBudget: null,
    conditions: [
      has('petrol'),
      has('diesel'),
      has('fuel'),
      has('cng'),
      has('indian oil'),
      has('hpcl'),
      has('bpcl'),
      has('fastag'),
      has('toll'),
      is('shell'),
      is('bp'),
    ],
    lesson:
      'Short brand names use “is”: “contains bp” would catch a BP monitor, and “contains shell” a seashell.',
  },
  {
    id: 'streaming',
    name: 'Streaming & subscriptions',
    categoryName: 'Bills',
    matchMode: 'any',
    priority: 65,
    countsToBudget: null,
    conditions: [
      has('netflix'),
      has('spotify'),
      has('hotstar'),
      has('prime video'),
      has('youtube premium'),
      has('apple music'),
      has('icloud'),
      has('disney+'),
      is('amazon prime'),
    ],
    lesson:
      '“is amazon prime” catches the membership, while “Amazon Prime Day TV” still falls through to Online shopping.',
  },
  {
    id: 'food-delivery',
    name: 'Food delivery',
    categoryName: 'Food',
    matchMode: 'any',
    priority: 60,
    countsToBudget: null,
    conditions: [
      has('swiggy'),
      has('zomato'),
      has('eatsure'),
      has('uber eats'),
      has('doordash'),
      has('deliveroo'),
    ],
    lesson:
      '“Match any” of several names. It sits above Cabs & rides, so “Uber Eats” is food rather than a ride.',
  },
  {
    id: 'health',
    name: 'Pharmacy & doctor',
    categoryName: 'Health',
    matchMode: 'any',
    priority: 55,
    countsToBudget: null,
    conditions: [
      has('pharmacy'),
      has('chemist'),
      has('medplus'),
      has('pharmeasy'),
      has('netmeds'),
      has('1mg'),
      has('doctor'),
      has('hospital'),
      has('walgreens'),
      has('cvs'),
    ],
    lesson:
      'Everyday words like “pharmacy” cover shops you haven’t named. Above Supermarkets, so “Walmart pharmacy” counts as health.',
  },
  {
    id: 'cabs',
    name: 'Cabs & rides',
    categoryName: 'Transport',
    matchMode: 'any',
    priority: 50,
    countsToBudget: null,
    conditions: [
      startsWith('uber'),
      is('ola'),
      startsWith('ola cab'),
      startsWith('ola auto'),
      has('rapido'),
      has('namma yatri'),
      has('lyft'),
      has('taxi'),
    ],
    lesson:
      '“ola” hides inside granola, Coca-Cola and Motorola, so it’s matched with “is” and “starts with” instead.',
  },
  {
    id: 'phone-bills',
    name: 'Phone & utility bills',
    categoryName: 'Bills',
    matchMode: 'any',
    priority: 45,
    countsToBudget: null,
    conditions: [
      has('recharge'),
      has('airtel'),
      is('jio'),
      startsWith('jio fiber'),
      is('vi'),
      has('bsnl'),
      has('broadband'),
      has('electricity'),
      has('power bill'),
      has('current bill'),
      has('water bill'),
      has('lpg'),
      has('verizon'),
    ],
    lesson:
      'A broad word, placed low on purpose: the metro and FASTag rules above get first say on anything called a recharge. “jio” uses “is” because it hides inside Ajio.',
  },
  {
    id: 'coffee-fast-food',
    name: 'Coffee & fast food',
    categoryName: 'Food',
    matchMode: 'any',
    priority: 40,
    countsToBudget: null,
    conditions: [
      has('starbucks'),
      has('mcdonald'),
      is('mcd'),
      has('kfc'),
      has('burger king'),
      has('domino'),
      has('pizza hut'),
      has('chaayos'),
      has('costa coffee'),
      has('tim hortons'),
    ],
    lesson:
      'Match the stem: “mcdonald” covers McDonald’s and McDonalds alike. “mcd” uses “is”, or it would claim McDowell’s.',
  },
  {
    id: 'supermarkets',
    name: 'Supermarkets',
    categoryName: 'Groceries',
    matchMode: 'any',
    priority: 35,
    countsToBudget: null,
    conditions: [
      has('dmart'),
      has('big bazaar'),
      has('smart bazaar'),
      has('reliance fresh'),
      has('spencer'),
      has('kirana'),
      has('grocer'),
      has('walmart'),
      has('costco'),
      has('tesco'),
      has('lidl'),
      startsWith('aldi'),
    ],
    lesson:
      '“grocer” catches grocery, groceries and grocer in one go. “aldi” uses “starts with”, since it hides inside Maldives.',
  },
  {
    id: 'online-shopping',
    name: 'Online shopping',
    categoryName: 'Shopping',
    matchMode: 'any',
    priority: 30,
    countsToBudget: null,
    conditions: [
      has('amazon'),
      has('flipkart'),
      has('myntra'),
      has('ajio'),
      has('meesho'),
      has('nykaa'),
      has('ikea'),
      has('ebay'),
      startsWith('etsy'),
    ],
    lesson:
      'The general catch-all goes lowest, so every more specific Amazon or Flipkart rule above it gets first say.',
  },
];

export function findRuleTemplate(id: string | undefined): RuleTemplate | null {
  return RULE_TEMPLATES.find((template) => template.id === id) ?? null;
}

/** A template made concrete against this install's categories. */
export type ResolvedRuleTemplate = {
  name: string;
  priority: number;
  matchMode: RuleMatchMode;
  conditions: RuleCondition[];
  /** Null when no active category carries the template's name any more. */
  categoryId: string | null;
  countsToBudget: boolean | null;
};

/**
 * @param activeCategories the categories a rule could point at — archived ones
 * excluded, so a template never quietly targets something the user put away.
 */
export function resolveRuleTemplate(
  template: RuleTemplate,
  activeCategories: readonly { id: string; name: string }[],
): ResolvedRuleTemplate {
  return {
    name: template.name,
    priority: template.priority,
    matchMode: template.matchMode,
    /* Copies: the result becomes an editable draft, and the catalogue is
       shared by every render of the sheet. */
    conditions: template.conditions.map((condition) => ({ ...condition })),
    categoryId: findCategoryByName(activeCategories, template.categoryName)?.id ?? null,
    countsToBudget: template.countsToBudget,
  };
}

/**
 * Which templates are already among the user's rules: template id → rule id.
 *
 * Matched by name, which is what a template leaves behind — there is no
 * column recording where a rule came from. A rule renamed afterwards stops
 * counting, and the template is simply offered again.
 */
export function addedRuleIds(
  rules: readonly { id: string; name: string }[],
): Map<string, string> {
  const normalise = (name: string) => name.trim().toLowerCase();
  const byName = new Map(rules.map((rule) => [normalise(rule.name), rule.id]));
  const added = new Map<string, string>();

  for (const template of RULE_TEMPLATES) {
    const ruleId = byName.get(normalise(template.name));
    if (ruleId !== undefined) added.set(template.id, ruleId);
  }

  return added;
}
