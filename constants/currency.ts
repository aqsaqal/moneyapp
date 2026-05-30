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
  | 'ILS' | 'IRR'
  // Remaining ISO 4217 fiat (added in Phase 10x)
  | 'ANG' | 'AOA' | 'AWG' | 'BIF' | 'BWP' | 'BZD' | 'CDF' | 'CVE' | 'DJF'
  | 'ERN' | 'FKP' | 'GIP' | 'GMD' | 'GNF' | 'GYD' | 'HTG' | 'KMF' | 'KYD'
  | 'KPW' | 'LRD' | 'LSL' | 'MGA' | 'MRU' | 'MUR' | 'MWK' | 'MZN' | 'NAD'
  | 'RWF' | 'SCR' | 'SDG' | 'SHP' | 'SLE' | 'SOS' | 'SRD' | 'SSP' | 'STN'
  | 'SYP' | 'SZL' | 'ZMW' | 'ZWL'
  // Cryptocurrencies — top market cap
  | 'BTC' | 'ETH' | 'USDT' | 'USDC' | 'BNB' | 'XRP' | 'ADA' | 'SOL' | 'DOGE'
  | 'TRX' | 'TON' | 'AVAX' | 'DOT' | 'MATIC' | 'LINK' | 'BCH' | 'LTC' | 'SHIB'
  | 'XLM' | 'XMR' | 'ATOM' | 'ETC' | 'FIL' | 'ICP' | 'NEAR' | 'APT' | 'ARB'
  | 'OP' | 'HBAR' | 'ALGO'
  // Precious metals (ISO 4217)
  | 'XAU' | 'XAG' | 'XPT' | 'XPD';

