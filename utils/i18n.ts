// Minimal i18n: t(key, vars?) + setLocale() + onLocaleChange().
//
// Design notes:
//   - Flat dictionaries keyed by dot-paths (e.g. 'home.recent.title').
//   - Variable interpolation via {var}.
//   - English is the source-of-truth; missing keys in other locales fall
//     back to English and emit a console.warn in __DEV__.
//   - Pluralization is intentionally NOT supported in v1 — too much
//     complexity for the value. Use separate keys ("days_one" / "days_other"
//     selected explicitly at the call site).
//   - Locale picker in Settings persists via `kv.locale`. setLocale() flips
//     I18nManager + reloads the app on Arabic (handled by changeLocale()
//     in app/(tabs)/me.tsx, not this file).
//
// Why not i18next? Two reasons: bundle size (~70KB gzipped vs ~2KB here),
// and we don't need pluralization/namespaces/lazy-loading for ~100 strings.

import { kv } from '@/utils/kv';

import en from '@/i18n/en.json';
import ar from '@/i18n/ar.json';
import tr from '@/i18n/tr.json';
import id from '@/i18n/id.json';
import ms from '@/i18n/ms.json';

export type LocaleCode = 'en-US' | 'ar-SA' | 'tr-TR' | 'id-ID' | 'ms-MY';
export type Dictionary = Record<string, string>;

// Stable English source. All other locales fall back to this on missing keys.
const SOURCE: Dictionary = en as Dictionary;

const DICTS: Partial<Record<LocaleCode, Dictionary>> = {
  'en-US': en as Dictionary,
  'ar-SA': ar as Dictionary,
  'tr-TR': tr as Dictionary,
  'id-ID': id as Dictionary,
  'ms-MY': ms as Dictionary,
};

let currentLocale: LocaleCode = (kv.get('locale') as LocaleCode) ?? 'en-US';

const listeners = new Set<() => void>();

export function getLocale(): LocaleCode {
  return currentLocale;
}

export function setLocale(code: LocaleCode) {
  if (code === currentLocale) return;
  currentLocale = code;
  listeners.forEach((l) => l());
}

export function onLocaleChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Translate a key. Variables: t('greet', { name: 'Sara' }) where the value
 *  is "Hi {name}". Falls back to English if the active locale doesn't have
 *  the key, then to the key itself if English doesn't either. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const dict = DICTS[currentLocale] ?? SOURCE;
  let raw = dict[key];
  if (raw == null) {
    if (__DEV__ && currentLocale !== 'en-US') {
      // eslint-disable-next-line no-console
      console.warn(`[i18n] missing "${key}" in ${currentLocale}`);
    }
    raw = SOURCE[key] ?? key;
  }
  if (vars) {
    return raw.replace(/\{(\w+)\}/g, (_, name) =>
      String(vars[name] ?? `{${name}}`),
    );
  }
  return raw;
}
