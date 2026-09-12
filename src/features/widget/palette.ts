/**
 * The widget's colours, taken from the same tokens as every screen.
 *
 * Tokens resolve through `useAppColor`, which is a hook, and the headless task
 * Android wakes to redraw the widget has no React tree to call it from. So the
 * running app resolves them and leaves a copy on disk for the task to read. The
 * values are whatever tokens.css compiles to — nothing here is a colour literal.
 */

import { File, Paths } from 'expo-file-system';
import { useMemo } from 'react';
import type { HexColor } from 'react-native-android-widget';

import { useAppColor } from '@/theme';

const PALETTE_ROLES = [
  'surface',
  'foreground',
  'muted',
  'track',
  'accent',
  'onAccent',
  'warning',
  'danger',
] as const;

type PaletteRole = (typeof PALETTE_ROLES)[number];

export type WidgetPalette = Record<PaletteRole, HexColor>;

/* Uniwind compiles every colour to `#rrggbb` or `#rrggbbaa`, which is also
   exactly what the widget renderer accepts. Anything else means the token layer
   changed shape, and a stale-but-valid copy on disk beats a widget painted wrong. */
const isHexColor = (value: unknown): value is HexColor =>
  typeof value === 'string' && value.startsWith('#');

function toPalette(values: Record<PaletteRole, unknown>): WidgetPalette | null {
  return PALETTE_ROLES.every((role) => isHexColor(values[role]))
    ? (values as WidgetPalette)
    : null;
}

export function useWidgetPalette(): WidgetPalette | null {
  const [surface, foreground, muted, track, accent, onAccent, warning, danger] = useAppColor([
    'surface',
    'foreground',
    'muted',
    'surface-tertiary',
    'accent',
    'accent-foreground',
    'warning',
    'danger',
  ]);

  return useMemo(
    () => toPalette({ surface, foreground, muted, track, accent, onAccent, warning, danger }),
    [surface, foreground, muted, track, accent, onAccent, warning, danger],
  );
}

const paletteFile = () => new File(Paths.document, 'widget-palette.json');

export function loadWidgetPalette(): WidgetPalette | null {
  try {
    const file = paletteFile();
    if (!file.exists) return null;
    return toPalette(JSON.parse(file.textSync()));
  } catch {
    return null;
  }
}

/** Writes only when something changed, which in practice is once per install. */
export function saveWidgetPalette(palette: WidgetPalette): void {
  const contents = JSON.stringify(palette);
  try {
    const file = paletteFile();
    if (file.exists && file.textSync() === contents) return;
    if (!file.exists) file.create();
    file.write(contents);
  } catch {
    // Tried again on the next render; the widget keeps its last good colours.
  }
}
