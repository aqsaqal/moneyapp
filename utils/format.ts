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

/** Days between two Date objects, normalized to midnight. Positive when
 *  `to` is later than `from`. `daysDiff(now, future)` gives a positive
 *  offset; `daysDiff(now, past)` gives negative. */
export function daysDiff(from: Date | number, to: Date | number): number {
  const a = new Date(typeof from === 'number' ? from : from.getTime());
  const b = new Date(typeof to === 'number' ? to : to.getTime());
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** "Today" / "May 7 (3 days ago)" / "May 30 (in 2 weeks)" — used on the
 *  Smart Add date line so future-dating is immediately legible. All
 *  relative labels route through the i18n table so they translate to
 *  the active locale. */
export function relativeDayLabel(d: Date | number, locale?: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { t } = require('@/utils/i18n') as typeof import('@/utils/i18n');
  const dt = new Date(typeof d === 'number' ? d : d.getTime());
  const diff = daysDiff(Date.now(), dt);
  const baseDate = (() => {
    try {
      return dt.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
    } catch {
      return dt.toLocaleDateString('en', { month: 'short', day: 'numeric' });
    }
  })();
  if (diff === 0) return `${t('date.today')} · ${baseDate}`;
  if (diff === 1) return `${baseDate} (${t('date.tomorrow')})`;
  if (diff === -1) return `${baseDate} (${t('date.yesterday')})`;
  if (diff > 1 && diff <= 30) {
    if (diff >= 14) return `${baseDate} (${t('date.inWeeks', { n: Math.round(diff / 7) })})`;
    if (diff >= 7) return `${baseDate} (${t('date.inWeek')})`;
    return `${baseDate} (${t('date.inDays', { n: diff })})`;
  }
  if (diff < -1 && diff >= -30) {
    if (diff <= -14) return `${baseDate} (${t('date.weeksAgo', { n: Math.round(-diff / 7) })})`;
    if (diff <= -7) return `${baseDate} (${t('date.weekAgo')})`;
    return `${baseDate} (${t('date.daysAgo', { n: -diff })})`;
  }
  return baseDate;
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
