// Multi-currency formatting — plumbed in Phase 1 per decision #3.
// Arabic numeral variants flow from the locale, not the currency code.

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

/** Full-precision formatter. `$12.50`, `ر.س ١٢٫٥٠`. */
export function formatMoney(amount: number, code: CurrencyCode = 'USD', locale?: string): string {
  const abs = Math.abs(amount);
  try {
    return new Intl.NumberFormat(locale, {
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
export function formatMoneyShort(amount: number, code: CurrencyCode = 'USD'): string {
  const abs = Math.abs(amount);
  const c = CURRENCIES[code];
  if (abs >= 1000) return `${c.symbol}${(abs / 1000).toFixed(1)}k`;
  return `${c.symbol}${abs.toFixed(0)}`;
}
