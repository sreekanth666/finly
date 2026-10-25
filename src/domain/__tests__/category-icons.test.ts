import { SEED_CATEGORIES } from '@/domain/categories';
import {
  CATEGORY_ICONS,
  FALLBACK_ICON_NAME,
  iconLabel,
  searchIcons,
  suggestIcon,
} from '@/domain/category-icons';

describe('searchIcons', () => {
  it('returns every icon, in catalogue order, for a blank query', () => {
    expect(searchIcons('')).toEqual(CATEGORY_ICONS.map((icon) => icon.name));
    expect(searchIcons('   ')).toHaveLength(20);
  });

  it('ignores case and surrounding whitespace', () => {
    expect(searchIcons('RENT ')[0]).toBe('House');
  });

  it('finds an icon by a word people use for it, not only its label', () => {
    expect(searchIcons('net')).toContain('Popcorn');
    expect(searchIcons('emi')).toEqual(['Landmark']);
  });

  it('ranks a label prefix above a keyword prefix above a substring', () => {
    // "Repairs" is a label; "rent" and "recharge" only keywords.
    expect(searchIcons('re')[0]).toBe('Wrench');
    expect(searchIcons('re')).toContain('House');
    // "Entertainment" is a label; "rent" only contains it.
    expect(searchIcons('ent')[0]).toBe('Popcorn');
    expect(searchIcons('ent')).toContain('House');
  });

  it('returns nothing when nothing matches', () => {
    expect(searchIcons('zzz')).toEqual([]);
  });
});

describe('suggestIcon', () => {
  it('suggests from any whole word of the name', () => {
    expect(suggestIcon('Coffee & snacks')).toBe('UtensilsCrossed');
    expect(suggestIcon('Uber rides')).toBe('Car');
    expect(suggestIcon('Netflix')).toBe('Popcorn');
    expect(suggestIcon('Home loan EMI')).toBe('House');
  });

  it('does not match part of a word', () => {
    expect(suggestIcon('Business')).toBeNull();
    expect(suggestIcon('Carpentry')).toBeNull();
  });

  it('suggests nothing for a blank or unknown name', () => {
    expect(suggestIcon('')).toBeNull();
    expect(suggestIcon('   ')).toBeNull();
    expect(suggestIcon('Zorbing')).toBeNull();
  });
});

describe('the catalogue', () => {
  const names = CATEGORY_ICONS.map((icon) => icon.name);

  it('covers every icon the seeded categories use', () => {
    for (const category of SEED_CATEGORIES) {
      expect(names).toContain(category.icon);
    }
  });

  it('gives every icon its own name and label', () => {
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(CATEGORY_ICONS.map((icon) => icon.label)).size).toBe(names.length);
  });

  it('never lets two icons claim the same keyword, so a suggestion is never a coin toss', () => {
    const keywords = CATEGORY_ICONS.flatMap((icon) => [...icon.keywords]);
    expect(new Set(keywords).size).toBe(keywords.length);
  });

  it('labels an unknown name as the fallback', () => {
    expect(iconLabel('NoSuchIcon')).toBe(iconLabel(FALLBACK_ICON_NAME));
  });
});
