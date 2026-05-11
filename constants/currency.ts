// Multi-currency formatting — plumbed in Phase 1 per decision #3.
// Phase 8: locale-aware numeral system. When the device/user locale starts
// with `ar` AND the user hasn't disabled the Arabic-numerals toggle in Me,
// we render Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) by appending the BCP-47
// `-u-nu-arab` extension to the locale passed to Intl.NumberFormat.

import { kv } from '@/utils/kv';

// ISO 4217. `CurrencyCode` is the discriminated string union of every
// currency the app supports. "Main" currencies are the most common ones
// shown in the top tab of the picker (USD, EUR, GBP, etc.); "Other"
// currencies live under the second tab. The split is purely UX —
// formatMoney() / convert() / nisab math work identically for any code.

export type CurrencyCode =
  // Main — top of the picker, region defaults
  | 'USD' | 'EUR' | 'GBP' | 'JPY' | 'CHF' | 'CAD' | 'AUD' | 'CNY' | 'NZD'
  // Existing targets (Phases 5–10)
  | 'SAR' | 'AED' | 'MYR' | 'IDR' | 'TRY' | 'PKR' | 'EGP' | 'KZT' | 'RUB'
  // MENA + Africa
  | 'QAR' | 'KWD' | 'BHD' | 'OMR' | 'JOD' | 'LBP' | 'IQD' | 'YER' | 'MAD' | 'TND' | 'DZD' | 'LYD' | 'NGN' | 'ZAR' | 'KES' | 'GHS' | 'ETB' | 'UGX' | 'TZS' | 'XOF' | 'XAF'
  // South + Southeast Asia + Oceania
  | 'INR' | 'BDT' | 'LKR' | 'NPR' | 'MVR' | 'AFN' | 'BTN' | 'MMK' | 'THB' | 'VND' | 'PHP' | 'SGD' | 'HKD' | 'TWD' | 'KRW' | 'MOP' | 'BND' | 'KHR' | 'LAK' | 'MNT' | 'FJD'
  // Europe (non-EUR)
  | 'NOK' | 'SEK' | 'DKK' | 'ISK' | 'PLN' | 'CZK' | 'HUF' | 'RON' | 'BGN' | 'HRK' | 'RSD' | 'UAH' | 'BYN' | 'MDL' | 'ALL' | 'MKD' | 'BAM' | 'GEL' | 'AMD' | 'AZN'
  // Central Asia
  | 'UZS' | 'KGS' | 'TJS' | 'TMT'
  // Latin America
  | 'BRL' | 'MXN' | 'ARS' | 'CLP' | 'COP' | 'PEN' | 'VES' | 'UYU' | 'BOB' | 'PYG' | 'GTQ' | 'CRC' | 'PAB' | 'DOP' | 'HNL' | 'NIO' | 'CUP'
  // Caribbean / Pacific
  | 'JMD' | 'TTD' | 'BBD' | 'BSD' | 'BMD' | 'XCD' | 'PGK' | 'SBD' | 'WST' | 'TOP' | 'VUV'
  // Other
  | 'ILS' | 'IRR';

export interface CurrencyDef {
  code: CurrencyCode;
  name: string;
  symbol: string;
  symbolNative: string;
  decimalDigits: number;
  /** "main" = top tab of the currency picker; "other" = second tab. */
  tier: 'main' | 'other';
}

