import { isAtEdge, moveItem } from '@/domain/reorder';

describe('moveItem', () => {
  const list = ['a', 'b', 'c', 'd'];

  it('swaps with the neighbour in the given direction', () => {
    expect(moveItem(list, 1, -1)).toEqual(['b', 'a', 'c', 'd']);
    expect(moveItem(list, 1, 1)).toEqual(['a', 'c', 'b', 'd']);
  });

  it('does not wrap around either end', () => {
    expect(moveItem(list, 0, -1)).toEqual(list);
    expect(moveItem(list, 3, 1)).toEqual(list);
  });

  it('leaves the input untouched', () => {
    const original = [...list];
    moveItem(list, 1, 1);
    expect(list).toEqual(original);
  });

  it('ignores an index that is not in the list', () => {
    expect(moveItem(list, -1, 1)).toEqual(list);
    expect(moveItem(list, 9, -1)).toEqual(list);
  });

  it('handles the degenerate lists', () => {
    expect(moveItem([], 0, 1)).toEqual([]);
    expect(moveItem(['only'], 0, -1)).toEqual(['only']);
  });
});

describe('isAtEdge', () => {
  it('reports the ends, which is what disables the buttons', () => {
    const list = ['a', 'b', 'c'];
    expect(isAtEdge(list, 0, -1)).toBe(true);
    expect(isAtEdge(list, 0, 1)).toBe(false);
    expect(isAtEdge(list, 2, 1)).toBe(true);
    expect(isAtEdge(list, 2, -1)).toBe(false);
    expect(isAtEdge(list, 1, -1)).toBe(false);
  });

  it('reports both directions as edges for a single item', () => {
    expect(isAtEdge(['only'], 0, -1)).toBe(true);
    expect(isAtEdge(['only'], 0, 1)).toBe(true);
  });
});
