// Top-4 frequently-added transactions. Replaces v4's frequentTxns memo (line 207-213)
// with a SQL GROUP BY — O(n log n) once, then cached.

import { useMemo } from 'react';
import { getRawDB } from '@/utils/db/client';
import { useTransactions } from './useAppData';

export interface FrequentTxn {
  count: number;
  category: string;
  accountId: string;
  amount: number;
  note: string | null;
}

export function useFrequentTxns(limit = 4): FrequentTxn[] {
  // Subscribe to the version bump.
  const t = useTransactions({ limit: 1 });
  void t;
  return useMemo(() => {
    const raw = getRawDB();
    const rows = raw.getAllSync<FrequentTxn>(
      `SELECT COUNT(*) AS count,
              category, account_id AS accountId,
              ROUND(amount, 2) AS amount,
              note
         FROM transactions
        WHERE type = 'expense' AND category IS NOT NULL
        GROUP BY category, account_id, ROUND(amount, 0), COALESCE(note, '')
        ORDER BY count DESC
        LIMIT ?`,
      [limit],
    );
    return rows;
  }, [t.length, limit]);
}