export const CURRENCIES: Record<CurrencyCode, CurrencyDef> = {
  // ---- Main ----
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', symbolNative: '$', decimalDigits: 2, tier: 'main' },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', symbolNative: '€', decimalDigits: 2, tier: 'main' },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', symbolNative: '£', decimalDigits: 2, tier: 'main' },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '¥', symbolNative: '¥', decimalDigits: 0, tier: 'main' },
  CHF: { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', symbolNative: 'Fr.', decimalDigits: 2, tier: 'main' },
  CAD: { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', symbolNative: '$', decimalDigits: 2, tier: 'main' },
  AUD: { code: 'AUD', name: 'Australian Dollar', symbol: 'AU$', symbolNative: '$', decimalDigits: 2, tier: 'main' },
  CNY: { code: 'CNY', name: 'Chinese Yuan', symbol: 'CN¥', symbolNative: '¥', decimalDigits: 2, tier: 'main' },
  NZD: { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', symbolNative: '$', decimalDigits: 2, tier: 'main' },
  RUB: { code: 'RUB', name: 'Russian Ruble', symbol: '₽', symbolNative: '₽', decimalDigits: 2, tier: 'main' },
  KZT: { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸', symbolNative: '₸', decimalDigits: 2, tier: 'main' },
  SAR: { code: 'SAR', name: 'Saudi Riyal', symbol: 'SR', symbolNative: 'ر.س', decimalDigits: 2, tier: 'main' },
  AED: { code: 'AED', name: 'UAE Dirham', symbol: 'AED', symbolNative: 'د.إ', decimalDigits: 2, tier: 'main' },
  TRY: { code: 'TRY', name: 'Turkish Lira', symbol: '₺', symbolNative: '₺', decimalDigits: 2, tier: 'main' },
  INR: { code: 'INR', name: 'Indian Rupee', symbol: '₹', symbolNative: '₹', decimalDigits: 2, tier: 'main' },
  // ---- Other (alphabetical) ----
  AFN: { code: 'AFN', name: 'Afghan Afghani', symbol: '؋', symbolNative: '؋', decimalDigits: 2, tier: 'other' },
  ALL: { code: 'ALL', name: 'Albanian Lek', symbol: 'L', symbolNative: 'L', decimalDigits: 2, tier: 'other' },
  AMD: { code: 'AMD', name: 'Armenian Dram', symbol: '֏', symbolNative: '֏', decimalDigits: 2, tier: 'other' },
  ARS: { code: 'ARS', name: 'Argentine Peso', symbol: '$', symbolNative: '$', decimalDigits: 2, tier: 'other' },
  AZN: { code: 'AZN', name: 'Azerbaijani Manat', symbol: '₼', symbolNative: '₼', decimalDigits: 2, tier: 'other' },
  BBD: { code: 'BBD', name: 'Barbadian Dollar', symbol: '$', symbolNative: '$', decimalDigits: 2, tier: 'other' },
  BDT: { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', symbolNative: '৳', decimalDigits: 2, tier: 'other' },
  BGN: { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв', symbolNative: 'лв', decimalDigits: 2, tier: 'other' },
  BHD: { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BD', symbolNative: 'د.ب', decimalDigits: 3, tier: 'other' },
  BMD: { code: 'BMD', name: 'Bermudian Dollar', symbol: '$', symbolNative: '$', decimalDigits: 2, tier: 'other' },
  BND: { code: 'BND', name: 'Brunei Dollar', symbol: '$', symbolNative: '$', decimalDigits: 2, tier: 'other' },
  BOB: { code: 'BOB', name: 'Bolivian Boliviano', symbol: 'Bs', symbolNative: 'Bs', decimalDigits: 2, tier: 'other' },
  BRL: { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', symbolNative: 'R$', decimalDigits: 2, tier: 'other' },
  BSD: { code: 'BSD', name: 'Bahamian Dollar', symbol: '$', symbolNative: '$', decimalDigits: 2, tier: 'other' },
  BTN: { code: 'BTN', name: 'Bhutanese Ngultrum', symbol: 'Nu', symbolNative: 'Nu', decimalDigits: 2, tier: 'other' },
  BAM: { code: 'BAM', name: 'Bosnia-Herzegovina Mark', symbol: 'KM', symbolNative: 'KM', decimalDigits: 2, tier: 'other' },
  BYN: { code: 'BYN', name: 'Belarusian Ruble', symbol: 'Br', symbolNative: 'Br', decimalDigits: 2, tier: 'other' },
  CLP: { code: 'CLP', name: 'Chilean Peso', symbol: '$', symbolNative: '$', decimalDigits: 0, tier: 'other' },
  COP: { code: 'COP', name: 'Colombian Peso', symbol: '$', symbolNative: '$', decimalDigits: 2, tier: 'other' },
  CRC: { code: 'CRC', name: 'Costa Rican Colón', symbol: '₡', symbolNative: '₡', decimalDigits: 2, tier: 'other' },
  CUP: { code: 'CUP', name: 'Cuban Peso', symbol: '$', symbolNative: '$', decimalDigits: 2, tier: 'other' },
  CZK: { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', symbolNative: 'Kč', decimalDigits: 2, tier: 'other' },
  DKK: { code: 'DKK', name: 'Danish Krone', symbol: 'kr', symbolNative: 'kr', decimalDigits: 2, tier: 'other' },
  DOP: { code: 'DOP', name: 'Dominican Peso', symbol: 'RD$', symbolNative: 'RD$', decimalDigits: 2, tier: 'other' },
  DZD: { code: 'DZD', name: 'Algerian Dinar', symbol: 'DA', symbolNative: 'د.ج', decimalDigits: 2, tier: 'other' },
  EGP: { code: 'EGP', name: 'Egyptian Pound', symbol: '£E', symbolNative: 'ج.م', decimalDigits: 2, tier: 'other' },
  ETB: { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br', symbolNative: 'Br', decimalDigits: 2, tier: 'other' },
  FJD: { code: 'FJD', name: 'Fijian Dollar', symbol: '$', symbolNative: '$', decimalDigits: 2, tier: 'other' },
  GEL: { code: 'GEL', name: 'Georgian Lari', symbol: '₾', symbolNative: '₾', decimalDigits: 2, tier: 'other' },
  GHS: { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', symbolNative: '₵', decimalDigits: 2, tier: 'other' },
  GTQ: { code: 'GTQ', name: 'Guatemalan Quetzal', symbol: 'Q', symbolNative: 'Q', decimalDigits: 2, tier: 'other' },
  HKD: { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', symbolNative: '$', decimalDigits: 2, tier: 'other' },
  HNL: { code: 'HNL', name: 'Honduran Lempira', symbol: 'L', symbolNative: 'L', decimalDigits: 2, tier: 'other' },
  HRK: { code: 'HRK', name: 'Croatian Kuna', symbol: 'kn', symbolNative: 'kn', decimalDigits: 2, tier: 'other' },
  HUF: { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft', symbolNative: 'Ft', decimalDigits: 0, tier: 'other' },
  IDR: { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', symbolNative: 'Rp', decimalDigits: 0, tier: 'other' },
  ILS: { code: 'ILS', name: 'Israeli Shekel', symbol: '₪', symbolNative: '₪', decimalDigits: 2, tier: 'other' },
  IQD: { code: 'IQD', name: 'Iraqi Dinar', symbol: 'IQD', symbolNative: 'د.ع', decimalDigits: 3, tier: 'other' },
  IRR: { code: 'IRR', name: 'Iranian Rial', symbol: 'IRR', symbolNative: 'ریال', decimalDigits: 2, tier: 'other' },
  ISK: { code: 'ISK', name: 'Icelandic Króna', symbol: 'kr', symbolNative: 'kr', decimalDigits: 0, tier: 'other' },
  JMD: { code: 'JMD', name: 'Jamaican Dollar', symbol: '$', symbolNative: '$', decimalDigits: 2, tier: 'other' },
  JOD: { code: 'JOD', name: 'Jordanian Dinar', symbol: 'JD', symbolNative: 'د.أ', decimalDigits: 3, tier: 'other' },
  KES: { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', symbolNative: 'KSh', decimalDigits: 2, tier: 'other' },
  KGS: { code: 'KGS', name: 'Kyrgyzstani Som', symbol: 'с', symbolNative: 'с', decimalDigits: 2, tier: 'other' },
  KHR: { code: 'KHR', name: 'Cambodian Riel', symbol: '៛', symbolNative: '៛', decimalDigits: 2, tier: 'other' },
  KRW: { code: 'KRW', name: 'South Korean Won', symbol: '₩', symbolNative: '₩', decimalDigits: 0, tier: 'other' },
  KWD: { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KD', symbolNative: 'د.ك', decimalDigits: 3, tier: 'other' },
  LAK: { code: 'LAK', name: 'Lao Kip', symbol: '₭', symbolNative: '₭', decimalDigits: 2, tier: 'other' },
  LBP: { code: 'LBP', name: 'Lebanese Pound', symbol: 'L£', symbolNative: 'ل.ل', decimalDigits: 2, tier: 'other' },
  LKR: { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs', symbolNative: 'රු', decimalDigits: 2, tier: 'other' },
  LYD: { code: 'LYD', name: 'Libyan Dinar', symbol: 'LD', symbolNative: 'د.ل', decimalDigits: 3, tier: 'other' },
  MAD: { code: 'MAD', name: 'Moroccan Dirham', symbol: 'DH', symbolNative: 'د.م.', decimalDigits: 2, tier: 'other' },
  MDL: { code: 'MDL', name: 'Moldovan Leu', symbol: 'L', symbolNative: 'L', decimalDigits: 2, tier: 'other' },
  MKD: { code: 'MKD', name: 'Macedonian Denar', symbol: 'ден', symbolNative: 'ден', decimalDigits: 2, tier: 'other' },
  MMK: { code: 'MMK', name: 'Myanmar Kyat', symbol: 'K', symbolNative: 'K', decimalDigits: 2, tier: 'other' },
  MNT: { code: 'MNT', name: 'Mongolian Tögrög', symbol: '₮', symbolNative: '₮', decimalDigits: 2, tier: 'other' },
  MOP: { code: 'MOP', name: 'Macanese Pataca', symbol: 'MOP$', symbolNative: 'MOP$', decimalDigits: 2, tier: 'other' },
  MVR: { code: 'MVR', name: 'Maldivian Rufiyaa', symbol: 'Rf', symbolNative: 'Rf', decimalDigits: 2, tier: 'other' },
  MXN: { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', symbolNative: '$', decimalDigits: 2, tier: 'other' },
  MYR: { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', symbolNative: 'RM', decimalDigits: 2, tier: 'other' },
  NGN: { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', symbolNative: '₦', decimalDigits: 2, tier: 'other' },
  NIO: { code: 'NIO', name: 'Nicaraguan Córdoba', symbol: 'C$', symbolNative: 'C$', decimalDigits: 2, tier: 'other' },
  NOK: { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', symbolNative: 'kr', decimalDigits: 2, tier: 'other' },
  NPR: { code: 'NPR', name: 'Nepalese Rupee', symbol: 'Rs', symbolNative: 'रु', decimalDigits: 2, tier: 'other' },
  OMR: { code: 'OMR', name: 'Omani Rial', symbol: 'OR', symbolNative: 'ر.ع.', decimalDigits: 3, tier: 'other' },
  PAB: { code: 'PAB', name: 'Panamanian Balboa', symbol: 'B/.', symbolNative: 'B/.', decimalDigits: 2, tier: 'other' },
  PEN: { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/', symbolNative: 'S/', decimalDigits: 2, tier: 'other' },
  PGK: { code: 'PGK', name: 'Papua New Guinea Kina', symbol: 'K', symbolNative: 'K', decimalDigits: 2, tier: 'other' },
  PHP: { code: 'PHP', name: 'Philippine Peso', symbol: '₱', symbolNative: '₱', decimalDigits: 2, tier: 'other' },
  PKR: { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', symbolNative: '₨', decimalDigits: 2, tier: 'other' },
  PLN: { code: 'PLN', name: 'Polish Złoty', symbol: 'zł', symbolNative: 'zł', decimalDigits: 2, tier: 'other' },
  PYG: { code: 'PYG', name: 'Paraguayan Guaraní', symbol: '₲', symbolNative: '₲', decimalDigits: 0, tier: 'other' },
  QAR: { code: 'QAR', name: 'Qatari Riyal', symbol: 'QR', symbolNative: 'ر.ق', decimalDigits: 2, tier: 'other' },
  RON: { code: 'RON', name: 'Romanian Leu', symbol: 'lei', symbolNative: 'lei', decimalDigits: 2, tier: 'other' },
  RSD: { code: 'RSD', name: 'Serbian Dinar', symbol: 'дин', symbolNative: 'дин', decimalDigits: 2, tier: 'other' },
  SBD: { code: 'SBD', name: 'Solomon Islands Dollar', symbol: '$', symbolNative: '$', decimalDigits: 2, tier: 'other' },
  SEK: { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', symbolNative: 'kr', decimalDigits: 2, tier: 'other' },
  SGD: { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', symbolNative: '$', decimalDigits: 2, tier: 'other' },
  THB: { code: 'THB', name: 'Thai Baht', symbol: '฿', symbolNative: '฿', decimalDigits: 2, tier: 'other' },
  TJS: { code: 'TJS', name: 'Tajikistani Somoni', symbol: 'SM', symbolNative: 'SM', decimalDigits: 2, tier: 'other' },
  TMT: { code: 'TMT', name: 'Turkmenistani Manat', symbol: 'T', symbolNative: 'T', decimalDigits: 2, tier: 'other' },
  TND: { code: 'TND', name: 'Tunisian Dinar', symbol: 'DT', symbolNative: 'د.ت', decimalDigits: 3, tier: 'other' },
  TOP: { code: 'TOP', name: 'Tongan Paʻanga', symbol: 'T$', symbolNative: 'T$', decimalDigits: 2, tier: 'other' },
  TTD: { code: 'TTD', name: 'Trinidad and Tobago Dollar', symbol: '$', symbolNative: '$', decimalDigits: 2, tier: 'other' },
  TWD: { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', symbolNative: 'NT$', decimalDigits: 2, tier: 'other' },
  TZS: { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', symbolNative: 'TSh', decimalDigits: 2, tier: 'other' },
  UAH: { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴', symbolNative: '₴', decimalDigits: 2, tier: 'other' },
  UGX: { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', symbolNative: 'USh', decimalDigits: 0, tier: 'other' },
  UYU: { code: 'UYU', name: 'Uruguayan Peso', symbol: '$U', symbolNative: '$', decimalDigits: 2, tier: 'other' },
  UZS: { code: 'UZS', name: 'Uzbekistani Som', symbol: 'soʻm', symbolNative: 'soʻm', decimalDigits: 2, tier: 'other' },
  VES: { code: 'VES', name: 'Venezuelan Bolívar', symbol: 'Bs.S', symbolNative: 'Bs.', decimalDigits: 2, tier: 'other' },
  VND: { code: 'VND', name: 'Vietnamese Đồng', symbol: '₫', symbolNative: '₫', decimalDigits: 0, tier: 'other' },
  VUV: { code: 'VUV', name: 'Vanuatu Vatu', symbol: 'VT', symbolNative: 'VT', decimalDigits: 0, tier: 'other' },
  WST: { code: 'WST', name: 'Samoan Tala', symbol: 'WS$', symbolNative: 'WS$', decimalDigits: 2, tier: 'other' },
  XAF: { code: 'XAF', name: 'Central African CFA Franc', symbol: 'FCFA', symbolNative: 'FCFA', decimalDigits: 0, tier: 'other' },
  XCD: { code: 'XCD', name: 'East Caribbean Dollar', symbol: 'EC$', symbolNative: '$', decimalDigits: 2, tier: 'other' },
  XOF: { code: 'XOF', name: 'West African CFA Franc', symbol: 'CFA', symbolNative: 'CFA', decimalDigits: 0, tier: 'other' },
  YER: { code: 'YER', name: 'Yemeni Rial', symbol: 'YR', symbolNative: 'ر.ي', decimalDigits: 2, tier: 'other' },
  ZAR: { code: 'ZAR', name: 'South African Rand', symbol: 'R', symbolNative: 'R', decimalDigits: 2, tier: 'other' },
};

export const MAIN_CURRENCIES: CurrencyCode[] = (Object.keys(CURRENCIES) as CurrencyCode[])
  .filter((c) => CURRENCIES[c].tier === 'main');

export const OTHER_CURRENCIES: CurrencyCode[] = (Object.keys(CURRENCIES) as CurrencyCode[])
  .filter((c) => CURRENCIES[c].tier === 'other')
  .sort((a, b) => CURRENCIES[a].name.localeCompare(CURRENCIES[b].name));

/** Effective locale for number formatting — applies the user's
 *  Arabic-numerals preference (default ON for ar-* locales). */
function effectiveLocale(locale?: string): string | undefined {
  const loc = locale ?? kv.get('locale');
  if (!loc) return undefined;
  if (!loc.startsWith('ar')) return loc;
  // Default ON for Arabic locales; user can flip via kv.arabicNumerals=false.
  const v = kv.get('arabicNumerals');
  const useArabic = v === undefined ? true : v === '1';
  return useArabic ? `${loc}-u-nu-arab` : loc;
}

/** Full-precision formatter. `$12.50`, `ر.س ١٢٫٥٠`. */
export function formatMoney(amount: number, code: CurrencyCode = 'USD', locale?: string): string {
  const abs = Math.abs(amount);
  const eff = effectiveLocale(locale);
  try {
    return new Intl.NumberFormat(eff, {
      style: 'currency',
      currency: code,
      currencyDisplay: 'narrowSymbol',
    }).format(abs);
  } catch {
    // Intl.NumberFormat isn't always fully supported on Hermes for every locale.
    const c = CURRENCIES[code];
    return `${c.symbol}${abs.toFixed(c.decimalDigits)}`;
  }
}

/** Short formatter for dense displays — v4's fmts(). `$1.5k` style. */
export function formatMoneyShort(amount: number, code: CurrencyCode = 'USD', locale?: string): string {
  const abs = Math.abs(amount);
  const c = CURRENCIES[code];
  const eff = effectiveLocale(locale);
  // Use Intl.NumberFormat for the digits when locale is set, so Arabic-Indic
  // digits flow through compact/short forms too.
  const fmt = (n: number, digits: number) => {
    try {
      return new Intl.NumberFormat(eff, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(n);
    } catch {
      return n.toFixed(digits);
    }
  };
  if (abs >= 1000) return `${c.symbol}${fmt(abs / 1000, 1)}k`;
  return `${c.symbol}${fmt(abs, 0)}`;
}
