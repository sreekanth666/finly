/**
 * Android wakes this headless task when the widget is placed, resized, or due
 * its periodic refresh (`updatePeriodMillis` in app.json) — including while the
 * app is closed, which is the only way a month rolling over reaches the widget
 * before the app is next opened.
 *
 * Taps need no handling here: both targets are `OPEN_URI` deep links, which the
 * system opens without waking JavaScript.
 */

import type { WidgetTaskHandlerProps } from 'react-native-android-widget';

import { MonthGlanceWidget, WIDGET_NAME } from './month-glance-widget';
import { loadWidgetPalette } from './palette';
import { safeReadWidgetState } from './read';

export async function widgetTaskHandler({
  widgetInfo,
  widgetAction,
  renderWidget,
}: WidgetTaskHandlerProps): Promise<void> {
  if (widgetInfo.widgetName !== WIDGET_NAME) return;

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      renderWidget(
        <MonthGlanceWidget state={safeReadWidgetState()} palette={loadWidgetPalette()} />,
      );
      break;
    default:
      break;
  }
}
