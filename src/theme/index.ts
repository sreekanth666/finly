/**
 * Typed access to the Zenith design tokens from JavaScript.
 *
 * Prefer Tailwind utilities (`className="bg-surface text-muted"`) wherever a
 * component accepts them. Use `useAppColor()` only for props that take a raw
 * color value and no className — navigation themes, chart libraries, canvas
 * drawing, and similar.
 *
 * Token values are resolved from the compiled CSS variables at runtime, so they
 * always match `src/theme/tokens.css`. Never inline a color literal instead.
 */

import type { ThemeColor } from 'heroui-native';
import { useCSSVariable } from 'uniwind';

/** Tokens defined by this app on top of HeroUI Native's semantic layer. */
export type AppThemeColor =
  | 'iris'
  | 'iris-foreground'
  | 'iris-hover'
  | 'income'
  | 'expense'
  /** Categorical chart series — see the palette note in tokens.css. */
  | 'chart-1'
  | 'chart-2'
  | 'chart-3'
  | 'chart-4'
  | 'chart-5';

/** Every color token available to the app. */
export type AppColor = ThemeColor | AppThemeColor;

const toVariable = (name: AppColor) => `--color-${name}` as const;

const toColorString = (value: string | number | undefined, name: AppColor): string => {
  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number') {
    return String(value);
  }

  throw new Error(
    `Unknown theme color "${name}". Add it to src/theme/tokens.css before using it.`
  );
};

/**
 * Resolve one or more theme colors to their current values.
 *
 * @example
 * const accent = useAppColor('accent');
 * const [background, border] = useAppColor(['background', 'border']);
 */
export function useAppColor(name: AppColor): string;
export function useAppColor<const T extends readonly [AppColor, ...AppColor[]]>(
  names: T
): { [K in keyof T]: string };
export function useAppColor(names: AppColor | readonly AppColor[]): string | string[] {
  const isList = Array.isArray(names);
  const requested = (isList ? names : [names]) as readonly AppColor[];
  const values = useCSSVariable(requested.map(toVariable));
  const resolved = requested.map((name, index) => toColorString(values[index], name));

  return isList ? resolved : resolved[0]!;
}
