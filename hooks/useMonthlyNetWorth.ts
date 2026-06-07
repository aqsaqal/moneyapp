// Net-worth monthly series for the Me-tab chart + the full-screen
// detail modal.
//
// Reads from `net_worth_snapshots` (one row per local YYYY-MM-DD).
// For each month in [today - monthsBack + 1 ... today] we pick the
// last snapshot available within the month. Months without any
// snapshot are skipped — this keeps a brand-new install from
// pretending to have zero net worth on months before it was installed.

import { useMemo } from 'react';
import { getRawDB } from '@/utils/db/client';
import { useTransactions } from '@/hooks/useAppData';

export interface NetWorthMonth {
  /** YYYY-MM key */
  monthKey: string;
  /** Last snapshot picked from inside this month. */
  date: string; // YYYY-MM-DD
  assets: number;
  debt: number;
  net: number;
}

export function useMonthlyNetWorth(monthsBack: number): NetWorthMonth[] {
  // Re-aggregate when anything in the data layer bumps. Capture the
  // probe's array identity into the memo deps so a `bump()` (including
  // the one fired on profile switch) actually invalidates the cache.
  // Previously the probe subscribed but the memo never re-ran because
  // it depended only on `monthsBack`.
  const bumpProbe = useTransactions({ limit: 1 });

  return useMemo(() => {
    const raw = getRawDB();
    const today = new Date();
    const cutoff = new Date(
      today.getFullYear(),
      today.getMonth() - monthsBack + 1,
      1,
    );
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-01`;

    // Pull every snapshot from the cutoff onwards, sorted ASC, then
    // walk forward keeping the most-recent row per month bucket.
    const rows = raw.getAllSync<{
      date: string;
      assets: number;
      debt: number;
      net: number;
    }>(
      `SELECT date, assets, debt, net
         FROM net_worth_snapshots
        WHERE date >= ?
        ORDER BY date ASC`,
      [cutoffStr],
    );

    const byMonth = new Map<string, NetWorthMonth>();
    for (const r of rows) {
      const key = r.date.slice(0, 7); // YYYY-MM
      byMonth.set(key, {
        monthKey: key,
        date: r.date,
        assets: r.assets,
        debt: r.debt,
        net: r.net,
      });
    }
    // Emit in chronological order.
    return Array.from(byMonth.values()).sort((a, b) =>
      a.monthKey.localeCompare(b.monthKey),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthsBack, bumpProbe]);
}
