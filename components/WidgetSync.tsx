// WidgetSync — mounted once in the root layout. Recomputes the Safe to
// spend numbers the same way Home does and pushes them to the widgets
// whenever they change (and on every return to the foreground, so the
// day counter is fresh).

import React, { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { theme, activeThemeIsLight } from '@/constants/theme';
import { APP_NAME } from '@/constants/flavor';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';
import { monthKey } from '@/utils/format';
import { convert as fxConvert } from '@/utils/fx';
import { encodePrefill } from '@/utils/prefill';
import { usePro } from '@/utils/pro';
import { useT } from '@/hooks/useT';
import {
  useAccounts, useCategoriesWithMeta, useCategorySpendSince, useMonthFlow, usePaidItemsForMonth,
  useRecurring, useTransactions,
} from '@/hooks/useAppData';
import { APP_SCHEME, pushWidgetSnapshot, type WidgetSnapshot } from '@/utils/widget';

export function WidgetSync() {
  const t = useT();
  const pro = usePro();
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') setTick((x) => x + 1); });
    return () => sub.remove();
  }, []);

  const now = new Date();
  const thisMonth = monthKey(now);
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const { income, expense } = useMonthFlow(thisMonth);
  const recurring = useRecurring();
  const paid = usePaidItemsForMonth(thisMonth);
  const txns = useTransactions({ monthKey: thisMonth, dateLte: Date.now() });
  const accounts = useAccounts({ includeArchived: true });
  const cats = useCategoriesWithMeta();
  const spend30 = useCategorySpendSince(30);

  const snap = useMemo<WidgetSnapshot>(() => {
    const paidIds = new Set(paid.map((p) => p.recurringId));
    const toDisplay = (r: { amount: number; currency: string | null }) =>
      r.currency && r.currency !== currency ? fxConvert(r.amount, r.currency, currency) : r.amount;
    const bills = recurring.filter((r) => r.type === 'expense' && !paidIds.has(r.id)).reduce((s, r) => s + toDisplay(r), 0);
    const disposable = income - bills - expense;
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const day = now.getDate();
    const daysLeft = Math.max(0, dim - day);
    const ccyOf = new Map(accounts.map((a) => [a.id, (a.currency ?? currency) as CurrencyCode]));
    const variable = txns
      .filter((x) => x.type === 'expense' && !x.recurringId)
      .reduce((s, x) => s + (x.amountMain ?? fxConvert(x.amount, ccyOf.get(x.accountId ?? '') ?? currency, currency)), 0);
    const forecast = day >= 1 ? disposable - (variable / day) * daysLeft : null;
    const perDay = Math.max(0, disposable) / Math.max(1, daysLeft);

    let tone: 'good' | 'warn' | 'bad' = 'good';
    if (disposable < 0 || (forecast != null && forecast < 0)) tone = 'bad';
    else if (forecast != null && forecast < 20 && forecast < disposable * 0.1) tone = 'warn';
    const toneColor = tone === 'bad' ? theme.expense : tone === 'warn' ? '#EAB308' : theme.accent;
    const verdict =
      disposable < 0
        ? t('hero.verdict.negative', { amount: formatMoney(Math.abs(disposable), currency) })
        : tone === 'bad'
          ? t('hero.verdict.overshoot', { amount: formatMoney(Math.abs(forecast ?? 0), currency) })
          : tone === 'warn'
            ? t('hero.verdict.close', { amount: formatMoney(forecast ?? 0, currency) })
            : t('hero.verdict.onTrack', { amount: formatMoney(disposable, currency) });

    const top = cats
      .filter((c) => c.type !== 'income')
      .map((c) => ({ c, s: spend30.get(c.id) ?? 0 }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map(({ c }) => ({
        label: c.name,
        color: c.color,
        url: `${APP_SCHEME}://add?prefill=${encodePrefill({ type: 'expense', category: c.id })}`,
      }));

    return {
      v: 1,
      asOf: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      pro,
      homeUrl: `${APP_SCHEME}://`,
      lockedText: t('widget.locked', { app: APP_NAME }),
      lockedUrl: `${APP_SCHEME}://paywall?feature=widgets`,
      emptyText: t('widget.open', { app: APP_NAME }),
      colors: {
        bg: theme.bg1, bg2: theme.bg3, accent: theme.accent, text1: theme.text1, text2: theme.text2, text3: theme.text3,
        tone: toneColor, border: theme.border,
      },
      title: t('hero.safeToSpend'),
      perDay: formatMoney(perDay, currency),
      aDay: t('hero.aDay'),
      progress: Math.min(1, Math.max(0, day / Math.max(1, dim))),
      dayLine: t('hero.dayOf', { d: day, n: dim, left: daysLeft }),
      verdict,
      rows: [
        { label: t('hero.leftThisMonth'), value: formatMoney(disposable, currency) },
        { label: t('hero.projected'), value: forecast == null ? '—' : formatMoney(forecast, currency) },
        { label: t('widget.billsDue'), value: formatMoney(bills, currency) },
        { label: t('widget.inOut'), value: `+${formatMoney(income, currency, undefined, 0)} · −${formatMoney(expense, currency, undefined, 0)}` },
      ],
      quickTitle: t('widget.quickAdd'),
      quick: [...top, { label: t('widget.more'), color: theme.text3, url: `${APP_SCHEME}://category-grid` }],
    };
    // `tick` and `activeThemeIsLight()` are deliberate extra inputs: a
    // foreground return or a theme reload must re-run this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [income, expense, recurring, paid, txns, accounts, cats, spend30, currency, pro, t, tick, activeThemeIsLight()]);

  useEffect(() => { pushWidgetSnapshot(snap); }, [snap]);
  return null;
}
