// Home-screen + lock-screen widgets (SwiftUI). Built into the Xcode
// project by @bacons/apple-targets at prebuild; the Swift source lives
// next to this file. The App Group matches app.config.ts so the widget
// can read the snapshot the app writes (utils/widget.ts).
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  name: 'widget',
  displayName: `${config.name} Widgets`,
  bundleIdentifier: '.widget',
  deploymentTarget: '16.0',
  frameworks: ['SwiftUI', 'WidgetKit'],
  colors: { $widgetBackground: '#0E0E18', $accent: '#00E09E' },
  entitlements: {
    'com.apple.security.application-groups': config.ios.entitlements['com.apple.security.application-groups'],
  },
});
