// Formatting helpers. Ports v4's fmt/fmts/dayStr but carries currency + locale.

import { formatMoney, formatMoneyShort, type CurrencyCode } from '@/constants/currency';

export { formatMoney, formatMoneyShort };

/**
 * Relative day label. `Today`, `Yesterday`, or localized short date.
 * Ported from v4 line 114.
 */
export function dayStr(d: Date | number | string, locale?: string): string {
  const dt = typeof d === 'string' || typeof d === 'number' ? new Date(d) : d;
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (dt.toDateString() === today.toDateString()) return 'Today';
  if (dt.toDateString() === yesterday.toDateString()) return 'Yesterday';

  try {
    return dt.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
  } catch {
    return dt.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  }
}

/** `YYYY-MM` for the given date. Used as a key for paid_items tracking. */
export function monthKey(d: Date | number = new Date()): string {
  const date = typeof d === 'number' ? new Date(d) : d;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function fmt(amount: number, code: CurrencyCode = 'USD', locale?: string) {
  return formatMoney(amount, code, locale);
}

export function fmts(amount: number, code: CurrencyCode = 'USD') {
  return formatMoneyShort(amount, code);
}
