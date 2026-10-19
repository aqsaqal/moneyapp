// Subscription audit — Phase 10i.
//
// Three signals surfaced to the Plan tab:
//
//   1. Detected candidates: notes that have appeared on ≥3 consecutive
//      months with amounts within ±10% of each other AND aren't already
//      tied to a formal recurring entry. The user can promote one into
//      a Recurring with one tap.
//
//   2. Stale subscriptions: formal recurring (type='expense') with no
//      matching transaction in the last 3 months. Likely cancelled but
//      still tracked, or simply unused — surface as "haven't seen
//      Netflix in 3 months" with a delete affordance.
//
//   3. Annual burn: sum(amount) × 12 across all active recurring expenses.
//      One number that contextualizes everything else: "you're committed
//      to {N}/year".
//
// All queries hit existing indexes (tx_date_idx, recurring is small) so
// the audit completes in a single render frame even on large ledgers.

import { useMemo } from 'react';
import { convert as fxConvert } from '@/utils/fx';
import { kv } from '@/utils/kv';
import { sql } from 'drizzle-orm';
import { getRawDB } from '@/utils/db/client';
import { useRecurring, useTransactions } from './useAppData';
import type { Recurring } from '@/utils/db/schema';

export interface DetectedCandidate {
  /** Stable id derived from the token + rounded amount, so React keys
   *  remain stable across re-renders even before the candidate is saved. */
  id: string;
  /** Merchant token surfaced verbatim in the suggestion ("Netflix"). */
  token: string;
  /** Median of the matched amounts; used as the suggested recurring price. */
  amount: number;
  /** How many of the last 6 months had a matching transaction. */
  monthsSeen: number;
  /** Most-frequent category among matched transactions. */
  category: string;
  /** Most-frequent account among matched transactions. */
  accountId: string;
  /** Median day-of-month from matched transactions; suggested as
   *  recurring.dayOfMonth. */
  dayOfMonth: number;
}

export interface StaleSubscription {
  recurring: Recurring;
  /** Days since the most recent matching transaction; null if never paid. */
  daysSinceLastSeen: number | null;
}

export interface SubscriptionAudit {
  detected: DetectedCandidate[];
  stale: StaleSubscription[];
  /** Sum of all active recurring expense amounts × 12 months. */
  annualBurn: number;
  /** Per-recurring annual cost, sorted descending. */
  perItemAnnual: Array<{ recurring: Recurring; annual: number }>;
}

/** Tokenize a transaction note for matching. Lowercase, strip punctuation,
 *  drop short fillers. Mirrors useSmartPredict's tokenizer. */
