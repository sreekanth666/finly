import { SEED_CATEGORIES } from '@/domain/categories';
import {
  addedRuleIds,
  findRuleTemplate,
  resolveRuleTemplate,
  RULE_TEMPLATES,
  type ResolvedRuleTemplate,
} from '@/domain/rule-templates';
import { matchRule, ruleInputProblem, type Rule, type RuleAction } from '@/domain/rules';

/* The seeded catalogue, with each category's id being its name — so a match
   result can be read off directly. */
const SEEDED = SEED_CATEGORIES.map((category) => ({ id: category.name, name: category.name }));

const actionsOf = (resolved: ResolvedRuleTemplate): RuleAction[] => [
  ...(resolved.categoryId === null
    ? []
    : [{ type: 'set_category' as const, categoryId: resolved.categoryId }]),
  ...(resolved.countsToBudget === null
    ? []
    : [{ type: 'set_counts_to_budget' as const, countsToBudget: resolved.countsToBudget }]),
];

/** Every template as a live rule, the way someone who added them all would have it. */
const ALL_RULES: Rule[] = RULE_TEMPLATES.map((template) => {
  const resolved = resolveRuleTemplate(template, SEEDED);
  return {
    id: template.id,
    name: resolved.name,
    priority: resolved.priority,
    isEnabled: true,
    matchMode: resolved.matchMode,
    conditions: resolved.conditions,
    actions: actionsOf(resolved),
    timesApplied: 0,
  };
});

const winnerFor = (item: string) => matchRule(ALL_RULES, { item, note: '' });

describe('the template catalogue', () => {
  it('names only categories a fresh install has', () => {
    const seeded = SEED_CATEGORIES.map((category) => category.name);
    for (const template of RULE_TEMPLATES) {
      expect(seeded).toContain(template.categoryName);
    }
  });

  it('has unique ids, names and priorities, all within the editor’s range', () => {
    const ids = RULE_TEMPLATES.map((template) => template.id);
    const names = RULE_TEMPLATES.map((template) => template.name.toLowerCase());
    const priorities = RULE_TEMPLATES.map((template) => template.priority);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
    /* Equal priorities have no guaranteed order — the help sheet says so —
       so a catalogue that teaches priority can't contain a tie. */
    expect(new Set(priorities).size).toBe(priorities.length);
    for (const priority of priorities) {
      expect(priority).toBeGreaterThanOrEqual(0);
      expect(priority).toBeLessThanOrEqual(999);
    }
  });

  it('is listed in the order the rules would run', () => {
    const priorities = RULE_TEMPLATES.map((template) => template.priority);
    expect(priorities).toEqual([...priorities].sort((a, b) => b - a));
  });

  it('writes every value the way the engine will compare it: trimmed and lowercase', () => {
    for (const template of RULE_TEMPLATES) {
      for (const { value } of template.conditions) {
        expect(value.length).toBeGreaterThan(0);
        expect(value).toBe(value.trim().toLowerCase());
      }
    }
  });

  it('never uses a “contains” needle short enough to hide inside other words', () => {
    const risky = ['rent', 'ola', 'jio', 'hp', 'bp', 'shell', 'cab', 'gas', 'prime', 'mcd', 'aldi', 'etsy', 'vi'];

    for (const template of RULE_TEMPLATES) {
      for (const { operator, value } of template.conditions) {
        if (operator !== 'contains') continue;
        expect(value.length).toBeGreaterThanOrEqual(3);
        expect(risky).not.toContain(value);
      }
    }
  });

  it('never sets an account, because a fresh install has none', () => {
    for (const template of RULE_TEMPLATES) {
      expect(Object.keys(template)).not.toContain('accountName');
    }
  });

  it('explains itself — every template carries a lesson', () => {
    for (const template of RULE_TEMPLATES) {
      expect(template.lesson.trim().length).toBeGreaterThan(0);
    }
  });
});

