// Babel config for MoneyFlow dual-flavor build.
//
// Layer 1 of the tree-shake pipeline:
//   babel-plugin-transform-inline-environment-variables inlines process.env.APP_FLAVOR
//   so that `if (IS_ISLAMIC)` (defined as `process.env.APP_FLAVOR === 'islamic'` in
//   constants/flavor.ts) folds to a literal `if (false)` / `if (true)` at build time.
//   Metro's minifier then dead-code-eliminates the dead branch, dropping the import
//   site entirely. This is the ONLY way the string "@/features/islamic/slots" does
//   not survive into the generic bundle.
//
// react-native-reanimated/plugin must be listed LAST per the Reanimated docs.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'transform-inline-environment-variables',
        {
          include: ['APP_FLAVOR', 'FEATURES_ISLAMIC', 'NODE_ENV'],
        },
      ],
      'react-native-reanimated/plugin',
    ],
  };
};