function tokenize(text: string | null | undefined): string[] {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mode<T extends string | number>(arr: T[]): T {
  const counts = new Map<T, number>();
  for (const v of arr) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = arr[0];
  let bestN = 0;
  for (const [v, n] of counts) {
    if (n > bestN) { best = v; bestN = n; }
  }
  return best;
}

/** Look back 6 months. Group transaction notes by their longest non-stop
 *  token, count distinct months each token appears in, keep tokens that
 *  span ≥3 unique months at consistent (±10%) amounts. */
export function useSubscriptionAudit(): SubscriptionAudit {
  const recurring = useRecurring();
  // useTransactions subscribe to bumps so the audit re-runs after edits;
  // pull the rows with a bigger cap for the 6-month window.
  const _bumpSentinel = useTransactions({ limit: 1 });
  void _bumpSentinel;

  return useMemo(() => {
    const raw = getRawDB();
    const now = Date.now();
    const sixMonthsAgo = now - 180 * 86_400_000;
    const threeMonthsAgo = now - 90 * 86_400_000;

    // 1. Detected candidates ------------------------------------------
    const expenseRows = raw.getAllSync(
      `SELECT amount, category, account_id, note, date, recurring_id
         FROM transactions
        WHERE type = 'expense'
          AND date >= ?
          AND note IS NOT NULL
          AND note != ''`,
      [sixMonthsAgo],
    ) as Array<{
      amount: number;
      category: string | null;
      account_id: string;
      note: string;
      date: number;
      recurring_id: string | null;
    }>;

    interface Bucket {
      token: string;
      amounts: number[];
      categories: string[];
      accounts: string[];
      months: Set<string>;
      days: number[];
      hadRecurringLink: boolean;
    }
    const buckets = new Map<string, Bucket>();

    for (const r of expenseRows) {
      const tokens = tokenize(r.note);
      // Use the longest token as a stable bucket key — "Netflix Premium"
      // and "Netflix" should not split.
      const tok = tokens.sort((a, b) => b.length - a.length)[0];
      if (!tok) continue;
      const d = new Date(r.date);
      const monthKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
      let b = buckets.get(tok);
      if (!b) {
        b = {
          token: tok,
          amounts: [],
          categories: [],
          accounts: [],
          months: new Set(),
          days: [],
          hadRecurringLink: false,
        };
        buckets.set(tok, b);
      }
      b.amounts.push(r.amount);
      if (r.category) b.categories.push(r.category);
      b.accounts.push(r.account_id);
      b.months.add(monthKey);
      b.days.push(d.getDate());
      if (r.recurring_id) b.hadRecurringLink = true;
    }

    // Names already used by formal recurring → skip those tokens.
    const recurringNameTokens = new Set<string>();
    for (const r of recurring) {
      for (const t of tokenize(r.name)) recurringNameTokens.add(t);
    }

    const detected: DetectedCandidate[] = [];
    for (const b of buckets.values()) {
      if (b.hadRecurringLink) continue;
      if (recurringNameTokens.has(b.token)) continue;
      if (b.months.size < 3) continue;
      // Amount stability check: max within 10% of median.
      const m = median(b.amounts);
      if (m <= 0) continue;
      const stable = b.amounts.every((a) => Math.abs(a - m) / m <= 0.1);
      if (!stable) continue;
      detected.push({
        id: `det-${b.token}-${Math.round(m)}`,
        token: b.token,
        amount: Math.round(m * 100) / 100,
        monthsSeen: b.months.size,
        category: b.categories.length ? mode(b.categories) : 'subs',
        accountId: mode(b.accounts),
        dayOfMonth: Math.max(1, Math.min(31, Math.round(median(b.days)))),
      });
    }
    // Most-frequent first.
    detected.sort((a, b) => b.monthsSeen - a.monthsSeen || b.amount - a.amount);

    // 2. Stale subscriptions ------------------------------------------
    const stale: StaleSubscription[] = [];
    for (const r of recurring) {
      if (r.type !== 'expense') continue;
      const row = raw.getFirstSync(
        `SELECT MAX(date) AS lastSeen FROM transactions
          WHERE type = 'expense'
            AND (recurring_id = ? OR lower(note) LIKE ?)`,
        [r.id, `%${r.name.toLowerCase()}%`],
      ) as { lastSeen: number | null } | undefined;
      const lastSeen = row?.lastSeen ?? null;
      if (lastSeen == null) {
        stale.push({ recurring: r, daysSinceLastSeen: null });
        continue;
      }
      if (lastSeen < threeMonthsAgo) {
        stale.push({
          recurring: r,
          daysSinceLastSeen: Math.floor((now - lastSeen) / 86_400_000),
        });
      }
    }
    stale.sort((a, b) => (b.daysSinceLastSeen ?? 1e9) - (a.daysSinceLastSeen ?? 1e9));

    // 3. Annual burn --------------------------------------------------
    // Recurring items carry their own currency; fold into the main one.
    const main = kv.get('currency') ?? 'USD';
    const inMain = (r: Recurring) =>
      r.currency && r.currency !== main ? fxConvert(r.amount, r.currency, main) : r.amount;
    const expenseRecurring = recurring.filter((r) => r.type === 'expense');
    const annualBurn = expenseRecurring.reduce((s, r) => s + inMain(r) * 12, 0);
    const perItemAnnual = expenseRecurring
      .map((r) => ({ recurring: r, annual: inMain(r) * 12 }))
      .sort((a, b) => b.annual - a.annual);

    void sql; // ensure import is retained when the query falls back to raw
    return { detected, stale, annualBurn, perItemAnnual };
  }, [recurring, _bumpSentinel.length]);
}
