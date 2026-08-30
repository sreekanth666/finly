import { countMatches, matchRule, ruleMatches, type Rule } from '@/domain/rules';

const rule = (overrides: Partial<Rule> = {}): Rule => ({
  id: 'r-1',
  name: 'Food delivery',
  priority: 50,
  isEnabled: true,
  matchMode: 'all',
  conditions: [{ field: 'item', operator: 'contains', value: 'swiggy' }],
  actions: [{ type: 'set_category', categoryId: 'cat-food' }],
  timesApplied: 0,
  ...overrides,
});

const target = (item: string, note = '') => ({ item, note });

describe('ruleMatches', () => {
  it('matches case- and whitespace-insensitively', () => {
    expect(ruleMatches(rule(), target('Swiggy dinner'))).toBe(true);
    expect(ruleMatches(rule(), target('  SWIGGY  '))).toBe(true);
    expect(ruleMatches(rule(), target('Zomato'))).toBe(false);
  });

  it('supports contains, equals and starts_with', () => {
    const on = (operator: 'contains' | 'equals' | 'starts_with', value: string) =>
      rule({ conditions: [{ field: 'item', operator, value }] });

    expect(ruleMatches(on('contains', 'ber'), target('Uber'))).toBe(true);
    expect(ruleMatches(on('equals', 'uber'), target('Uber'))).toBe(true);
    expect(ruleMatches(on('equals', 'uber'), target('Uber Eats'))).toBe(false);
    expect(ruleMatches(on('starts_with', 'uber'), target('Uber Eats'))).toBe(true);
    expect(ruleMatches(on('starts_with', 'eats'), target('Uber Eats'))).toBe(false);
  });

  it('reads the note as well as the item', () => {
    const noteRule = rule({ conditions: [{ field: 'note', operator: 'contains', value: 'work' }] });
    expect(ruleMatches(noteRule, target('Taxi', 'work trip'))).toBe(true);
    expect(ruleMatches(noteRule, target('Taxi', ''))).toBe(false);
  });

  it('requires every condition under "all" and any under "any"', () => {
    const conditions = [
      { field: 'item' as const, operator: 'contains' as const, value: 'uber' },
      { field: 'note' as const, operator: 'contains' as const, value: 'work' },
    ];

    expect(ruleMatches(rule({ matchMode: 'all', conditions }), target('Uber', 'work'))).toBe(true);
    expect(ruleMatches(rule({ matchMode: 'all', conditions }), target('Uber', ''))).toBe(false);
    expect(ruleMatches(rule({ matchMode: 'any', conditions }), target('Uber', ''))).toBe(true);
    expect(ruleMatches(rule({ matchMode: 'any', conditions }), target('Taxi', 'work'))).toBe(true);
    expect(ruleMatches(rule({ matchMode: 'any', conditions }), target('Taxi', ''))).toBe(false);
  });

  it('matches nothing when it has no conditions, rather than everything', () => {
    // An unfinished rule in the editor must not claim the whole ledger.
    expect(ruleMatches(rule({ conditions: [] }), target('anything at all'))).toBe(false);
  });

  it('ignores a condition with an empty value', () => {
    expect(ruleMatches(rule({ conditions: [{ field: 'item', operator: 'contains', value: '  ' }] }), target('x'))).toBe(false);
  });

  it('ignores whether the rule is enabled, so a draft can be previewed', () => {
    expect(ruleMatches(rule({ isEnabled: false }), target('Swiggy'))).toBe(true);
  });
});

describe('matchRule', () => {
  it('takes the highest priority match', () => {
    const low = rule({ id: 'low', priority: 10, actions: [{ type: 'set_category', categoryId: 'cat-low' }] });
    const high = rule({ id: 'high', priority: 90, actions: [{ type: 'set_category', categoryId: 'cat-high' }] });

    expect(matchRule([low, high], target('Swiggy'))?.rule.id).toBe('high');
    // Order in the array must not matter — only priority.
    expect(matchRule([high, low], target('Swiggy'))?.rule.id).toBe('high');
  });

  it('never consults a disabled rule', () => {
    const disabled = rule({ id: 'off', priority: 99, isEnabled: false });
    const enabled = rule({ id: 'on', priority: 1 });

    expect(matchRule([disabled, enabled], target('Swiggy'))?.rule.id).toBe('on');
  });

  it('returns null when nothing matches', () => {
    expect(matchRule([rule()], target('Zomato'))).toBeNull();
    expect(matchRule([], target('Swiggy'))).toBeNull();
  });

  it('flattens every action into the fill', () => {
    const fill = matchRule(
      [
        rule({
          actions: [
            { type: 'set_category', categoryId: 'cat-food' },
            { type: 'set_account', accountId: 'acc-hdfc' },
            { type: 'set_counts_to_budget', countsToBudget: false },
          ],
        }),
      ],
      target('Swiggy'),
    );

    expect(fill?.categoryId).toBe('cat-food');
    expect(fill?.accountId).toBe('acc-hdfc');
    expect(fill?.countsToBudget).toBe(false);
  });

  it('lets a later action of the same type win', () => {
    const fill = matchRule(
      [
        rule({
          actions: [
            { type: 'set_category', categoryId: 'first' },
            { type: 'set_category', categoryId: 'second' },
          ],
        }),
      ],
      target('Swiggy'),
    );

    expect(fill?.categoryId).toBe('second');
  });

  it('leaves untouched fields undefined rather than guessing', () => {
    const fill = matchRule([rule()], target('Swiggy'));
    expect(fill?.accountId).toBeUndefined();
    expect(fill?.countsToBudget).toBeUndefined();
  });
});

describe('countMatches', () => {
  it('counts what a rule would claim', () => {
    const targets = [target('Swiggy'), target('Swiggy again'), target('Zomato'), target('Uber')];
    expect(countMatches(rule(), targets)).toBe(2);
    expect(countMatches(rule({ conditions: [] }), targets)).toBe(0);
    expect(countMatches(rule(), [])).toBe(0);
  });
});
