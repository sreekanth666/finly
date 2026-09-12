/**
 * Lists Finly in Android's share sheet for plain text (D17), so a payment SMS
 * can be long-pressed in the messages app and shared straight into the review
 * inbox. Adds one ACTION_SEND intent filter to the main activity; the native
 * module reads the text (see modules/finly-capture).
 *
 * Changing this needs `pnpm expo prebuild --clean` and a new dev build.
 */

const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

const SEND = 'android.intent.action.SEND';

module.exports = function withShareTarget(config) {
  return withAndroidManifest(config, (next) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(next.modResults);
    const filters = activity['intent-filter'] ?? [];

    const exists = filters.some((filter) =>
      (filter.action ?? []).some((action) => action.$['android:name'] === SEND),
    );

    if (!exists) {
      filters.push({
        action: [{ $: { 'android:name': SEND } }],
        category: [{ $: { 'android:name': 'android.intent.category.DEFAULT' } }],
        data: [{ $: { 'android:mimeType': 'text/plain' } }],
      });
    }

    activity['intent-filter'] = filters;
    return next;
  });
};
