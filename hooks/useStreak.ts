// Streak hook — consecutive days with at least one *non-ibadah* transaction
// logged. SQL-backed; O(365) worst case.
//
// Phase 8 cultural review (per plan-v2 §4): no streak gamification of ibadah.
// In islamic builds we exclude `zakat`, `sadaqa`, `qurban` from the day-set
// counted. A user logging only a sadaqa today shouldn't have their tracking
// streak depend on it. Generic builds count all expense days.

import { useMemo } from 'react';
import { getRawDB } from '@/utils/db/client';
import { useTransactions } from './useAppData';

const IBADAH_CATEGORIES = ['zakat', 'sadaqa', 'qurban'];

export function useStreak(): number {
  // Subscribe to version bump via any transactions query.
  const txns = useTransactions({ limit: 1 });
  void txns;
  return useMemo(() => {
    const raw = getRawDB();

    // Phase 8: islamic flavor excludes ibadah categories from the day count.
    // Babel inlines `process.env.APP_FLAVOR` so the WHERE clause is a literal
    // in the bundled SQL string — no runtime branch.
    const isIslamic = process.env.APP_FLAVOR === 'islamic';
    const ibadahFilter = isIslamic
      ? `AND (category IS NULL OR category NOT IN (${IBADAH_CATEGORIES.map(() => '?').join(',')}))`
      : '';
    const params: (string | number)[] = [Date.now() - 400 * 24 * 60 * 60 * 1000];
    if (isIslamic) params.push(...IBADAH_CATEGORIES);

    const rows = raw.getAllSync<{ day: string }>(
      `SELECT DISTINCT strftime('%Y-%m-%d', date/1000, 'unixepoch', 'localtime') AS day
         FROM transactions
        WHERE date >= ?
          ${ibadahFilter}
        ORDER BY day DESC`,
      params,
    );
    if (rows.length === 0) return 0;
    const days = new Set(rows.map((r) => r.day));
    let count = 0;
    const cursor = new Date();
    // Count back from today as long as the set contains that day.
    // If today has no entry, start from yesterday (streak can continue if user hasn't logged today yet).
    const fmtDay = (d: Date) => d.toISOString().slice(0, 10);
    if (!days.has(fmtDay(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (days.has(fmtDay(cursor))) {
      count += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return count;
  }, [txns.length]);
}
