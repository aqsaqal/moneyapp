// React Native CLI autolinking config.
//
// SCREENSHOT_SIM=1 drops the ML Kit text-recognition native module on
// iOS. Google's ML Kit frameworks ship no arm64 *simulator* slice, which
// forces every simulator build to x86_64 — and Apple-silicon simulators
// on Xcode 26 refuse x86_64 apps. The JS side requires the module lazily
// (utils/receiptOcr.ts), so a build without it only loses receipt
// scanning. Used for App Store screenshot runs; device builds unaffected.
const dropMlKit = process.env.SCREENSHOT_SIM === '1';
module.exports = {
  dependencies: dropMlKit
    ? { '@react-native-ml-kit/text-recognition': { platforms: { ios: null } } }
    : {},
};
