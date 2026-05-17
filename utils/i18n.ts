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
import ru from '@/i18n/ru.json';
import kk from '@/i18n/kk.json';
import es from '@/i18n/es-ES.json';
import fr from '@/i18n/fr-FR.json';
import de from '@/i18n/de-DE.json';
import ptBR from '@/i18n/pt-BR.json';
import it from '@/i18n/it-IT.json';
import zhCN from '@/i18n/zh-CN.json';
import ja from '@/i18n/ja-JP.json';
import ko from '@/i18n/ko-KR.json';
import hi from '@/i18n/hi-IN.json';
import vi from '@/i18n/vi-VN.json';
import th from '@/i18n/th-TH.json';
import fa from '@/i18n/fa-IR.json';
import nl from '@/i18n/nl-NL.json';
import pl from '@/i18n/pl-PL.json';
import uk from '@/i18n/uk-UA.json';
import cs from '@/i18n/cs-CZ.json';
import hu from '@/i18n/hu-HU.json';
import ro from '@/i18n/ro-RO.json';
import el from '@/i18n/el-GR.json';
import sv from '@/i18n/sv-SE.json';
import da from '@/i18n/da-DK.json';
import fi from '@/i18n/fi-FI.json';
import nb from '@/i18n/nb-NO.json';
import he from '@/i18n/he-IL.json';
import bg from '@/i18n/bg-BG.json';
import hr from '@/i18n/hr-HR.json';
import sr from '@/i18n/sr-RS.json';

// LocaleCode is a wide string union — every entry in LOCALES inside the
// settings screen must use a code listed here. Most are not yet mapped
// into DICTS (no translation file yet); selecting them today renders
// the English fallback per the t() function below. Translation files
// land incrementally per follow-up commit.
export type LocaleCode =
  | 'en-US' | 'ar-SA' | 'tr-TR' | 'id-ID' | 'ms-MY' | 'ru-RU' | 'kk-KZ'
  | 'es-ES' | 'fr-FR' | 'de-DE' | 'pt-BR' | 'it-IT' | 'nl-NL'
  | 'ja-JP' | 'ko-KR' | 'zh-CN' | 'zh-TW' | 'hi-IN' | 'bn-BD' | 'ur-PK'
  | 'vi-VN' | 'th-TH' | 'fa-IR' | 'he-IL' | 'pl-PL' | 'uk-UA' | 'cs-CZ'
  | 'hu-HU' | 'ro-RO' | 'el-GR' | 'sv-SE' | 'da-DK' | 'nb-NO' | 'fi-FI'
  | 'bg-BG' | 'hr-HR' | 'sr-RS' | 'sk-SK' | 'sl-SI' | 'lt-LT' | 'lv-LV'
  | 'et-EE' | 'sq-AL' | 'az-AZ' | 'uz-UZ' | 'fil-PH' | 'sw-KE' | 'ta-IN'
  | 'te-IN' | 'mr-IN';
export type Dictionary = Record<string, string>;

// Stable English source. All other locales fall back to this on missing keys.
const SOURCE: Dictionary = en as Dictionary;

const DICTS: Partial<Record<LocaleCode, Dictionary>> = {
  'en-US': en as Dictionary,
  'ar-SA': ar as Dictionary,
  'tr-TR': tr as Dictionary,
  'id-ID': id as Dictionary,
  'ms-MY': ms as Dictionary,
  'ru-RU': ru as Dictionary,
  'kk-KZ': kk as Dictionary,
  'es-ES': es as Dictionary,
  'fr-FR': fr as Dictionary,
  'de-DE': de as Dictionary,
  'pt-BR': ptBR as Dictionary,
  'it-IT': it as Dictionary,
  'zh-CN': zhCN as Dictionary,
  'ja-JP': ja as Dictionary,
  'ko-KR': ko as Dictionary,
  'hi-IN': hi as Dictionary,
  'vi-VN': vi as Dictionary,
  'th-TH': th as Dictionary,
  'fa-IR': fa as Dictionary,
  'nl-NL': nl as Dictionary,
  'pl-PL': pl as Dictionary,
  'uk-UA': uk as Dictionary,
  'cs-CZ': cs as Dictionary,
  'hu-HU': hu as Dictionary,
  'ro-RO': ro as Dictionary,
  'el-GR': el as Dictionary,
  'sv-SE': sv as Dictionary,
  'da-DK': da as Dictionary,
  'fi-FI': fi as Dictionary,
  'nb-NO': nb as Dictionary,
  'he-IL': he as Dictionary,
  'bg-BG': bg as Dictionary,
  'hr-HR': hr as Dictionary,
  'sr-RS': sr as Dictionary,
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
