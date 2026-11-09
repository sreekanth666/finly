/**
 * Smooth lines through points, as SVG path data.
 *
 * Pure geometry, kept out of the chart component so the property that matters
 * can be tested: a cumulative spend curve is flat for days and then steps up,
 * and a plain spline rings around those steps — it dips below the baseline and
 * draws a month in which money came back. A monotone cubic (Fritsch–Carlson)
 * never leaves the range of the points on either side of a segment, so it can
 * round the corners without inventing a value that was never spent.
 */

export type Point = { x: number; y: number };

/** Two decimals is a hundredth of a pixel; more only makes the path string longer. */
const round2 = (value: number): number => {
  const rounded = Math.round(value * 100) / 100;
  // Math.round(-0.004 * 100) is -0, which String() prints as "0" but is still noise.
  return rounded === 0 ? 0 : rounded;
};

const num = (value: number): string => String(round2(value));

/**
 * Tangent slope at each point. Where the neighbouring secants disagree in sign
 * (a peak, a valley) or either is flat, the slope is zero, which is what stops
 * the curve overshooting; elsewhere it is the average, scaled back whenever it
 * would be steep enough to overshoot (alpha² + beta² > 9).
 */
function tangents(points: readonly Point[]): number[] {
  const count = points.length;
  const secants: number[] = [];

  for (let i = 0; i < count - 1; i++) {
    const dx = points[i + 1]!.x - points[i]!.x;
    secants.push(dx === 0 ? 0 : (points[i + 1]!.y - points[i]!.y) / dx);
  }

  const slopes: number[] = new Array<number>(count).fill(0);
  slopes[0] = secants[0]!;
  slopes[count - 1] = secants[count - 2]!;
  for (let i = 1; i < count - 1; i++) {
    const before = secants[i - 1]!;
    const after = secants[i]!;
    slopes[i] = before * after <= 0 ? 0 : (before + after) / 2;
  }

  for (let i = 0; i < count - 1; i++) {
    const secant = secants[i]!;
    if (secant === 0) {
      slopes[i] = 0;
      slopes[i + 1] = 0;
      continue;
    }
    const alpha = slopes[i]! / secant;
    const beta = slopes[i + 1]! / secant;
    const magnitude = alpha * alpha + beta * beta;
    if (magnitude > 9) {
      const scale = 3 / Math.sqrt(magnitude);
      slopes[i] = scale * alpha * secant;
      slopes[i + 1] = scale * beta * secant;
    }
  }

  return slopes;
}

/**
 * An SVG path through the points, left to right. `x` must be non-decreasing.
 * Empty for no points, a lone `M` for one.
 */
export function monotonePath(points: readonly Point[]): string {
  const first = points[0];
  if (first === undefined) return '';
  if (points.length === 1) return `M${num(first.x)} ${num(first.y)}`;

  const slopes = tangents(points);
  let path = `M${num(first.x)} ${num(first.y)}`;

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]!;
    const to = points[i + 1]!;
    const third = (to.x - from.x) / 3;
    path +=
      ` C${num(from.x + third)} ${num(from.y + slopes[i]! * third)}` +
      ` ${num(to.x - third)} ${num(to.y - slopes[i + 1]! * third)}` +
      ` ${num(to.x)} ${num(to.y)}`;
  }

  return path;
}

/** The same line closed down to `baselineY` and back, ready to fill. */
export function areaPath(points: readonly Point[], baselineY: number): string {
  const first = points[0];
  const last = points[points.length - 1];
  if (first === undefined || last === undefined) return '';

  return `${monotonePath(points)} L${num(last.x)} ${num(baselineY)} L${num(first.x)} ${num(baselineY)} Z`;
}
