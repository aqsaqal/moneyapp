// Monthly income + spending aggregates for the Insights screen.
//
// One row per calendar month in the last `monthsBack` months, in
// chronological order (oldest first → newest last). Each value is in
// the user's CURRENT display currency, converted from each transaction's
// account currency via the cached FX rates.
//
// Exclusions:
//   - Transfers (own-account moves; not real income or spending)
//   - Adjustment category (balance reconciliation, not real flow)
//   - Future-dated transactions (applied=0 → not yet real)

import { useMemo } from 'react';
import { getRawDB } from '@/utils/db/client';
import { convert as fxConvert } from '@/utils/fx';
import { kv } from '@/utils/kv';
import type { CurrencyCode } from '@/constants/currency';
import { useAccounts, useTransactions } from '@/hooks/useAppData';

export interface MonthlyFlow {
  /** YYYY-MM key. */
  monthKey: string;
  /** Income converted to display currency. */
  income: number;
  /** Spending converted to display currency. */
  spending: number;
}

export function useMonthlyIncomeSpending(monthsBack: number): MonthlyFlow[] {
  // Subscribe to bumps via useTransactions so insert/update/delete
  // anywhere in the app re-aggregates. Limit:1 keeps it cheap. The
  // array identity is included in the memo deps below so profile
  // switches (which fire bump()) actually invalidate the cache.
  const bumpProbe = useTransactions({ limit: 1 });
  const accounts = useAccounts({ includeArchived: true });
  const displayCcy = (kv.get('currency') ?? 'USD') as CurrencyCode;

  const accountCcy = useMemo(() => {
    const m = new Map<string, CurrencyCode>();
    accounts.forEach((a) =>
      m.set(a.id, ((a.currency ?? displayCcy) as CurrencyCode)),
    );
    return m;
  }, [accounts, displayCcy]);

  return useMemo(() => {
    const today = new Date();
    const start = new Date(
      today.getFullYear(),
      today.getMonth() - monthsBack + 1,
      1,
    ).getTime();

    const raw = getRawDB();
    const rows = raw.getAllSync<{
      type: string;
      amount: number;
      account_id: string;
      category: string | null;
      date: number;
    }>(
      `SELECT type, amount, account_id, category, date
         FROM transactions
        WHERE date >= ?
          AND type != 'transfer'
          AND (category IS NULL OR category != 'adjustment')
          AND (applied IS NULL OR applied = 1)`,
      [start],
    );

    const buckets = new Map<string, { income: number; spending: number }>();
    for (const r of rows) {
      const d = new Date(r.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const cc = accountCcy.get(r.account_id) ?? displayCcy;
      const v = fxConvert(r.amount, cc, displayCcy);
      let b = buckets.get(key);
      if (!b) {
        b = { income: 0, spending: 0 };
        buckets.set(key, b);
      }
      if (r.type === 'income') b.income += v;
      else if (r.type === 'expense') b.spending += v;
    }

    // Fill in any missing months so the chart shows a continuous strip
    // even if a month had zero activity. The chart wraps in a horizontal
    // ScrollView, so a long "All" window with mostly empty months still
    // renders correctly — the user can scroll to the active range.
    const result: MonthlyFlow[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const b = buckets.get(key) ?? { income: 0, spending: 0 };
      result.push({ monthKey: key, income: b.income, spending: b.spending });
    }
    return result;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthsBack, accountCcy, displayCcy, accounts, bumpProbe]);
}
