// Per-account balance history derived from the transactions table.
//
// We don't keep per-account daily snapshots in DB (net_worth_snapshots
// is the aggregate). For an account-scoped chart we walk the
// transactions newest-to-oldest, undoing each one into a running
// balance, and capture the value at each month-end inside the window.
//
// Result is in chronological order (oldest → newest). The trailing
// point always equals the account's current `balance`.

import { useMemo } from 'react';
import { useAccounts, useTransactions } from '@/hooks/useAppData';
import type { Transaction } from '@/utils/db/schema';

export interface BalancePoint {
  /** Sample timestamp (end of the bucket). */
  date: number;
  /** YYYY-MM-DD for axis labels. */
  dateKey: string;
  balance: number;
}

/** Granularity rule: short windows get high-resolution daily samples,
 *  long windows get coarser samples so the chart doesn't render
 *  thousands of overlapping points. */
function granularityForMonths(monthsBack: number): 'daily' | 'weekly' | 'biweekly' | 'monthly' {
  if (monthsBack <= 3) return 'daily';
  if (monthsBack <= 6) return 'weekly';
  if (monthsBack <= 24) return 'biweekly';
  return 'monthly';
}

/** Walk-back algorithm shared between the inline chart on Account
 *  Detail and the full-screen expand. `monthsBack` is the window we
 *  care about; 1 ≤ monthsBack ≤ ~96. Sample frequency auto-tunes by
 *  window: 3m → daily, 6m → weekly, 1y/2y → biweekly, all → monthly. */
export function useAccountBalanceHistory(
  accountId: string,
  monthsBack: number,
): BalancePoint[] {
  const accounts = useAccounts({ includeArchived: true });
  const txns = useTransactions({ limit: 5000 });

  return useMemo(() => {
    const account = accounts.find((a) => a.id === accountId);
    if (!account) return [];

    const relevant = txns.filter(
      (t) => t.accountId === accountId || t.toAccountId === accountId,
    );

    const granularity = granularityForMonths(monthsBack);
    const stepDays =
      granularity === 'daily' ? 1
      : granularity === 'weekly' ? 7
      : granularity === 'biweekly' ? 14
      : 30;
    // Approximate sample count for the window. For monthly we cap to
    // the actual month count; for finer granularities multiply.
    const sampleCount = granularity === 'monthly'
      ? monthsBack
      : Math.ceil((monthsBack * 30) / stepDays);

    const now = new Date();
    let bal = account.balance;
    const all = relevant.slice().sort((a, b) => b.date - a.date);
    const points: BalancePoint[] = [];

    // Cursor is the END of the current sample bucket.
    let cursor: Date;
    if (granularity === 'monthly') {
      cursor = new Date(now.getFullYear(), now.getMonth() + 1, 0); // end of month
    } else {
      cursor = new Date(now);
      cursor.setHours(23, 59, 59, 999);
    }

    let idx = 0;
    for (let m = 0; m < sampleCount; m++) {
      // Roll backward through every txn that happened AFTER cursor —
      // those are already baked into `bal` (which started at the
      // current present-day balance), so undo them.
      while (idx < all.length && all[idx].date > cursor.getTime()) {
        bal -= signedFor(all[idx], accountId);
        idx++;
      }
      points.unshift({
        date: cursor.getTime(),
        dateKey: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`,
        balance: bal,
      });
      // Step the cursor back by the bucket size.
      if (granularity === 'monthly') {
        cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 0); // last day of prev month
      } else {
        cursor = new Date(cursor.getTime() - stepDays * 24 * 60 * 60 * 1000);
      }
      // Stop early when we've consumed every txn and would only emit
      // repeats of the same balance.
      if (idx >= all.length && points.length >= 2) break;
    }
    return points;
  }, [accountId, monthsBack, accounts, txns]);
}

/** How a single tx moves this account's balance forward in time. */
function signedFor(tx: Transaction, accountId: string): number {
  if (tx.type === 'income') return tx.accountId === accountId ? tx.amount : 0;
  if (tx.type === 'expense') return tx.accountId === accountId ? -tx.amount : 0;
  if (tx.type === 'transfer') {
    if (tx.accountId === accountId) return -tx.amount;
    if (tx.toAccountId === accountId) return tx.toAmount ?? tx.amount;
  }
  return 0;
}
