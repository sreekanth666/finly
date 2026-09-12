/**
 * The bundle's entry point: Expo Router's own entry, plus the headless task the
 * home-screen widget needs.
 *
 * The task has to be registered here rather than anywhere under src/app, because
 * Android can wake the bundle for the widget alone — with no activity and no
 * root layout ever mounting.
 */

import 'expo-router/entry';

import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from '@/features/widget/task-handler';

registerWidgetTaskHandler(widgetTaskHandler);
