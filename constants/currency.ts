// Multi-currency formatting — plumbed in Phase 1 per decision #3.
// Phase 8: locale-aware numeral system. When the device/user locale starts
// with `ar` AND the user hasn't disabled the Arabic-numerals toggle in Me,
// we render Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) by appending the BCP-47
// `-u-nu-arab` extension to the locale passed to Intl.NumberFormat.

import { kv } from '@/utils/kv';

export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'SAR' | 'AED' | 'MYR' | 'IDR' | 'TRY' | 'PKR' | 'EGP';

export interface CurrencyDef {
  code: CurrencyCode;
  name: string;
  symbol: string;
  symbolNative: string;
  decimalDigits: number;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyDef> = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', symbolNative: '$', decimalDigits: 2 },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', symbolNative: '€', decimalDigits: 2 },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', symbolNative: '£', decimalDigits: 2 },
  SAR: { code: 'SAR', name: 'Saudi Riyal', symbol: 'SR', symbolNative: 'ر.س', decimalDigits: 2 },
  AED: { code: 'AED', name: 'UAE Dirham', symbol: 'AED', symbolNative: 'د.إ', decimalDigits: 2 },
  MYR: { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', symbolNative: 'RM', decimalDigits: 2 },
  IDR: { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp', symbolNative: 'Rp', decimalDigits: 0 },
  TRY: { code: 'TRY', name: 'Turkish Lira', symbol: '₺', symbolNative: '₺', decimalDigits: 2 },
  PKR: { code: 'PKR', name: 'Pakistani Rupee', symbol: '₨', symbolNative: '₨', decimalDigits: 2 },
  EGP: { code: 'EGP', name: 'Egyptian Pound', symbol: '£E', symbolNative: 'ج.م', decimalDigits: 2 },
};

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
