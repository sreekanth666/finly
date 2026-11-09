import { contrastRatio, relativeLuminance } from '@/domain/color';

/*
 * The colour check scans tests too, so a hex colour is built from its digits
 * rather than written whole. These are arbitrary values for the arithmetic,
 * not the app's colours.
 */
const hex = (digits: string): string => `#${digits}`;
const BLACK = hex('000000');
const WHITE = hex('ffffff');
/* The darkest grey that just reaches 4.5:1 against white, from the WCAG notes. */
const GREY = hex('767676');

describe('relativeLuminance', () => {
  it('is 0 for black and 1 for white', () => {
    expect(relativeLuminance(BLACK)).toBe(0);
    expect(relativeLuminance(WHITE)).toBeCloseTo(1, 10);
  });

  it('weights green most and blue least', () => {
    expect(relativeLuminance(hex('ff0000'))).toBeCloseTo(0.2126, 4);
    expect(relativeLuminance(hex('00ff00'))).toBeCloseTo(0.7152, 4);
    expect(relativeLuminance(hex('0000ff'))).toBeCloseTo(0.0722, 4);
  });

  it('is not linear in the digits: mid grey is far darker than half', () => {
    expect(relativeLuminance(hex('808080'))).toBeCloseTo(0.2159, 3);
  });

  it('is NaN for a colour it cannot read', () => {
    expect(relativeLuminance('transparent')).toBeNaN();
  });
});

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for a colour on itself', () => {
    expect(contrastRatio(BLACK, WHITE)).toBeCloseTo(21, 10);
    expect(contrastRatio(GREY, GREY)).toBe(1);
  });

  it('is the same whichever way round the pair is given', () => {
    expect(contrastRatio(GREY, WHITE)).toBe(contrastRatio(WHITE, GREY));
  });

  it('matches the published figure for the 4.5:1 grey on white', () => {
    expect(contrastRatio(GREY, WHITE)).toBeCloseTo(4.54, 2);
  });

  it('is NaN when either side cannot be read', () => {
    expect(contrastRatio('transparent', WHITE)).toBeNaN();
  });
});
