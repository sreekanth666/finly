import { findCategoryByName } from '@/domain/categories';

describe('findCategoryByName', () => {
  const rows = [
    { id: 'c-food', name: 'Food', isArchived: false },
    { id: 'c-pets', name: 'Pets', isArchived: true },
    { id: 'c-travel', name: '  Travel ', isArchived: false },
  ];

  it('finds a category regardless of case', () => {
    expect(findCategoryByName(rows, 'food')?.id).toBe('c-food');
    expect(findCategoryByName(rows, 'FOOD')?.id).toBe('c-food');
  });

  it('ignores surrounding whitespace on either side', () => {
    expect(findCategoryByName(rows, '  Food  ')?.id).toBe('c-food');
    expect(findCategoryByName(rows, 'travel')?.id).toBe('c-travel');
  });

  it('includes archived rows, so a restore can be offered instead of a duplicate', () => {
    expect(findCategoryByName(rows, 'pets')).toEqual(rows[1]);
  });

  it('does not match a partial name', () => {
    expect(findCategoryByName(rows, 'Foo')).toBeNull();
    expect(findCategoryByName(rows, 'Food court')).toBeNull();
  });

  it('never matches a blank name', () => {
    expect(findCategoryByName([...rows, { id: 'c-blank', name: '', isArchived: false }], '   ')).toBeNull();
  });
});
