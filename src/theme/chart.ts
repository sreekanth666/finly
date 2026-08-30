/**
 * The categorical chart palette, resolved for JavaScript.
 *
 * Charts draw with react-native-svg, which takes raw color values rather than
 * classNames, so the slots have to be resolved through the token layer the same
 * way `useAppColor` does it. Series carry a `ChartTone` rather than a free
 * `AppColor` so a chart can only ever be painted from the validated set — see
 * the palette note in tokens.css for why there are exactly five.
 */

import { useAppColor } from './index';

/** The slots, in the fixed order tokens.css validates them in. */
export const CHART_TONES = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5'] as const;

export type ChartTone = (typeof CHART_TONES)[number];

/** Every slot in one call, so a chart can paint any series it is handed. */
export function useChartPalette(): Record<ChartTone, string> {
  const values = useAppColor(CHART_TONES);

  return Object.fromEntries(CHART_TONES.map((tone, index) => [tone, values[index]])) as Record<
    ChartTone,
    string
  >;
}

const CHART_TONE_SET: ReadonlySet<string> = new Set(CHART_TONES);

/**
 * Resolves `categories.chart_tone`, which is TEXT and could hold anything after
 * a restore. Pinning the tone per category is what stops a category changing
 * colour when a quiet month reorders the chart.
 */
export const toChartTone = (tone: string): ChartTone =>
  CHART_TONE_SET.has(tone) ? (tone as ChartTone) : 'chart-5';