export interface CurrencyDef {
  code: CurrencyCode;
  name: string;
  symbol: string;
  symbolNative: string;
  decimalDigits: number;
  /** Picker tab placement. */
  tier: 'main' | 'other' | 'crypto' | 'metals';
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
  // ---- Remaining ISO 4217 fiat (alphabetical) ----
  ANG: { code: 'ANG', name: 'Netherlands Antillean Guilder', symbol: 'ƒ', symbolNative: 'ƒ', decimalDigits: 2, tier: 'other' },
  AOA: { code: 'AOA', name: 'Angolan Kwanza', symbol: 'Kz', symbolNative: 'Kz', decimalDigits: 2, tier: 'other' },
  AWG: { code: 'AWG', name: 'Aruban Florin', symbol: 'ƒ', symbolNative: 'ƒ', decimalDigits: 2, tier: 'other' },
  BIF: { code: 'BIF', name: 'Burundian Franc', symbol: 'FBu', symbolNative: 'FBu', decimalDigits: 0, tier: 'other' },
  BWP: { code: 'BWP', name: 'Botswana Pula', symbol: 'P', symbolNative: 'P', decimalDigits: 2, tier: 'other' },
  BZD: { code: 'BZD', name: 'Belize Dollar', symbol: 'BZ$', symbolNative: 'BZ$', decimalDigits: 2, tier: 'other' },
  CDF: { code: 'CDF', name: 'Congolese Franc', symbol: 'FC', symbolNative: 'FC', decimalDigits: 2, tier: 'other' },
  CVE: { code: 'CVE', name: 'Cape Verdean Escudo', symbol: '$', symbolNative: '$', decimalDigits: 2, tier: 'other' },
  DJF: { code: 'DJF', name: 'Djiboutian Franc', symbol: 'Fdj', symbolNative: 'Fdj', decimalDigits: 0, tier: 'other' },
  ERN: { code: 'ERN', name: 'Eritrean Nakfa', symbol: 'Nfk', symbolNative: 'Nfk', decimalDigits: 2, tier: 'other' },
  FKP: { code: 'FKP', name: 'Falkland Islands Pound', symbol: '£', symbolNative: '£', decimalDigits: 2, tier: 'other' },
  GIP: { code: 'GIP', name: 'Gibraltar Pound', symbol: '£', symbolNative: '£', decimalDigits: 2, tier: 'other' },
  GMD: { code: 'GMD', name: 'Gambian Dalasi', symbol: 'D', symbolNative: 'D', decimalDigits: 2, tier: 'other' },
  GNF: { code: 'GNF', name: 'Guinean Franc', symbol: 'FG', symbolNative: 'FG', decimalDigits: 0, tier: 'other' },
  GYD: { code: 'GYD', name: 'Guyanese Dollar', symbol: 'G$', symbolNative: 'G$', decimalDigits: 2, tier: 'other' },
  HTG: { code: 'HTG', name: 'Haitian Gourde', symbol: 'G', symbolNative: 'G', decimalDigits: 2, tier: 'other' },
  KMF: { code: 'KMF', name: 'Comorian Franc', symbol: 'CF', symbolNative: 'CF', decimalDigits: 0, tier: 'other' },
  KYD: { code: 'KYD', name: 'Cayman Islands Dollar', symbol: 'CI$', symbolNative: 'CI$', decimalDigits: 2, tier: 'other' },
  KPW: { code: 'KPW', name: 'North Korean Won', symbol: '₩', symbolNative: '₩', decimalDigits: 2, tier: 'other' },
  LRD: { code: 'LRD', name: 'Liberian Dollar', symbol: 'L$', symbolNative: 'L$', decimalDigits: 2, tier: 'other' },
  LSL: { code: 'LSL', name: 'Lesotho Loti', symbol: 'L', symbolNative: 'L', decimalDigits: 2, tier: 'other' },
  MGA: { code: 'MGA', name: 'Malagasy Ariary', symbol: 'Ar', symbolNative: 'Ar', decimalDigits: 2, tier: 'other' },
  MRU: { code: 'MRU', name: 'Mauritanian Ouguiya', symbol: 'UM', symbolNative: 'UM', decimalDigits: 2, tier: 'other' },
  MUR: { code: 'MUR', name: 'Mauritian Rupee', symbol: '₨', symbolNative: '₨', decimalDigits: 2, tier: 'other' },
  MWK: { code: 'MWK', name: 'Malawian Kwacha', symbol: 'MK', symbolNative: 'MK', decimalDigits: 2, tier: 'other' },
  MZN: { code: 'MZN', name: 'Mozambican Metical', symbol: 'MT', symbolNative: 'MT', decimalDigits: 2, tier: 'other' },
  NAD: { code: 'NAD', name: 'Namibian Dollar', symbol: 'N$', symbolNative: 'N$', decimalDigits: 2, tier: 'other' },
  RWF: { code: 'RWF', name: 'Rwandan Franc', symbol: 'RF', symbolNative: 'RF', decimalDigits: 0, tier: 'other' },
  SCR: { code: 'SCR', name: 'Seychellois Rupee', symbol: 'SR', symbolNative: 'SR', decimalDigits: 2, tier: 'other' },
  SDG: { code: 'SDG', name: 'Sudanese Pound', symbol: 'SDG', symbolNative: 'ج.س.', decimalDigits: 2, tier: 'other' },
  SHP: { code: 'SHP', name: 'Saint Helena Pound', symbol: '£', symbolNative: '£', decimalDigits: 2, tier: 'other' },
  SLE: { code: 'SLE', name: 'Sierra Leonean Leone', symbol: 'Le', symbolNative: 'Le', decimalDigits: 2, tier: 'other' },
  SOS: { code: 'SOS', name: 'Somali Shilling', symbol: 'Sh', symbolNative: 'Sh', decimalDigits: 2, tier: 'other' },
  SRD: { code: 'SRD', name: 'Surinamese Dollar', symbol: 'Sr$', symbolNative: 'Sr$', decimalDigits: 2, tier: 'other' },
  SSP: { code: 'SSP', name: 'South Sudanese Pound', symbol: '£', symbolNative: '£', decimalDigits: 2, tier: 'other' },
  STN: { code: 'STN', name: 'São Tomé and Príncipe Dobra', symbol: 'Db', symbolNative: 'Db', decimalDigits: 2, tier: 'other' },
  SYP: { code: 'SYP', name: 'Syrian Pound', symbol: 'LS', symbolNative: 'ل.س', decimalDigits: 2, tier: 'other' },
  SZL: { code: 'SZL', name: 'Eswatini Lilangeni', symbol: 'L', symbolNative: 'L', decimalDigits: 2, tier: 'other' },
  ZMW: { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK', symbolNative: 'ZK', decimalDigits: 2, tier: 'other' },
  ZWL: { code: 'ZWL', name: 'Zimbabwean Dollar', symbol: 'Z$', symbolNative: 'Z$', decimalDigits: 2, tier: 'other' },
  // ---- Cryptocurrencies ----
  BTC: { code: 'BTC', name: 'Bitcoin', symbol: '₿', symbolNative: '₿', decimalDigits: 8, tier: 'crypto' },
  ETH: { code: 'ETH', name: 'Ethereum', symbol: 'Ξ', symbolNative: 'Ξ', decimalDigits: 6, tier: 'crypto' },
  USDT: { code: 'USDT', name: 'Tether', symbol: '₮', symbolNative: '₮', decimalDigits: 2, tier: 'crypto' },
  USDC: { code: 'USDC', name: 'USD Coin', symbol: 'USDC', symbolNative: 'USDC', decimalDigits: 2, tier: 'crypto' },
  BNB: { code: 'BNB', name: 'BNB', symbol: 'BNB', symbolNative: 'BNB', decimalDigits: 4, tier: 'crypto' },
  XRP: { code: 'XRP', name: 'XRP', symbol: 'XRP', symbolNative: 'XRP', decimalDigits: 4, tier: 'crypto' },
  ADA: { code: 'ADA', name: 'Cardano', symbol: '₳', symbolNative: '₳', decimalDigits: 4, tier: 'crypto' },
  SOL: { code: 'SOL', name: 'Solana', symbol: 'SOL', symbolNative: 'SOL', decimalDigits: 4, tier: 'crypto' },
  DOGE: { code: 'DOGE', name: 'Dogecoin', symbol: 'Ð', symbolNative: 'Ð', decimalDigits: 4, tier: 'crypto' },
  TRX: { code: 'TRX', name: 'TRON', symbol: 'TRX', symbolNative: 'TRX', decimalDigits: 4, tier: 'crypto' },
  TON: { code: 'TON', name: 'Toncoin', symbol: 'TON', symbolNative: 'TON', decimalDigits: 4, tier: 'crypto' },
  AVAX: { code: 'AVAX', name: 'Avalanche', symbol: 'AVAX', symbolNative: 'AVAX', decimalDigits: 4, tier: 'crypto' },
  DOT: { code: 'DOT', name: 'Polkadot', symbol: 'DOT', symbolNative: 'DOT', decimalDigits: 4, tier: 'crypto' },
  MATIC: { code: 'MATIC', name: 'Polygon', symbol: 'POL', symbolNative: 'POL', decimalDigits: 4, tier: 'crypto' },
  LINK: { code: 'LINK', name: 'Chainlink', symbol: 'LINK', symbolNative: 'LINK', decimalDigits: 4, tier: 'crypto' },
  BCH: { code: 'BCH', name: 'Bitcoin Cash', symbol: 'BCH', symbolNative: 'BCH', decimalDigits: 6, tier: 'crypto' },
  LTC: { code: 'LTC', name: 'Litecoin', symbol: 'Ł', symbolNative: 'Ł', decimalDigits: 6, tier: 'crypto' },
  SHIB: { code: 'SHIB', name: 'Shiba Inu', symbol: 'SHIB', symbolNative: 'SHIB', decimalDigits: 2, tier: 'crypto' },
  XLM: { code: 'XLM', name: 'Stellar', symbol: 'XLM', symbolNative: 'XLM', decimalDigits: 4, tier: 'crypto' },
  XMR: { code: 'XMR', name: 'Monero', symbol: 'ɱ', symbolNative: 'ɱ', decimalDigits: 6, tier: 'crypto' },
  ATOM: { code: 'ATOM', name: 'Cosmos', symbol: 'ATOM', symbolNative: 'ATOM', decimalDigits: 4, tier: 'crypto' },
  ETC: { code: 'ETC', name: 'Ethereum Classic', symbol: 'ETC', symbolNative: 'ETC', decimalDigits: 6, tier: 'crypto' },
  FIL: { code: 'FIL', name: 'Filecoin', symbol: 'FIL', symbolNative: 'FIL', decimalDigits: 4, tier: 'crypto' },
  ICP: { code: 'ICP', name: 'Internet Computer', symbol: 'ICP', symbolNative: 'ICP', decimalDigits: 4, tier: 'crypto' },
  NEAR: { code: 'NEAR', name: 'NEAR Protocol', symbol: 'NEAR', symbolNative: 'NEAR', decimalDigits: 4, tier: 'crypto' },
  APT: { code: 'APT', name: 'Aptos', symbol: 'APT', symbolNative: 'APT', decimalDigits: 4, tier: 'crypto' },
  ARB: { code: 'ARB', name: 'Arbitrum', symbol: 'ARB', symbolNative: 'ARB', decimalDigits: 4, tier: 'crypto' },
  OP: { code: 'OP', name: 'Optimism', symbol: 'OP', symbolNative: 'OP', decimalDigits: 4, tier: 'crypto' },
  HBAR: { code: 'HBAR', name: 'Hedera', symbol: 'HBAR', symbolNative: 'HBAR', decimalDigits: 4, tier: 'crypto' },
  ALGO: { code: 'ALGO', name: 'Algorand', symbol: 'ALGO', symbolNative: 'ALGO', decimalDigits: 4, tier: 'crypto' },
  // ---- Precious metals (ISO 4217, priced per troy ounce) ----
  XAU: { code: 'XAU', name: 'Gold (oz)', symbol: 'Au', symbolNative: 'Au', decimalDigits: 3, tier: 'metals' },
  XAG: { code: 'XAG', name: 'Silver (oz)', symbol: 'Ag', symbolNative: 'Ag', decimalDigits: 3, tier: 'metals' },
  XPT: { code: 'XPT', name: 'Platinum (oz)', symbol: 'Pt', symbolNative: 'Pt', decimalDigits: 3, tier: 'metals' },
  XPD: { code: 'XPD', name: 'Palladium (oz)', symbol: 'Pd', symbolNative: 'Pd', decimalDigits: 3, tier: 'metals' },
};

export const MAIN_CURRENCIES: CurrencyCode[] = (Object.keys(CURRENCIES) as CurrencyCode[])
  .filter((c) => CURRENCIES[c].tier === 'main');

export const OTHER_CURRENCIES: CurrencyCode[] = (Object.keys(CURRENCIES) as CurrencyCode[])
  .filter((c) => CURRENCIES[c].tier === 'other')
  .sort((a, b) => CURRENCIES[a].name.localeCompare(CURRENCIES[b].name));

export const CRYPTO_CURRENCIES: CurrencyCode[] = (Object.keys(CURRENCIES) as CurrencyCode[])
  .filter((c) => CURRENCIES[c].tier === 'crypto');

export const METAL_CURRENCIES: CurrencyCode[] = (Object.keys(CURRENCIES) as CurrencyCode[])
  .filter((c) => CURRENCIES[c].tier === 'metals');

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

// ---- Currency format presets (Phase 10x) ----
// User-controllable preset that overrides locale defaults for digit
// grouping and symbol placement. Each preset is a (numberStyle × position)
// pair. The default 'auto' defers to Intl.NumberFormat (locale-aware).
//
// numberStyle:
//   western      1,234,567.90    comma thousands, dot decimal
//   indian       12,34,567.90    lakh/crore grouping
//   european     1.234.567,90    dot thousands, comma decimal
//   space-comma  1 234 567,90    space thousands, comma decimal (fr/sv)
//   space-dot    1 234 567.90    space thousands, dot decimal
//
// position:
//   amount-symbol     1,234.90 ₸  symbol after, sign at far left
//   symbol-amount     ₸ 1,234.90  symbol before with space, sign at far left
//   symbol-sign       ₸ -1,234.90 symbol leads, sign next to amount

export type CurrencyNumberStyle = 'western' | 'indian' | 'european' | 'space-comma' | 'space-dot';
export type CurrencyPosition = 'amount-symbol' | 'symbol-amount' | 'symbol-sign';

export interface CurrencyFormatPreset {
  id: string;
  numberStyle: CurrencyNumberStyle;
  position: CurrencyPosition;
}

export const CURRENCY_FORMAT_PRESETS: CurrencyFormatPreset[] = [
  // amount-symbol (negative goes far left)
  { id: 'western-amount-symbol',     numberStyle: 'western',     position: 'amount-symbol' },
  { id: 'indian-amount-symbol',      numberStyle: 'indian',      position: 'amount-symbol' },
  { id: 'european-amount-symbol',    numberStyle: 'european',    position: 'amount-symbol' },
  { id: 'space-dot-amount-symbol',   numberStyle: 'space-dot',   position: 'amount-symbol' },
  { id: 'space-comma-amount-symbol', numberStyle: 'space-comma', position: 'amount-symbol' },
  // symbol-amount (sign far left)
  { id: 'western-symbol-amount',     numberStyle: 'western',     position: 'symbol-amount' },
  { id: 'indian-symbol-amount',      numberStyle: 'indian',      position: 'symbol-amount' },
  { id: 'european-symbol-amount',    numberStyle: 'european',    position: 'symbol-amount' },
  { id: 'space-dot-symbol-amount',   numberStyle: 'space-dot',   position: 'symbol-amount' },
  { id: 'space-comma-symbol-amount', numberStyle: 'space-comma', position: 'symbol-amount' },
  // symbol-sign (symbol first, then sign)
  { id: 'western-symbol-sign',       numberStyle: 'western',     position: 'symbol-sign' },
  { id: 'indian-symbol-sign',        numberStyle: 'indian',      position: 'symbol-sign' },
  { id: 'european-symbol-sign',      numberStyle: 'european',    position: 'symbol-sign' },
  { id: 'space-dot-symbol-sign',     numberStyle: 'space-dot',   position: 'symbol-sign' },
  { id: 'space-comma-symbol-sign',   numberStyle: 'space-comma', position: 'symbol-sign' },
];

export function getCurrencyFormatPreset(id?: string | null): CurrencyFormatPreset | null {
  if (!id) return null;
  return CURRENCY_FORMAT_PRESETS.find((p) => p.id === id) ?? null;
}

/** Apply digit grouping + decimal style to a positive numeric string
 *  produced by `Number.prototype.toFixed(digits)`. */
function applyNumberStyle(positive: string, style: CurrencyNumberStyle): string {
  const [intPart, fracPart] = positive.split('.');
  let grouped: string;
  if (style === 'indian') {
    // 1 group of 3 (rightmost), then groups of 2.  12345678 -> 1,23,45,678
    if (intPart.length <= 3) grouped = intPart;
    else {
      const last3 = intPart.slice(-3);
      const rest = intPart.slice(0, -3);
      const restGrouped = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
      grouped = `${restGrouped},${last3}`;
    }
    return fracPart ? `${grouped}.${fracPart}` : grouped;
  }
  const groupedThousands = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  switch (style) {
    case 'western':
      return fracPart ? `${groupedThousands}.${fracPart}` : groupedThousands;
    case 'european':
      return fracPart
        ? `${groupedThousands.replace(/,/g, '.')},${fracPart}`
        : groupedThousands.replace(/,/g, '.');
    case 'space-comma':
      return fracPart
        ? `${groupedThousands.replace(/,/g, ' ')},${fracPart}`
        : groupedThousands.replace(/,/g, ' ');
    case 'space-dot':
      return fracPart
        ? `${groupedThousands.replace(/,/g, ' ')}.${fracPart}`
        : groupedThousands.replace(/,/g, ' ');
  }
}

/** Compose final string per the user's position preference. */
export function composeWithPreset(
  signed: number,
  digits: string,
  symbol: string,
  position: CurrencyPosition,
): string {
  const negative = signed < 0;
  const sign = negative ? '−' : ''; // U+2212 minus
  switch (position) {
    case 'amount-symbol':
      return `${sign}${digits} ${symbol}`;
    case 'symbol-amount':
      return `${sign}${symbol} ${digits}`;
    case 'symbol-sign':
      return `${symbol} ${sign}${digits}`;
  }
}

/** Render a preset-formatted preview for the given numeric value
 *  and symbol — used by the Currency format picker rows. */
export function previewWithPreset(
  signed: number,
  preset: CurrencyFormatPreset,
  symbol: string,
  decimalDigits: number = 2,
): string {
  const abs = Math.abs(signed).toFixed(decimalDigits);
  const digits = applyNumberStyle(abs, preset.numberStyle);
  return composeWithPreset(signed, digits, symbol, preset.position);
}

/** Full-precision formatter. `$12.50`, `ر.س ١٢٫٥٠`.
 *  Always returns the absolute value formatted — callers that need a
 *  negative sign prepend it themselves (preserved from v1 contract).
 *
 *  Symbol placement: always **left** of the digits. The locale-aware
 *  Intl currency formatter used to honor regional conventions (₽/€
 *  trailing in ru-RU / fr-FR / de-DE etc.) but the product wants
 *  symbol-on-the-left consistently across accounts, balances, and
 *  totals. The user's explicit currency-format preset can still flip
 *  it via the `amount-symbol` position — that's a deliberate override. */
export function formatMoney(amount: number, code: CurrencyCode = 'USD', locale?: string): string {
  const c = CURRENCIES[code];
  const abs = Math.abs(amount);
  const presetId = kv.get('currencyFormat');
  const preset = getCurrencyFormatPreset(presetId);
  if (preset) {
    const digits = applyNumberStyle(abs.toFixed(c.decimalDigits), preset.numberStyle);
    if (preset.position === 'amount-symbol') return `${digits} ${c.symbolNative}`;
    return `${c.symbolNative} ${digits}`;
  }
  // No preset: format digits with locale-aware grouping/decimal but
  // anchor the symbol on the left ourselves.
  const eff = effectiveLocale(locale);
  try {
    const digits = new Intl.NumberFormat(eff, {
      minimumFractionDigits: c.decimalDigits,
      maximumFractionDigits: c.decimalDigits,
    }).format(abs);
    return `${c.symbolNative} ${digits}`;
  } catch {
    return `${c.symbolNative} ${abs.toFixed(c.decimalDigits)}`;
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
