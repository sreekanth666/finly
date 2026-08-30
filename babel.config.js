/**
 * Until Drizzle arrived this project had no Babel config at all — Metro fell back
 * to `babel-preset-expo` on its own. The one thing that fallback can't do is
 * inline `.sql` files, which is how `drizzle/migrations.js` embeds the generated
 * migrations into the bundle. That is the only reason this file exists.
 *
 * Deliberately minimal. `babel-preset-expo` already appends
 * `react-native-worklets/plugin` when the package is installed (Reanimated 4
 * stops working without it), and the React Compiler is switched on by
 * `experiments.reactCompiler` in app.json, which reaches the preset through the
 * Metro caller rather than through preset options. Spelling either one out here
 * would at best duplicate them and at worst quietly disagree.
 */
module.exports = function babelConfig(api) {
  api.cache(true);

  return {
    presets: ['babel-preset-expo'],
    plugins: [['inline-import', { extensions: ['.sql'] }]],
  };
};
