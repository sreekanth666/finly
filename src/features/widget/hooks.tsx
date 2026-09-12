/**
 * Keeps the home-screen widget in step with the database while the app is open.
 * The headless task covers the time it is closed; see task-handler.tsx.
 */

import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { MonthGlanceWidget, WIDGET_NAME } from './month-glance-widget';
import { saveWidgetPalette, useWidgetPalette } from './palette';
import { readWidgetState } from './read';

import { useDbQuery } from '@/db/live';

export function useWidgetSync() {
  /* Settings is watched for the currency and the app-lock flag; the rest are
     everything that moves this month's spend or its budget. */
  const { data: state, refetch } = useDbQuery(
    'widget:state',
    ['expenses', 'settlements', 'budgets', 'settings'],
    readWidgetState,
  );
  const palette = useWidgetPalette();

  useEffect(() => {
    /* Nothing in the database changes when a month ends, so a live query alone
       would keep showing last month to anyone who left the app open over it. */
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') refetch();
    });
    return () => subscription.remove();
  }, [refetch]);

  useEffect(() => {
    if (Platform.OS !== 'android' || state === undefined || palette === null) return;

    saveWidgetPalette(palette);
    requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: () => <MonthGlanceWidget state={state} palette={palette} />,
    }).catch(() => {
      // No widget placed, or the launcher refused; the next change tries again.
    });
  }, [state, palette]);
}
