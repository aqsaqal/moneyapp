// Streak hook — consecutive days with at least one transaction logged.
// Ports v4 calcStreak() (line 215). SQL-backed for speed; still O(365) worst case.

import { useMemo } from 'react';
import { sql } from 'drizzle-orm';
import { getRawDB } from '@/utils/db/client';
import { useTransactions } from './useAppData';

export function useStreak(): number {
  // Subscribe to version bump via any transactions query.
  const txns = useTransactions({ limit: 1 });
  void txns;
  return useMemo(() => {
    const raw = getRawDB();
    // Distinct day-of-year (local) for the last 400 days, DESC.
    const rows = raw.getAllSync<{ day: string }>(
      `SELECT DISTINCT strftime('%Y-%m-%d', date/1000, 'unixepoch', 'localtime') AS day
         FROM transactions
        WHERE date >= ?
        ORDER BY day DESC`,
      [Date.now() - 400 * 24 * 60 * 60 * 1000],
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