describe('resolveRuleTemplate', () => {
  it('produces a rule the repository would accept, for every template', () => {
    for (const template of RULE_TEMPLATES) {
      const resolved = resolveRuleTemplate(template, SEEDED);
      expect(ruleInputProblem({ ...resolved, actions: actionsOf(resolved) })).toBeNull();
    }
  });

  it('finds the category by name, whatever its case', () => {
    const food = RULE_TEMPLATES.find((template) => template.categoryName === 'Food');
    if (food === undefined) throw new Error('the catalogue has no Food template');

    expect(resolveRuleTemplate(food, [{ id: 'c-1', name: '  food ' }]).categoryId).toBe('c-1');
  });

  it('leaves the category unset when it has been renamed away', () => {
    const food = RULE_TEMPLATES.find((template) => template.categoryName === 'Food');
    if (food === undefined) throw new Error('the catalogue has no Food template');

    expect(resolveRuleTemplate(food, [{ id: 'c-1', name: 'Eating out' }]).categoryId).toBeNull();
  });

  it('hands back copies, so editing the draft never edits the catalogue', () => {
    const template = RULE_TEMPLATES[0];
    const before = JSON.stringify(template);

    const resolved = resolveRuleTemplate(template, SEEDED);
    resolved.conditions[0].value = 'changed';
    resolved.conditions.push({ field: 'note', operator: 'contains', value: 'extra' });

    expect(JSON.stringify(template)).toBe(before);
  });
});

describe('findRuleTemplate', () => {
  it('finds by id, and returns null for anything else', () => {
    expect(findRuleTemplate(RULE_TEMPLATES[0].id)).toBe(RULE_TEMPLATES[0]);
    expect(findRuleTemplate('no-such-template')).toBeNull();
    expect(findRuleTemplate(undefined)).toBeNull();
  });
});

describe('addedRuleIds', () => {
  it('pairs a template with a rule of the same name, ignoring case and spacing', () => {
    const [first, second] = RULE_TEMPLATES;
    const added = addedRuleIds([
      { id: 'r-1', name: `  ${first.name.toUpperCase()} ` },
      { id: 'r-2', name: 'Something of my own' },
    ]);

    expect(added.get(first.id)).toBe('r-1');
    expect(added.has(second.id)).toBe(false);
  });
});

describe('the catalogue as a whole, added together', () => {
  it.each([
    ['Swiggy Instamart order', 'Groceries'],
    ['Amazon Fresh', 'Groceries'],
    ['Zepto', 'Groceries'],
    ['Walmart', 'Groceries'],
    ['Swiggy dinner', 'Food'],
    ['Uber Eats', 'Food'],
    ['McDonald’s', 'Food'],
    ["McDonald's", 'Food'],
    ['McD', 'Food'],
    ['Starbucks', 'Food'],
    ['Uber to office', 'Transport'],
    ['Uber to Starbucks', 'Transport'],
    ['Ola', 'Transport'],
    ['Metro recharge', 'Transport'],
    ['FASTag recharge', 'Transport'],
    ['Shell', 'Transport'],
    ['Jio recharge', 'Bills'],
    ['Torrent Power bill', 'Bills'],
    ['Amazon Prime', 'Bills'],
    ['Netflix', 'Bills'],
    ['Amazon headphones', 'Shopping'],
    ['Amazon Prime Day TV', 'Shopping'],
    ['Ajio kurta', 'Shopping'],
    ['Walmart pharmacy', 'Health'],
    ['Apollo pharmacy', 'Health'],
    ['Monthly rent', 'Housing'],
  ])('files “%s” under %s', (item, category) => {
    expect(winnerFor(item)?.categoryId).toBe(category);
  });

  it('keeps rent out of the budget', () => {
    expect(winnerFor('Monthly rent')?.countsToBudget).toBe(false);
    expect(winnerFor('Rent')?.countsToBudget).toBe(false);
  });

  it.each([
    'Granola bar',
    'Coca-Cola',
    'Motorola charger',
    'Parent-teacher meeting fee',
    'Rental car',
    'Maldives trip',
    'Seashell souvenir',
    'McDowell’s',
    'Betsy gift',
    'HP printer ink',
    'BP monitor',
    'Cabbage',
  ])('leaves “%s” alone', (item) => {
    expect(winnerFor(item)).toBeNull();
  });
});
