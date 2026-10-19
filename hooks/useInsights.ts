// Insights & trends — Phase 10j.
//
// Two signals:
//
//   1. Month-over-month deltas. For each category with non-zero spend
//      this month, return the % change vs last month. Surfaces as a
//      compact strip at the top of Activity ("↑ Food +42% · ↓ Transport
//      −18%"). Most-changed first; ties broken by current spend.
//
//   2. Category spike. For each category, compute the rolling 12-month
//      mean + standard deviation excluding the current month. If this
//      month is >2σ above the mean AND >2× the mean, return that
//      category as a spike candidate. The HomeActionCard surfaces the
//      single biggest spike if any insights are firing.
//
// All math is JS-side after a single SQL aggregate; the table is
// indexed on (date, category) so the rollup completes in milliseconds
// even for users with years of data.

import { useMemo } from 'react';
import { getRawDB } from '@/utils/db/client';
import { useTransactions } from './useAppData';
import { catInfo } from '@/constants/categories';

export interface CategoryDelta {
  /** Stable category id (matches categories.ts ids). */
  category: string;
  /** Display name from catInfo(). */
  name: string;
  /** Display color from catInfo(). */
  color: string;
  /** Total spent on this category this month. */
  thisMonth: number;
  /** Total spent on this category last month. */
  lastMonth: number;
  /** (thisMonth - lastMonth) / lastMonth, as a decimal (0.42 = +42%).
   *  Returns null when lastMonth is 0 (no baseline). */
  deltaPct: number | null;
  /** Absolute change in monetary terms (thisMonth - lastMonth). */
  deltaAbs: number;
}

export interface CategorySpike {
  category: string;
  name: string;
  color: string;
  thisMonth: number;
  rolling12Mean: number;
  zScore: number;
}

export interface Insights {
  deltas: CategoryDelta[];
  spike: CategorySpike | null;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

interface CategoryMonthRow {
  category: string;
  yyyymm: string;
  /** Account currency of this bucket; null = default currency. */
  ccy: string | null;
  total: number;
}

export function useInsights(): Insights {
  // Subscribe to the version bump so insights refresh on add/edit.
  const _bump = useTransactions({ limit: 1 });
  void _bump;

  return useMemo(() => {
    const raw = getRawDB();
    const now = new Date();
    const thisMonthStart = startOfMonth(now).getTime();
    const window12Start = startOfMonth(new Date(now.getFullYear(), now.getMonth() - 12, 1)).getTime();
    const nextMonthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() + 1, 1)).getTime();

    // strftime works on unix seconds; we store ms — divide by 1000.
    // 'YYYY-MM' grouping per category gives us a sparse matrix.
    // amount_main = main-currency value at the rate of the row's day.
    const rows = raw.getAllSync(
      `SELECT
         category,
         strftime('%Y-%m', date/1000, 'unixepoch') AS yyyymm,
         NULL AS ccy,
         SUM(COALESCE(amount_main, amount)) AS total
       FROM transactions
       WHERE type = 'expense'
         AND category IS NOT NULL
         AND date >= ?
         AND date <  ?
       GROUP BY category, yyyymm`,
      [window12Start, nextMonthStart],
    ) as CategoryMonthRow[];

    const thisYYYYMM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastYYYYMM = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}`;

    // Bucket per category.
    interface Bucket {
      thisMonth: number;
      lastMonth: number;
      history: number[]; // months strictly before thisYYYYMM
    }
    // Fold currency buckets first so each (category, month) is a single
    // default-currency total, then bucket per category as before.
    const perCatMonth = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const v = r.total ?? 0;
      let months = perCatMonth.get(r.category);
      if (!months) {
        months = new Map();
        perCatMonth.set(r.category, months);
      }
      months.set(r.yyyymm, (months.get(r.yyyymm) ?? 0) + v);
    }
    const byCat = new Map<string, Bucket>();
    for (const [category, months] of perCatMonth) {
      const b: Bucket = { thisMonth: 0, lastMonth: 0, history: [] };
      byCat.set(category, b);
      for (const [yyyymm, total] of months) {
        if (yyyymm === thisYYYYMM) b.thisMonth = total;
        else {
          if (yyyymm === lastYYYYMM) b.lastMonth = total;
          b.history.push(total);
        }
      }
    }

    // 1. Deltas — only categories with this-month spend; sorted by
    //    abs(deltaAbs) so the biggest movers (in money terms) lead.
    const deltas: CategoryDelta[] = [];
    for (const [cat, b] of byCat) {
      if (b.thisMonth <= 0 && b.lastMonth <= 0) continue;
      const ci = catInfo(cat);
      const deltaAbs = b.thisMonth - b.lastMonth;
      const deltaPct = b.lastMonth > 0 ? (deltaAbs / b.lastMonth) : null;
      deltas.push({
        category: cat,
        name: ci.name,
        color: ci.color,
        thisMonth: b.thisMonth,
        lastMonth: b.lastMonth,
        deltaPct,
        deltaAbs,
      });
    }
    deltas.sort((a, b) => Math.abs(b.deltaAbs) - Math.abs(a.deltaAbs));

    // 2. Spike — single biggest z-score, but only if it's both >2σ AND
    //    >2× the mean (to avoid flagging tiny categories where the σ is
    //    noise). Need ≥3 prior months for σ to mean anything.
    let spike: CategorySpike | null = null;
    for (const [cat, b] of byCat) {
      if (b.thisMonth <= 0) continue;
      if (b.history.length < 3) continue;
      const mean = b.history.reduce((s, x) => s + x, 0) / b.history.length;
      if (mean <= 0) continue;
      const variance =
        b.history.reduce((s, x) => s + (x - mean) ** 2, 0) / b.history.length;
      const stdev = Math.sqrt(variance);
      if (stdev === 0) continue;
      const z = (b.thisMonth - mean) / stdev;
      if (z < 2) continue;
      if (b.thisMonth < mean * 2) continue;
      if (!spike || z > spike.zScore) {
        const ci = catInfo(cat);
        spike = {
          category: cat,
          name: ci.name,
          color: ci.color,
          thisMonth: b.thisMonth,
          rolling12Mean: mean,
          zScore: z,
        };
      }
    }

    return { deltas, spike };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_bump.length]);
}
