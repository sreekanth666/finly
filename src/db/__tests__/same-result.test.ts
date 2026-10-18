import { sameResult } from '../same-result';

/*
 * useDbQuery keeps the previous result whenever a re-read returns this, so a
 * false positive here is stale data on screen and a false negative is only a
 * wasted render. The cases lean on the first.
 */

describe('sameResult', () => {
  it('matches a fresh copy of nested rows', () => {
    expect(sameResult({ a: [1, { b: 2 }] }, { a: [1, { b: 2 }] })).toBe(true);
  });

  it('notices a changed nested value', () => {
    expect(sameResult({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false);
  });

  it('notices an added key, even one holding undefined', () => {
    expect(sameResult({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(sameResult({ a: undefined }, {})).toBe(false);
  });

  it('notices a longer or reordered list', () => {
    expect(sameResult([1, 2], [1, 2, 3])).toBe(false);
    expect(sameResult([1, 2], [2, 1])).toBe(false);
  });

  it('treats NaN as equal to itself', () => {
    expect(sameResult(Number.NaN, Number.NaN)).toBe(true);
  });

  it('compares dates by instant', () => {
    expect(sameResult(new Date(5), new Date(5))).toBe(true);
    expect(sameResult(new Date(5), new Date(6))).toBe(false);
  });

  it('compares errors by message', () => {
    expect(sameResult(new Error('x'), new Error('x'))).toBe(true);
    expect(sameResult(new Error('x'), new Error('y'))).toBe(false);
  });

  it('does not mistake an array for an object with the same indices', () => {
    expect(sameResult([1], { 0: 1 })).toBe(false);
  });

  it('tells null, undefined and an empty object apart', () => {
    expect(sameResult(null, undefined)).toBe(false);
    expect(sameResult(null, {})).toBe(false);
  });
});
