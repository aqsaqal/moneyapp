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

function getRaw(key: string): string | undefined {
  if (isWeb) {
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      return (globalThis as any).localStorage.getItem(key) ?? undefined;
    }
    return webStore[key];
  }
  return storage?.getString(key);
}

function setRaw(key: string, val: string) {
  if (isWeb) {
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      (globalThis as any).localStorage.setItem(key, val);
      return;
    }
    webStore[key] = val;
    return;
  }
  storage?.set(key, val);
}

function delRaw(key: string) {
  if (isWeb) {
    if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
      (globalThis as any).localStorage.removeItem(key);
      return;
    }
    delete webStore[key];
    return;
  }
  storage?.remove(key);
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
  smartSuggestions: string;    // '1' = show frequent-merchant chips on Smart Add (default ON)
  hasSeededOnce: string;       // '1' once the sample dataset has been inserted on this install — prevents re-seeding for new profiles
  'islamic.nisabAutoRefresh': string;  // '1' = fetch gold/silver spot daily (Phase 10q.2)
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
