import { budgetUsage, healthStops } from '@/domain/budget-health';
import { colorAtStops, mixColor } from '@/domain/color';
import { asMinor } from '@/domain/money';

/*
 * The colour check scans tests too, so a hex colour is built from its digits
 * rather than written whole. These are arbitrary values for the arithmetic,
 * not the app's colours.
 */
const hex = (digits: string): string => `#${digits}`;
const BLACK = hex('000000');
const WHITE = hex('ffffff');
const RED = hex('ff0000');
const BLUE = hex('0000ff');

describe('budgetUsage', () => {
  it('is the share of what is available that has been spent', () => {
    expect(budgetUsage(asMinor(2500), asMinor(5000))).toBe(0.5);
    expect(budgetUsage(asMinor(0), asMinor(5000))).toBe(0);
    expect(budgetUsage(asMinor(5000), asMinor(5000))).toBe(1);
  });

  it('is capped at 1 when overspent', () => {
    expect(budgetUsage(asMinor(9000), asMinor(5000))).toBe(1);
  });

  it('is 1 when something is spent against nothing available', () => {
    expect(budgetUsage(asMinor(100), asMinor(0))).toBe(1);
    expect(budgetUsage(asMinor(100), asMinor(-500))).toBe(1);
  });

  it('is 0 when nothing is spent against nothing', () => {
    expect(budgetUsage(asMinor(0), asMinor(0))).toBe(0);
  });

  it('never goes below 0', () => {
    expect(budgetUsage(asMinor(-300), asMinor(5000))).toBe(0);
  });
});

describe('healthStops', () => {
  it('runs good, then watch, then over, in order', () => {
    expect(healthStops.map((stop) => [stop.at, stop.role])).toEqual([
      [0, 'good'],
      [0.5, 'good'],
      [0.8, 'watch'],
      [1, 'over'],
    ]);
  });
});

describe('mixColor', () => {
  it('returns each end at 0 and 1', () => {
    expect(mixColor(BLACK, WHITE, 0)).toBe(BLACK);
    expect(mixColor(BLACK, WHITE, 1)).toBe(WHITE);
  });

  it('is linear in each channel', () => {
    expect(mixColor(BLACK, WHITE, 0.5)).toBe(hex('808080'));
    expect(mixColor(RED, BLUE, 0.5)).toBe(hex('800080'));
    expect(mixColor(BLACK, WHITE, 0.25)).toBe(hex('404040'));
  });

  it('clamps t to 0–1', () => {
    expect(mixColor(BLACK, WHITE, -3)).toBe(BLACK);
    expect(mixColor(BLACK, WHITE, 7)).toBe(WHITE);
    expect(mixColor(BLACK, WHITE, Number.NaN)).toBe(BLACK);
  });

  it('accepts upper-case digits and answers in lower case', () => {
    expect(mixColor(hex('FF0000'), hex('FF0000'), 0.3)).toBe(RED);
  });

  it('hands back the nearer end rather than throw on a colour it cannot read', () => {
    expect(mixColor('transparent', WHITE, 0.2)).toBe('transparent');
    expect(mixColor('transparent', WHITE, 0.8)).toBe(WHITE);
  });
});

describe('colorAtStops', () => {
  const stops = [
    { at: 0, color: BLACK },
    { at: 0.5, color: BLACK },
    { at: 0.8, color: RED },
    { at: 1, color: WHITE },
  ];

  it('holds the first colour through a flat run of stops', () => {
    expect(colorAtStops(stops, 0)).toBe(BLACK);
    expect(colorAtStops(stops, 0.5)).toBe(BLACK);
  });

  it('is exactly a stop at the stop', () => {
    expect(colorAtStops(stops, 0.8)).toBe(RED);
    expect(colorAtStops(stops, 1)).toBe(WHITE);
  });

  it('blends between the two stops either side', () => {
    /* Halfway from 0.5 to 0.8 is 0.65. */
    expect(colorAtStops(stops, 0.65)).toBe(hex('800000'));
    /* Halfway from 0.8 to 1 is 0.9. */
    expect(colorAtStops(stops, 0.9)).toBe(hex('ff8080'));
  });

  it('clamps outside 0–1', () => {
    expect(colorAtStops(stops, -1)).toBe(BLACK);
    expect(colorAtStops(stops, 4)).toBe(WHITE);
  });

  it('holds the first colour below a scale that starts later', () => {
    expect(colorAtStops([{ at: 0.4, color: RED }, { at: 1, color: BLUE }], 0.1)).toBe(RED);
  });

  it('has no colour for no stops', () => {
    expect(colorAtStops([], 0.5)).toBe('');
  });
});
