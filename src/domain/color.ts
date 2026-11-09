/**
 * Blending two colours, for the one place the app needs a colour that sits
 * between two tokens (the home card's budget-health tint), and measuring how
 * legible one is on another (the palette's contrast guard).
 *
 * The values it is handed are always tokens resolved at runtime, never
 * literals, so this only does arithmetic on them: linear in RGB, which is
 * plenty for a wash behind text and keeps the maths checkable by hand.
 */

export type ColorStop = {
  /** Where on the 0–1 scale this colour is exactly. */
  at: number;
  color: string;
};

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

const clampUnit = (value: number): number =>
  Number.isNaN(value) ? 0 : Math.min(1, Math.max(0, value));

const parseHex = (color: string): [number, number, number] | null => {
  const match = HEX.exec(color);
  if (match === null) return null;
  return [parseInt(match[1]!, 16), parseInt(match[2]!, 16), parseInt(match[3]!, 16)];
};

const toHexByte = (value: number): string => Math.round(value).toString(16).padStart(2, '0');

/**
 * `t` of the way from `a` to `b`, as `#rrggbb`. `t` is clamped to 0–1.
 *
 * Anything that is not `#rrggbb` cannot be blended, and a tint is never worth a
 * crash: the nearer end is returned as it was given.
 */
export function mixColor(a: string, b: string, t: number): string {
  const amount = clampUnit(t);
  const from = parseHex(a);
  const to = parseHex(b);
  if (from === null || to === null) return amount < 0.5 ? a : b;

  const channel = (index: 0 | 1 | 2) => from[index] + (to[index] - from[index]) * amount;
  return `#${toHexByte(channel(0))}${toHexByte(channel(1))}${toHexByte(channel(2))}`;
}

/**
 * The colour at `t` along a run of stops, blended between the two either side.
 * Before the first stop and after the last it holds that stop's colour, so a
 * scale that starts at 0.5 is flat below it. Stops are expected in order.
 */
export function colorAtStops(stops: readonly ColorStop[], t: number): string {
  const first = stops[0];
  if (first === undefined) return '';

  const position = clampUnit(t);
  if (position <= first.at) return first.color;

  for (let index = 1; index < stops.length; index++) {
    const upper = stops[index]!;
    if (position <= upper.at) {
      const lower = stops[index - 1]!;
      const span = upper.at - lower.at;
      return span <= 0 ? upper.color : mixColor(lower.color, upper.color, (position - lower.at) / span);
    }
  }

  return stops[stops.length - 1]!.color;
}

const linearise = (channel: number): number => {
  const unit = channel / 255;
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
};

/**
 * WCAG 2.x relative luminance, 0 (black) to 1 (white). A colour that is not
 * `#rrggbb` has no luminance, and is NaN rather than a guess.
 */
export function relativeLuminance(color: string): number {
  const rgb = parseHex(color);
  if (rgb === null) return Number.NaN;
  const [r, g, b] = rgb;
  return 0.2126 * linearise(r) + 0.7152 * linearise(g) + 0.0722 * linearise(b);
}

/**
 * WCAG 2.x contrast ratio between two colours, 1 (identical) to 21 (black on
 * white). Symmetric: which one is the text does not matter.
 */
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(a);
  const second = relativeLuminance(b);
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}
