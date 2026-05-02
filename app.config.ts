import 'dotenv/config';
import type { ExpoConfig } from 'expo/config';
import * as fs from 'fs';
import * as path from 'path';

// Load flavor-specific env file if ENVFILE is set; otherwise use defaults from shell env.
const envfile = process.env.ENVFILE ?? `.env.${process.env.APP_FLAVOR ?? 'generic'}`;
const envPath = path.join(__dirname, envfile);
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const flavor = process.env.APP_FLAVOR ?? 'generic';
const isIslamic = flavor === 'islamic';

// Only reference asset files that exist. For now, rely on Expo defaults (drop icon/splash blocks).
const config: ExpoConfig = {
  name: process.env.APP_NAME ?? 'Flow',
  slug: isIslamic ? 'amanah' : 'flow',
  scheme: process.env.APP_SCHEME ?? 'flow',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  ios: {
    bundleIdentifier: process.env.APP_BUNDLE_ID ?? 'com.moneyflow.generic',
    supportsTablet: false,
    infoPlist: {
      // Phase 7 (Smart Add): voice-to-add via @react-native-voice/voice.
      // Apple Speech runs on-device for short utterances on iOS 17+.
      NSSpeechRecognitionUsageDescription:
        'Used to dictate transaction notes (e.g. "twelve fifty coffee"). On-device on iOS 17+.',
      NSMicrophoneUsageDescription:
        'Used to record short voice notes that are transcribed into transactions. Audio is not sent to our servers.',
    },
  },
  android: {
    package: process.env.APP_BUNDLE_ID ?? 'com.moneyflow.generic',
    edgeToEdgeEnabled: true,
    // Phase 7 (Smart Add): voice-to-add. RECORD_AUDIO is the only new permission;
    // Android Speech Recognizer service handles the rest.
    permissions: [
      'android.permission.RECORD_AUDIO',
    ],
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-sqlite',
    'expo-notifications',
    'expo-local-authentication',
    'expo-localization',
    [
      'expo-build-properties',
      {
        android: {
          // Phase 7: @react-native-voice/voice 3.2.4 still ships
          // com.android.support:* (pre-AndroidX). Jetifier rewrites those
          // references to androidx.* at build time, eliminating the
          // duplicate-class conflict that otherwise blocks assembleRelease.
          enableJetifier: true,
        },
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: {
    flavor,
    appName: process.env.APP_NAME,
    primaryColor: process.env.PRIMARY_COLOR,
    featuresIslamic: process.env.FEATURES_ISLAMIC === 'true',
  },
};

export default config;
