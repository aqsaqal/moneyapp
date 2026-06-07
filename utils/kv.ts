// MMKV wrapper for non-transactional state.
// ~30x faster than AsyncStorage, synchronous, reliable for prefs/settings.

import { createMMKV } from 'react-native-mmkv';
import { Platform } from 'react-native';

// MMKV doesn't run on web — fall back to localStorage for dev/export builds.
// Feature flags only use this on the client anyway.
const webStore: Record<string, string> = {};

const isWeb = Platform.OS === 'web';

const storage = isWeb
  ? null
  : createMMKV({ id: 'moneyflow-kv' });

// Keys that should be stored per-profile, not globally. These are the
// "Profile settings" group in the Settings screen — currency, currency
// format, FAB swap, smart-add behaviour. Everything else (language,
// appearance, biometric, notifications) stays global because it's a
// user-level preference that doesn't change when the user switches
// profiles for accounting purposes.
const PROFILE_SCOPED_KEYS = new Set<string>([
  'currency',
  'currencyFormat',
  'smartSuggestions',
  'fabSwapAction',
  'defaultAccountId',
]);

function scopedKey(key: string): string {
  if (!PROFILE_SCOPED_KEYS.has(key)) return key;
  try {
    // Lazy-required to avoid a circular import (profiles.ts → kv.ts).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getActiveProfileId } = require('@/utils/profiles');
    const pid: string = getActiveProfileId();
    return `${key}::${pid}`;
  } catch {
    return key;
  }
}

function rawGet(k: string): string | undefined {
  if (isWeb) {
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage.getItem(k) ?? undefined;
    }
    return webStore[k];
  }
  return storage?.getString(k);
}

function getRaw(key: string): string | undefined {
  const scoped = scopedKey(key);
  if (scoped !== key) {
    // Per-profile read; fall back to the legacy unscoped value so
    // existing installs see their previous setting on first switch
    // until the user explicitly changes it (which writes the scoped
    // key).
    const v = rawGet(scoped);
    if (v !== undefined) return v;
  }
  return rawGet(key);
}

function setRaw(key: string, val: string) {
  const k = scopedKey(key);
  if (isWeb) {
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      (globalThis as any).localStorage.setItem(k, val);
      return;
    }
    webStore[k] = val;
    return;
  }
  storage?.set(k, val);
}

function delRaw(key: string) {
  const k = scopedKey(key);
  if (isWeb) {
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      (globalThis as any).localStorage.removeItem(k);
      return;
    }
    delete webStore[k];
    return;
  }
  storage?.remove(k);
}

// ---- Typed API ----

export interface KVSchema {
  currency: string;            // 'USD' | 'SAR' | ...
  locale: string;              // 'en-US' | 'ar-SA' | ...
  rtlSetForLocale: string;     // last locale we called forceRTL for (prevents reload loop)
  biometricEnabled: string;    // '1' | '0'
  onboardingCompleted: string; // '1' | '0'
  themeMode: string;           // 'system' | 'dark' | 'light'
  islamicPrayerMethod: string; // adhan-js method id (islamic only)
  islamicCity: string;         // city for prayer calculation (islamic only)
  islamicCoords: string;       // JSON {lat:number,lon:number}
  islamicHijriCalendar: string;// 'ummalqura' | 'tabular'
  defaultAccountId: string;    // remembered after first 5 successful adds (Phase 7)
  arabicNumerals: string;      // '1' | '0' — opt-in for Arabic-Indic digits in formatMoney (Phase 8)
  activeProfileId: string;     // Phase 10b: which profile's SQLite is active
  profiles: string;            // JSON array of Profile objects (utils/profiles.ts)
  voicePromptShown: string;    // '1' once the explainer was acknowledged (Phase 10h)
  fxAutoRefresh: string;       // '1' = fetch FX rates daily from frankfurter.app (Phase 10k)
  smartSuggestions: string;    // '1' = show frequent-merchant chips on Smart Add (default OFF)
  hasSeededOnce: string;       // '1' once the sample dataset has been inserted on this install — prevents re-seeding for new profiles
  'islamic.nisabAutoRefresh': string;  // '1' = fetch gold/silver spot daily (Phase 10q.2)
  currencyFormat: string;      // preset id from CURRENCY_FORMAT_PRESETS (Phase 10x)
  remindersEnabled: string;    // '1' = local bill-reminder notifications active (Phase 10t)
  reminderLeadDays: string;    // '0'..'7' days before dayOfMonth (Phase 10t)
  activityView: string;        // 'list' | 'categories' (Phase 10ac)
  activityJumpToMonth: string; // YYYY-MM handoff from Insights screen → Activity carousel
  activityJumpToView: string;  // 'list' | 'categories' — segment to land on after jump
  netWorthBackfillDone: string;   // deprecated — left to suppress type errors on legacy code paths
  netWorthBackfillDoneV2: string; // CSV of profile IDs whose net-worth history has been backfilled by the v2 (active-month-only) pass
  fabSwapAction: string;          // '1' = tap → category grid, long-press → Smart Add; default '0' (tap → Smart Add)
  demoProfileAttempted: string;   // '1' once the boot path has tried to create the Demo profile; prevents re-creation after the user deletes it
}

export const kv = {
  get<K extends keyof KVSchema>(key: K): KVSchema[K] | undefined {
    return getRaw(key) as KVSchema[K] | undefined;
  },
  set<K extends keyof KVSchema>(key: K, value: KVSchema[K]): void {
    setRaw(key, value);
  },
  delete<K extends keyof KVSchema>(key: K): void {
    delRaw(key);
  },
  getBool<K extends keyof KVSchema>(key: K, defaultValue = false): boolean {
    const v = getRaw(key);
    if (v === undefined) return defaultValue;
    return v === '1' || v === 'true';
  },
  setBool<K extends keyof KVSchema>(key: K, value: boolean): void {
    setRaw(key, value ? '1' : '0');
  },
  getJSON<T>(key: string): T | undefined {
    const v = getRaw(key);
    if (!v) return undefined;
    try { return JSON.parse(v) as T; } catch { return undefined; }
  },
  setJSON<T>(key: string, value: T): void {
    setRaw(key, JSON.stringify(value));
  },
};
