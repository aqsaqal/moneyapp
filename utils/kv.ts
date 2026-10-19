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

// Keys stored per-profile. Split into two policies:
//
//   INHERIT — on first read in a profile, fall back to the legacy
//             unscoped value (so switching to a new profile carries
//             over your currency / format / default-account from the
//             main profile). Currency-like preferences.
//
//   FRESH   — never fall back. Every profile starts at the configured
//             default (typically OFF). Used for behaviour-modifying
//             toggles where inheriting from another profile feels
//             surprising (Smart Add chips, FAB tap-swap).
const PROFILE_SCOPED_KEYS_INHERIT = new Set<string>([
  'currency',
  'currencyFormat',
  'defaultAccountId',
]);
const PROFILE_SCOPED_KEYS_FRESH = new Set<string>([
  'smartSuggestions',
  'fabSwapAction',
  // UI state + one-shot data repairs are per profile too: each profile
  // has its own SQLite file, so a repair that ran on one must still run
  // on the others.
  'planSegment',
  'planDismissedSuggestions',
  'accountsOverviewHidden',
  'accountsOverviewFace',
  'lastExportAt',
  'liabilitySignsRepaired_v1',
  'debtsLinkedToAccounts_v1',
  'amountMainBackfilled_v1',
]);
const PROFILE_SCOPED_KEYS = new Set<string>([
  ...PROFILE_SCOPED_KEYS_INHERIT,
  ...PROFILE_SCOPED_KEYS_FRESH,
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
    const v = rawGet(scoped);
    if (v !== undefined) return v;
    // INHERIT keys carry over from the legacy unscoped slot so existing
    // installs (and brand-new profiles) see the user's main-profile
    // currency. FRESH keys do not — they must read as the default
    // when the profile hasn't explicitly toggled them on.
    if (PROFILE_SCOPED_KEYS_FRESH.has(key)) return undefined;
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
  liabilitySignsRepaired_v1: string; // '1' once positive loan / negative receivable balances were sign-fixed for this profile
  accountsOverviewHidden: string;    // '1' = Accounts tab hides the net-worth Overview (chart + tiles); header chart button toggles it
  planSegment: string;               // 'bills' | 'budgets' | 'goals' | 'debts' — last Plan segment the user viewed
  debtsLinkedToAccounts_v1: string;  // '1' once standalone `debts` rows were linked to / converted into loan accounts
  lastExportAt: string;              // unix ms of the last successful export from Settings (shown as "Last backup")
  accountsOverviewFace: string;      // 'net' | 'flow' — which face of the Accounts overview card is showing
  amountMainBackfilled_v1: string;   // '1' once transactions.amount_main was filled for this profile
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
