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
  // GCC + MENA
  SA: 'SAR', AE: 'AED', QA: 'QAR', KW: 'KWD', BH: 'BHD', OM: 'OMR',
  JO: 'JOD', LB: 'LBP', IQ: 'IQD', YE: 'YER', SY: 'SYP', PS: 'JOD',
  EG: 'EGP', MA: 'MAD', TN: 'TND', DZ: 'DZD', LY: 'LYD',
  // South Asia
  PK: 'PKR', IN: 'INR', BD: 'BDT', LK: 'LKR', NP: 'NPR', BT: 'BTN',
  MV: 'MVR', AF: 'AFN',
  // Southeast Asia
  ID: 'IDR', MY: 'MYR', SG: 'SGD', BN: 'BND', PH: 'PHP', TH: 'THB',
  VN: 'VND', KH: 'KHR', LA: 'LAK', MM: 'MMK',
  // East Asia
  CN: 'CNY', JP: 'JPY', KR: 'KRW', TW: 'TWD', HK: 'HKD', MO: 'MOP', MN: 'MNT',
  // Anatolia / CIS
  TR: 'TRY', KZ: 'KZT', RU: 'RUB', KG: 'KGS', UZ: 'UZS', TJ: 'TJS',
  TM: 'TMT', AZ: 'AZN', AM: 'AMD', GE: 'GEL', BY: 'BYN', MD: 'MDL', UA: 'UAH',
  // Europe — eurozone
  IE: 'EUR', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR',
  AT: 'EUR', PT: 'EUR', GR: 'EUR', LU: 'EUR', FI: 'EUR', SK: 'EUR', SI: 'EUR',
  EE: 'EUR', LV: 'EUR', LT: 'EUR', CY: 'EUR', MT: 'EUR', HR: 'EUR',
  // Europe — non-euro
  GB: 'GBP', CH: 'CHF', NO: 'NOK', SE: 'SEK', DK: 'DKK', IS: 'ISK',
  PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', BG: 'BGN', RS: 'RSD',
  AL: 'ALL', MK: 'MKD', BA: 'BAM',
  // Americas
  US: 'USD', CA: 'CAD', MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP',
  CO: 'COP', PE: 'PEN', VE: 'VES', UY: 'UYU', BO: 'BOB', PY: 'PYG',
  GT: 'GTQ', CR: 'CRC', PA: 'PAB', DO: 'DOP', HN: 'HNL', NI: 'NIO', CU: 'CUP',
  JM: 'JMD', TT: 'TTD', BB: 'BBD', BS: 'BSD', BM: 'BMD',
  // Africa
  NG: 'NGN', ZA: 'ZAR', KE: 'KES', GH: 'GHS', ET: 'ETB', UG: 'UGX', TZ: 'TZS',
  AO: 'AOA', BW: 'BWP', BI: 'BIF', CD: 'CDF', CV: 'CVE', DJ: 'DJF',
  ER: 'ERN', GM: 'GMD', GN: 'GNF', HT: 'HTG', LR: 'LRD', LS: 'LSL',
  MG: 'MGA', ML: 'XOF', MR: 'MRU', MU: 'MUR', MW: 'MWK', MZ: 'MZN',
  NA: 'NAD', RW: 'RWF', SC: 'SCR', SD: 'SDG', SL: 'SLE', SO: 'SOS',
  SS: 'SSP', ST: 'STN', SZ: 'SZL', ZM: 'ZMW', ZW: 'ZWL',
  // Pacific
  AU: 'AUD', NZ: 'NZD', FJ: 'FJD', PG: 'PGK', SB: 'SBD', WS: 'WST',
  TO: 'TOP', VU: 'VUV',
  // Caribbean East
  AG: 'XCD', DM: 'XCD', GD: 'XCD', KN: 'XCD', LC: 'XCD', VC: 'XCD',
  // Other
  IL: 'ILS', IR: 'IRR', KP: 'KPW',
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
  KZ: 'kk-KZ',
  RU: 'ru-RU',
};

/** Currency-alternative groups shown in onboarding's step 2 under the
 *  detected default. Returns 3-4 codes the user is most likely to want
 *  given their detected currency. The detected currency itself is
 *  filtered out so it doesn't appear twice. */
export function currencyAlternativesFor(primary: CurrencyCode): CurrencyCode[] {
  const map: Partial<Record<CurrencyCode, CurrencyCode[]>> = {
    KZT: ['USD', 'RUB', 'EUR'],
    RUB: ['USD', 'EUR', 'KZT'],
    TRY: ['USD', 'EUR', 'GBP'],
    IDR: ['USD', 'SGD', 'MYR'],
    MYR: ['USD', 'SGD', 'IDR'],
    SGD: ['USD', 'MYR', 'IDR'],
    AED: ['USD', 'EUR', 'SAR'],
    SAR: ['USD', 'EUR', 'AED'],
    QAR: ['USD', 'SAR', 'AED'],
    EGP: ['USD', 'EUR', 'SAR'],
    PKR: ['USD', 'AED', 'INR'],
    INR: ['USD', 'EUR', 'AED'],
    BDT: ['USD', 'INR', 'EUR'],
    GBP: ['EUR', 'USD', 'AUD'],
    EUR: ['USD', 'GBP', 'CHF'],
    USD: ['EUR', 'GBP', 'CAD'],
    CAD: ['USD', 'EUR', 'GBP'],
    AUD: ['USD', 'NZD', 'EUR'],
    NZD: ['AUD', 'USD', 'EUR'],
    CHF: ['EUR', 'USD', 'GBP'],
    JPY: ['USD', 'EUR', 'CNY'],
    CNY: ['USD', 'EUR', 'HKD'],
    KRW: ['USD', 'JPY', 'CNY'],
    TWD: ['USD', 'JPY', 'CNY'],
    HKD: ['USD', 'CNY', 'JPY'],
    BRL: ['USD', 'EUR', 'ARS'],
    ARS: ['USD', 'BRL', 'EUR'],
    MXN: ['USD', 'EUR', 'CAD'],
    ZAR: ['USD', 'EUR', 'GBP'],
    NGN: ['USD', 'EUR', 'GBP'],
    UAH: ['USD', 'EUR', 'PLN'],
    PLN: ['EUR', 'USD', 'GBP'],
    CZK: ['EUR', 'USD', 'GBP'],
    HUF: ['EUR', 'USD', 'GBP'],
    UZS: ['USD', 'RUB', 'KZT'],
    KGS: ['USD', 'RUB', 'KZT'],
    AZN: ['USD', 'EUR', 'RUB'],
    GEL: ['USD', 'EUR', 'RUB'],
    ILS: ['USD', 'EUR', 'GBP'],
    THB: ['USD', 'SGD', 'CNY'],
    VND: ['USD', 'SGD', 'CNY'],
    PHP: ['USD', 'SGD', 'JPY'],
  };
  const alts = map[primary] ?? ['USD', 'EUR', 'GBP'];
  return alts.filter((c) => c !== primary).slice(0, 3);
}

export function defaultCurrencyForRegion(region: string | null | undefined): CurrencyCode {
  if (!region) return 'USD';
  return REGION_TO_CURRENCY[region.toUpperCase()] ?? 'USD';
}

export function defaultLocaleForRegion(region: string | null | undefined, fallback: string): string {
  if (!region) return fallback;
  return REGION_TO_LOCALE[region.toUpperCase()] ?? fallback;
}
