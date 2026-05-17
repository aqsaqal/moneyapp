// Single source of truth for the 50-language list shown in onboarding,
// the settings language picker, and anywhere else that needs to map a
// locale code to a display name. Names are written in the *native* script
// so the picker reads naturally regardless of the active UI locale.
//
// `rtl: true` is the operational signal — the layout-direction flip on
// language change keys off this flag, not on the language tag.

import type { LocaleCode } from '@/utils/i18n';

export interface LocaleDef {
  code: LocaleCode;
  /** Native-script name shown to the user. */
  name: string;
  /** ASCII / English-language alias used for search ("kazakh" → kk-KZ). */
  alias: string;
  rtl: boolean;
}

export const LOCALES: readonly LocaleDef[] = [
  { code: 'en-US', name: 'English', alias: 'english', rtl: false },
  { code: 'zh-CN', name: '中文 (简体)', alias: 'chinese mandarin simplified', rtl: false },
  { code: 'hi-IN', name: 'हिन्दी', alias: 'hindi', rtl: false },
  { code: 'es-ES', name: 'Español', alias: 'spanish espanol', rtl: false },
  { code: 'fr-FR', name: 'Français', alias: 'french francais', rtl: false },
  { code: 'ar-SA', name: 'العربية', alias: 'arabic', rtl: true },
  { code: 'bn-BD', name: 'বাংলা', alias: 'bengali bangla', rtl: false },
  { code: 'ru-RU', name: 'Русский', alias: 'russian russkiy', rtl: false },
  { code: 'pt-BR', name: 'Português (BR)', alias: 'portuguese brazil portugues', rtl: false },
  { code: 'id-ID', name: 'Bahasa Indonesia', alias: 'indonesian bahasa', rtl: false },
  { code: 'ur-PK', name: 'اردو', alias: 'urdu', rtl: true },
  { code: 'de-DE', name: 'Deutsch', alias: 'german deutsch', rtl: false },
  { code: 'ja-JP', name: '日本語', alias: 'japanese nihongo', rtl: false },
  { code: 'ko-KR', name: '한국어', alias: 'korean hangugeo', rtl: false },
  { code: 'mr-IN', name: 'मराठी', alias: 'marathi', rtl: false },
  { code: 'te-IN', name: 'తెలుగు', alias: 'telugu', rtl: false },
  { code: 'vi-VN', name: 'Tiếng Việt', alias: 'vietnamese tieng viet', rtl: false },
  { code: 'it-IT', name: 'Italiano', alias: 'italian italiano', rtl: false },
  { code: 'tr-TR', name: 'Türkçe', alias: 'turkish turkce', rtl: false },
  { code: 'ta-IN', name: 'தமிழ்', alias: 'tamil', rtl: false },
  { code: 'th-TH', name: 'ไทย', alias: 'thai', rtl: false },
  { code: 'fa-IR', name: 'فارسی', alias: 'persian farsi', rtl: true },
  { code: 'pl-PL', name: 'Polski', alias: 'polish polski', rtl: false },
  { code: 'uk-UA', name: 'Українська', alias: 'ukrainian ukrayinska', rtl: false },
  { code: 'nl-NL', name: 'Nederlands', alias: 'dutch nederlands', rtl: false },
  { code: 'ro-RO', name: 'Română', alias: 'romanian romana', rtl: false },
  { code: 'hu-HU', name: 'Magyar', alias: 'hungarian magyar', rtl: false },
  { code: 'cs-CZ', name: 'Čeština', alias: 'czech cestina', rtl: false },
  { code: 'sv-SE', name: 'Svenska', alias: 'swedish svenska', rtl: false },
  { code: 'da-DK', name: 'Dansk', alias: 'danish dansk', rtl: false },
  { code: 'fi-FI', name: 'Suomi', alias: 'finnish suomi', rtl: false },
  { code: 'nb-NO', name: 'Norsk', alias: 'norwegian norsk bokmal', rtl: false },
  { code: 'he-IL', name: 'עברית', alias: 'hebrew ivrit', rtl: true },
  { code: 'el-GR', name: 'Ελληνικά', alias: 'greek ellinika', rtl: false },
  { code: 'bg-BG', name: 'Български', alias: 'bulgarian bulgarski', rtl: false },
  { code: 'hr-HR', name: 'Hrvatski', alias: 'croatian hrvatski', rtl: false },
  { code: 'sr-RS', name: 'Српски', alias: 'serbian srpski', rtl: false },
  { code: 'sk-SK', name: 'Slovenčina', alias: 'slovak slovencina', rtl: false },
  { code: 'sl-SI', name: 'Slovenščina', alias: 'slovenian slovenscina', rtl: false },
  { code: 'lt-LT', name: 'Lietuvių', alias: 'lithuanian lietuviu', rtl: false },
  { code: 'lv-LV', name: 'Latviešu', alias: 'latvian latviesu', rtl: false },
  { code: 'et-EE', name: 'Eesti', alias: 'estonian eesti', rtl: false },
  { code: 'fil-PH', name: 'Filipino', alias: 'filipino tagalog', rtl: false },
  { code: 'ms-MY', name: 'Bahasa Melayu', alias: 'malay bahasa melayu', rtl: false },
  { code: 'sw-KE', name: 'Kiswahili', alias: 'swahili kiswahili', rtl: false },
  { code: 'kk-KZ', name: 'Қазақша', alias: 'kazakh qazaqsha', rtl: false },
  { code: 'uz-UZ', name: 'Oʻzbekcha', alias: 'uzbek ozbekcha', rtl: false },
  { code: 'az-AZ', name: 'Azərbaycanca', alias: 'azerbaijani azerbaycanca', rtl: false },
  { code: 'sq-AL', name: 'Shqip', alias: 'albanian shqip', rtl: false },
  { code: 'zh-TW', name: '中文 (繁體)', alias: 'chinese traditional taiwan', rtl: false },
];

