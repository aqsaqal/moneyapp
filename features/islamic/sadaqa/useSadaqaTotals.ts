// Sadaqa totals — sum of zakat + sadaqa + qurban categories per period.
// Tone (spec lines 330-333): private. No comparison to averages. No sharing.

import { useMemo } from 'react';
import { getRawDB } from '@/utils/db/client';
import { useTransactions } from '@/hooks/useAppData';
import { monthKey } from '@/utils/format';

export interface SadaqaTotals {
  thisMonth: number;
  thisYear: number;
  lifetime: number;
}

const CATEGORIES = ['zakat', 'sadaqa', 'qurban'];
const PLACEHOLDERS = CATEGORIES.map(() => '?').join(',');

export function useSadaqaTotals(): SadaqaTotals {
  const t = useTransactions({ limit: 1 });
  void t;
  return useMemo(() => {
    const raw = getRawDB();
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const thisYearStart = new Date(now.getFullYear(), 0, 1).getTime();
    const sum = (sinceMs: number | null): number => {
      const rows = raw.getAllSync<{ s: number }>(
        `SELECT COALESCE(SUM(amount), 0) AS s FROM transactions
          WHERE type = 'expense' AND category IN (${PLACEHOLDERS})${sinceMs != null ? ' AND date >= ?' : ''}`,
        sinceMs != null ? [...CATEGORIES, sinceMs] : CATEGORIES,
      );
      return rows[0]?.s ?? 0;
    };
    return {
      thisMonth: sum(thisMonthStart),
      thisYear: sum(thisYearStart),
      lifetime: sum(null),
    };
  }, [t.length]);
}

/** Helper for Ramadan card — only this Ramadan's sadaqa total. */
export function useRamadanSadaqa(ramadanStart: Date): number {
  const t = useTransactions({ limit: 1 });
  void t;
  return useMemo(() => {
    const raw = getRawDB();
    const rows = raw.getAllSync<{ s: number }>(
      `SELECT COALESCE(SUM(amount), 0) AS s FROM transactions
        WHERE type = 'expense' AND category IN (${PLACEHOLDERS}) AND date >= ?`,
      [...CATEGORIES, ramadanStart.getTime()],
    );
    return rows[0]?.s ?? 0;
  }, [t.length, ramadanStart.getTime()]);
}

export { monthKey };
