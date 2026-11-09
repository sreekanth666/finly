import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { contrastRatio, mixColor } from '@/domain/color';

/*
 * Reads the real token file, so a palette edit that makes a pair illegible
 * fails here rather than on a device. The file is the only place a colour
 * literal may live; this test only parses it, and holds none of its own.
 */
const CSS = readFileSync(join(process.cwd(), 'src', 'theme', 'tokens.css'), 'utf8').replace(
  /\/\*[\s\S]*?\*\//g,
  '',
);

const primitives = new Map<string, string>(
  [...CSS.matchAll(/(--zenith-[a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map((m) => [m[1]!, m[2]!]),
);

/** The body of `@variant dark { … }`, found by balancing its braces. */
const variantBody = (name: string): string => {
  const start = CSS.indexOf(`@variant ${name}`);
  const open = CSS.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < CSS.length; index++) {
    if (CSS[index] === '{') depth++;
    if (CSS[index] === '}' && --depth === 0) return CSS.slice(open + 1, index);
  }
  throw new Error(`@variant ${name} is not closed`);
};

const darkTokens = new Map<string, string>(
  [...variantBody('dark').matchAll(/(--[a-z0-9-]+):\s*var\((--[a-z0-9-]+)\)\s*;/g)].map((m) => [
    m[1]!,
    m[2]!,
  ]),
);

/** A semantic token, followed through `var()` until it reaches a primitive. */
const resolve = (token: string): string => {
  let name = `--${token}`;
  for (let hops = 0; hops < 8; hops++) {
    const direct = primitives.get(name);
    if (direct !== undefined) return direct;
    const next = darkTokens.get(name);
    if (next === undefined) break;
    name = next;
  }
  throw new Error(`"${token}" does not resolve to a colour in tokens.css`);
};

const AA = 4.5;

const expectContrast = (text: string, ground: string, minimum = AA) => {
  const ratio = contrastRatio(resolve(text), resolve(ground));
  /* Throws rather than asserts, so a failure names the pair and the number. */
  if (!(ratio >= minimum)) {
    throw new Error(`${text} on ${ground} is ${ratio.toFixed(2)}:1, under the ${minimum}:1 minimum`);
  }
};

describe('the palette reads as text and as fills', () => {
  it('parses the token file', () => {
    expect(primitives.size).toBeGreaterThan(10);
    expect(resolve('accent')).toBe(primitives.get('--zenith-emerald'));
  });

  it('puts white on the accent fill', () => {
    expectContrast('accent-foreground', 'accent');
  });

  it.each(['success', 'warning', 'danger', 'link', 'iris', 'income'])(
    'reads %s as text on the canvas',
    (token) => {
      expectContrast(token, 'background');
    },
  );

  it.each(['success', 'warning', 'danger'])('reads %s as text on a card', (token) => {
    expectContrast(token, 'surface');
  });

  it.each(['success', 'warning', 'danger', 'iris'])(
    'puts readable text on a %s fill',
    (token) => {
      expectContrast(`${token}-foreground`, token);
    },
  );

  it('reads body text on the canvas, cards and inputs', () => {
    expectContrast('foreground', 'background');
    expectContrast('surface-foreground', 'surface');
    expectContrast('surface-secondary-foreground', 'surface-secondary');
    expectContrast('field-foreground', 'field-background');
  });

  it('reads secondary text on the canvas and on cards', () => {
    expectContrast('muted', 'background');
    expectContrast('muted', 'surface');
  });

  /*
   * The home card is text on a fill, so it uses the on-fill token (snow). Body
   * text (chalk) is 4.2 and 4.4 on the lighter good and watch grounds, which
   * is why the card does not use it.
   */
  it.each(['health-good', 'health-watch', 'health-over'])(
    'reads on-fill text on the %s ground of the home card',
    (token) => {
      expectContrast('accent-foreground', token);
    },
  );

  it('still reads on-fill text at the dark end of the home card gradient', () => {
    /* The card's far corner: the ground pulled 54% toward the canvas. */
    const ink = resolve('background');
    for (const token of ['health-good', 'health-watch', 'health-over']) {
      const ratio = contrastRatio(resolve('accent-foreground'), mixColor(resolve(token), ink, 0.54));
      expect(ratio).toBeGreaterThanOrEqual(AA);
    }
  });

  it('keeps the far corner of the good ground at the deep forest the card has always ended on', () => {
    /* The card has always ended on this forest; one channel rounds a step away. */
    const end = mixColor(resolve('health-good'), resolve('background'), 0.54);
    expect(contrastRatio(end, `#${'1a3f27'}`)).toBeLessThan(1.01);
  });

  it('keeps the chart hues visible against a card', () => {
    for (const slot of [1, 2, 3, 4, 5]) {
      expectContrast(`chart-${slot}`, 'surface', 3);
    }
  });
});
