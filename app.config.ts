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

// Per-flavor branded icons — generated from scripts/generate-icons.py.
const ICON = `./assets/${isIslamic ? 'islamic' : 'generic'}/icon.png`;
const ADAPTIVE_ICON = `./assets/${isIslamic ? 'islamic' : 'generic'}/adaptive-icon.png`;
const SPLASH_ICON = `./assets/${isIslamic ? 'islamic' : 'generic'}/splash-icon.png`;
const SPLASH_BG = isIslamic ? '#0E2B25' : '#0F172A';

const config: ExpoConfig = {
  name: process.env.APP_NAME ?? 'Flow',
  slug: isIslamic ? 'amanah' : 'flow',
  scheme: process.env.APP_SCHEME ?? 'flow',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'dark',
  newArchEnabled: true,
  icon: ICON,
  splash: {
    image: SPLASH_ICON,
    resizeMode: 'contain',
    backgroundColor: SPLASH_BG,
  },
  ios: {
    bundleIdentifier: process.env.APP_BUNDLE_ID ?? 'com.moneyflow.generic',
    supportsTablet: false,
    icon: ICON,
    requireFullScreen: true,
    infoPlist: {
      // iPhone-only — keeps App Store from demanding iPad screenshots.
      UIDeviceFamily: [1],
      // Microphone strings — wording reviewed for Apple privacy nutrition.
      // Audio path:
      //   - iOS 17+: on-device when Voice.start() succeeds via Apple Speech;
      //   - older iOS: routed through Apple speech servers per OS contract.
      NSMicrophoneUsageDescription:
        'When you tap the voice button to dictate an expense, the microphone is used only for that utterance. Audio is processed by the system speech service and never recorded or sent to MoneyFlow servers.',
      NSSpeechRecognitionUsageDescription:
        'Speech recognition converts your dictated expense into text. On iOS 17+ this runs on-device when supported; on older iOS, audio is sent to Apple for transcription per the system speech service.',
    },
    privacyManifests: {
      // Required-reason API declarations (Apple submission requirement, 2024+).
      // These cover MMKV/UserDefaults reads, SQLite/file timestamps, system
      // boot time used by JS performance.now(), and disk-space checks. None
      // of these access user data — they're system-info APIs Apple wants
      // explicitly justified.
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1'] },
      ],
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [],
    },
  },
  android: {
    package: process.env.APP_BUNDLE_ID ?? 'com.moneyflow.generic',
    edgeToEdgeEnabled: true,
    adaptiveIcon: {
      foregroundImage: ADAPTIVE_ICON,
      backgroundColor: SPLASH_BG,
    },
    // RECORD_AUDIO: Phase 7 voice-to-add via Android SpeechRecognizer.
    // We *don't* declare READ/WRITE_EXTERNAL_STORAGE — scoped storage
    // (API 30+) makes them ineffective and Play Console flags them.
    // We also exclude SYSTEM_ALERT_WINDOW (some legacy deps merge it in).
    permissions: [
      'android.permission.RECORD_AUDIO',
    ],
    blockedPermissions: [
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      'android.permission.SYSTEM_ALERT_WINDOW',
    ],
    // Disable Auto Backup + Device Transfer for the financial DB. Without
    // this, `adb backup` (or any MDM that takes a full backup) extracts
    // the unencrypted moneyflow.db and MMKV in the clear.
    allowBackup: false,
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
