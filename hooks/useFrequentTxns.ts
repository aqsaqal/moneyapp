// Frequently-added transactions, two flavors:
//
//   useExactReplays  — groups by (category, account, ROUND(amount), note)
//                      Tap → submit identical txn. The v1 quick-add flow.
//
//   useFuzzyMerchants — groups by (note token, category, account)
//                       Tap → fill note + cat + account, leave amount editable.
//                       New in Phase 7 — covers "same place, different price."
//
// useFrequentTxns is kept as an alias of useExactReplays for back-compat.

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

export interface FuzzyMerchant {
  count: number;
  category: string;
  accountId: string;
  note: string;        // representative token (lowercased)
  amount: number;      // most-recent amount for this merchant (for display)
}

/** Top-N exact-match repeats. Tap = one-shot full submit. */
export function useExactReplays(limit = 4): FrequentTxn[] {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.length, limit]);
}

/** Backwards-compatible alias. New code should use useExactReplays directly. */
export const useFrequentTxns = useExactReplays;

/** Top-N fuzzy merchant rows: same merchant_memory token, regardless of amount.
 *  Source: merchant_memory table (populated on every successful add). */
export function useFuzzyMerchants(limit = 4): FuzzyMerchant[] {
  const t = useTransactions({ limit: 1 });
  void t;
  return useMemo(() => {
    const raw = getRawDB();
    // Pull merchants from memory; fetch the most-recent amount per token from
    // the transactions table so the chip can show a price for context.
    const rows = raw.getAllSync<FuzzyMerchant>(
      `SELECT mm.count AS count,
              mm.category AS category,
              mm.account_id AS accountId,
              mm.text AS note,
              COALESCE(
                (SELECT t.amount FROM transactions t
                  WHERE t.note LIKE '%' || mm.text || '%'
                    AND t.type = 'expense'
                  ORDER BY t.date DESC LIMIT 1),
                0
              ) AS amount
         FROM merchant_memory mm
         ORDER BY mm.count DESC, mm.last_used DESC
         LIMIT ?`,
      [limit],
    );
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t.length, limit]);
}
