import { areaPath, monotonePath } from '@/domain/curve';

/** Every number in a path, in order. */
const numbers = (path: string): number[] => (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);

describe('monotonePath', () => {
  it('is empty for no points and a lone move for one', () => {
    expect(monotonePath([])).toBe('');
    expect(monotonePath([{ x: 5, y: 7 }])).toBe('M5 7');
  });

  it('draws two points as one valid cubic', () => {
    const path = monotonePath([
      { x: 0, y: 10 },
      { x: 30, y: 40 },
    ]);
    expect(path).toMatch(/^M0 10 C/);
    expect(numbers(path)).toHaveLength(8);
    expect(path.endsWith('30 40')).toBe(true);
  });

  it('keeps flat data flat', () => {
    const path = monotonePath([
      { x: 0, y: 50 },
      { x: 10, y: 50 },
      { x: 20, y: 50 },
      { x: 30, y: 50 },
    ]);
    // Numbers alternate x, y — every y is 50.
    const ys = numbers(path).filter((_, index) => index % 2 === 1);
    expect(ys.length).toBeGreaterThan(0);
    expect(new Set(ys)).toEqual(new Set([50]));
  });

  it('never overshoots the data, so it cannot dip past a baseline', () => {
    // A cumulative curve: long plateau then a jump. A plain spline rings here.
    const points = [
      { x: 0, y: 80 },
      { x: 10, y: 80 },
      { x: 20, y: 80 },
      { x: 30, y: 20 },
      { x: 40, y: 20 },
      { x: 50, y: 10 },
    ];
    const ys = numbers(monotonePath(points)).filter((_, index) => index % 2 === 1);
    expect(Math.max(...ys)).toBeLessThanOrEqual(80);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(10);
  });

  it('rounds to at most two decimals', () => {
    const path = monotonePath([
      { x: 0, y: 1 / 3 },
      { x: 7, y: 10 / 7 },
      { x: 13, y: 2 / 3 },
    ]);
    for (const token of path.match(/-?\d+\.\d+/g) ?? []) {
      expect(token.split('.')[1]!.length).toBeLessThanOrEqual(2);
    }
    expect(path).not.toMatch(/NaN|Infinity|e-/);
  });

  it('tolerates points that share an x', () => {
    const path = monotonePath([
      { x: 0, y: 5 },
      { x: 10, y: 9 },
      { x: 10, y: 12 },
      { x: 20, y: 12 },
    ]);
    expect(path).not.toMatch(/NaN|Infinity/);
  });
});

describe('areaPath', () => {
  const points = [
    { x: 0, y: 60 },
    { x: 10, y: 40 },
    { x: 20, y: 40 },
  ];

  it('closes the line down to the baseline and back', () => {
    const path = areaPath(points, 88);
    expect(path.startsWith(monotonePath(points))).toBe(true);
    expect(path.endsWith('L20 88 L0 88 Z')).toBe(true);
  });

  it('never goes below the baseline when the data sits above it', () => {
    const ys = numbers(areaPath(points, 88)).filter((_, index) => index % 2 === 1);
    expect(Math.max(...ys)).toBeLessThanOrEqual(88);
  });

  it('is empty for no points', () => {
    expect(areaPath([], 88)).toBe('');
  });
});
