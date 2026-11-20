// Expo config plugin: declare the camera as an OPTIONAL hardware feature.
//
// The CAMERA permission (receipt scanning) makes Google Play infer
// `android.hardware.camera` as *required*, which hides the app from
// devices without a camera and trips a "restricting your app's
// availability" warning on every submission. Receipt scanning is a
// nice-to-have, so declare the feature explicitly with required=false.
const { withAndroidManifest } = require('@expo/config-plugins');

const FEATURES = ['android.hardware.camera', 'android.hardware.camera.autofocus'];

module.exports = function withOptionalCamera(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest['uses-feature'] = manifest['uses-feature'] ?? [];
    for (const name of FEATURES) {
      const existing = manifest['uses-feature'].find((f) => f.$?.['android:name'] === name);
      if (existing) existing.$['android:required'] = 'false';
      else manifest['uses-feature'].push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    return cfg;
  });
};
