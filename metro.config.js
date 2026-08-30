// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withUniwindConfig } = require('uniwind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Drizzle's generated migrations are .sql files that babel-plugin-inline-import
// pulls into the bundle, so metro has to resolve them as source rather than as
// an asset. Pushed before the uniwind wrapper and asserted after it, because the
// wrapper returns a rebuilt config and there is no guarantee `resolver` survives
// by reference.
config.resolver.sourceExts.push('sql');

const finalConfig = withUniwindConfig(config, {
  // relative path to your global.css file (from previous step)
  cssEntryFile: './src/global.css',
  // (optional) path where we gonna auto-generate typings
  // defaults to project's root
  dtsFile: './src/uniwind-types.d.ts',
});

if (!finalConfig.resolver.sourceExts.includes('sql')) {
  finalConfig.resolver.sourceExts = [...finalConfig.resolver.sourceExts, 'sql'];
}

module.exports = finalConfig;
