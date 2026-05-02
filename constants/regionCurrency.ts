// Region → default currency mapping. Used at first-launch onboarding to
// pre-select the user's likely currency from `Localization.region`.
//
// Phase 8 (MENA polish): Amanah specifically targets MENA + Pakistan +
// Indonesia + Malaysia + Turkey. Make sure those regions land on the
// right local currency by default; a Saudi user shouldn't have to scroll
// past USD/EUR/GBP to find SAR.

import type { CurrencyCode } from './currency';

/** ISO 3166-1 alpha-2 region code → ISO 4217 currency code. */
export const REGION_TO_CURRENCY: Record<string, CurrencyCode> = {
  // GCC
  SA: 'SAR', // Saudi Arabia
  AE: 'AED', // United Arab Emirates
  // North Africa / Middle East
  EG: 'EGP', // Egypt
  // South Asia
  PK: 'PKR', // Pakistan
  // Southeast Asia
  ID: 'IDR', // Indonesia
  MY: 'MYR', // Malaysia
  // Anatolia
  TR: 'TRY', // Turkey
  // English-speaking defaults (already in v1)
  US: 'USD',
  GB: 'GBP',
  IE: 'EUR',
  CA: 'USD', // CAD not yet listed; fall through to USD
  AU: 'USD', // AUD not yet listed; fall through to USD
  // Eurozone (subset; rest fall through to USD)
  DE: 'EUR',
  FR: 'EUR',
  ES: 'EUR',
  IT: 'EUR',
  NL: 'EUR',
};

/** Region → likely default locale (used when device locale is generic English). */
export const REGION_TO_LOCALE: Record<string, string> = {
  SA: 'ar-SA',
  AE: 'ar-AE',
  EG: 'ar-EG',
  PK: 'ur-PK',
  ID: 'id-ID',
  MY: 'ms-MY',
  TR: 'tr-TR',
};

export function defaultCurrencyForRegion(region: string | null | undefined): CurrencyCode {
  if (!region) return 'USD';
  return REGION_TO_CURRENCY[region.toUpperCase()] ?? 'USD';
}

export function defaultLocaleForRegion(region: string | null | undefined, fallback: string): string {
  if (!region) return fallback;
  return REGION_TO_LOCALE[region.toUpperCase()] ?? fallback;
}