/** Regional default-language groupings for onboarding's "alternatives"
 *  section. Each group lists 5-6 codes the user is most likely to want
 *  given a detected region. The detected language itself is excluded
 *  by the picker — these are the *other* choices below it. */
const ALT_GROUPS = {
  cis:     ['kk-KZ', 'ru-RU', 'en-US', 'tr-TR', 'ar-SA'],
  mena:    ['ar-SA', 'en-US', 'tr-TR', 'fr-FR', 'id-ID'],
  sea:     ['id-ID', 'ms-MY', 'en-US', 'ar-SA', 'vi-VN'],
  europe:  ['en-US', 'de-DE', 'fr-FR', 'es-ES', 'tr-TR'],
  southAsia: ['hi-IN', 'en-US', 'bn-BD', 'ur-PK', 'ta-IN'],
  eastAsia:  ['zh-CN', 'ja-JP', 'ko-KR', 'en-US', 'zh-TW'],
  default: ['en-US', 'es-ES', 'fr-FR', 'de-DE', 'ar-SA'],
} as const satisfies Record<string, readonly LocaleCode[]>;

function regionToGroup(region?: string | null): keyof typeof ALT_GROUPS {
  if (!region) return 'default';
  switch (region.toUpperCase()) {
    case 'KZ': case 'RU': case 'KG': case 'UZ': case 'TJ': case 'TM':
    case 'AM': case 'AZ': case 'GE': case 'BY': case 'MD':
      return 'cis';
    case 'SA': case 'AE': case 'EG': case 'QA': case 'KW': case 'BH':
    case 'OM': case 'JO': case 'LB': case 'IQ': case 'YE': case 'MA':
    case 'TN': case 'DZ': case 'LY': case 'SY': case 'PS':
      return 'mena';
    case 'ID': case 'MY': case 'SG': case 'BN': case 'PH': case 'TH': case 'VN':
      return 'sea';
    case 'GB': case 'IE': case 'DE': case 'FR': case 'ES': case 'IT':
    case 'NL': case 'BE': case 'AT': case 'CH': case 'PT': case 'GR':
    case 'PL': case 'CZ': case 'SK': case 'HU': case 'RO': case 'BG':
    case 'HR': case 'SI': case 'LT': case 'LV': case 'EE': case 'FI':
    case 'SE': case 'DK': case 'NO': case 'IS':
      return 'europe';
    case 'IN': case 'BD': case 'PK': case 'LK': case 'NP':
      return 'southAsia';
    case 'CN': case 'JP': case 'KR': case 'TW': case 'HK':
      return 'eastAsia';
    default:
      return 'default';
  }
}

/** Returns 5-6 codes appropriate for a region, excluding the
 *  already-detected primary so it isn't shown twice. */
export function languageAlternativesForRegion(
  region: string | null | undefined,
  primary: LocaleCode,
): readonly LocaleCode[] {
  const group = ALT_GROUPS[regionToGroup(region)];
  // Always offer English as a safety net even if it's not in the group.
  const withEnglish: LocaleCode[] = group.includes('en-US')
    ? [...group]
    : [...group, 'en-US'];
  return withEnglish.filter((c) => c !== primary).slice(0, 5);
}

/** Case- and accent-insensitive haystack used by the search modal. */
export function localeSearchHaystack(l: LocaleDef): string {
  // Normalize away diacritics so "espanol" matches "Español".
  // ̀-ͯ is the combining-diacritical-marks block.
  return `${l.code} ${l.name} ${l.alias}`
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

/** Same normalization for the user's query string. */
export function normalizeQuery(q: string): string {
  return q.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
}
