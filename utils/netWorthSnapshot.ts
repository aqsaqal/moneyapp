// Net worth snapshots — Phase 10p.
//
// snapshotTodayIfMissing() is called once per app boot from bootAppData().
// If the active profile already has a row for today, we no-op. Otherwise
// we sum every account's balance (FX-converted to the user's display
// currency) into {assets, debt, net} and INSERT.
//
// The chart upstream reads the last N rows ORDER BY date DESC.

import { getRawDB } from './db/client';
import { kv } from './kv';
import { convert } from './fx';
import { getActiveProfileId } from './profiles';
import type { CurrencyCode } from '@/constants/currency';

function isoDate(d: Date = new Date()): string {
  // YYYY-MM-DD in local time so day boundaries match the user's wall clock.
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

interface AccountRow {
  balance: number;
  currency: string | null;
}

/** Compute today's snapshot from the current account balances and
 *  INSERT-OR-REPLACE it. Always overwrites — used by both the boot-time
 *  call (where the row may be missing) and the post-write hook in
 *  useAppData (where the row exists but is stale because a tx just
 *  shifted a balance). */
export function refreshTodaySnapshot(): void {
  const raw = getRawDB();
  const today = isoDate();
  const display = (kv.get('currency') ?? 'USD') as CurrencyCode;
  // Skip archived + explicitly excluded accounts. Net worth should
  // reflect what the user considers part of their finances — retired
  // wallets and "watch-only" / spouse accounts don't count.
  const accounts = raw.getAllSync(
    `SELECT balance, currency
       FROM accounts
      WHERE (archived IS NULL OR archived != 1)
        AND (include_in_total IS NULL OR include_in_total != 0)`,
  ) as AccountRow[];

  let assets = 0;
  let debt = 0;
  for (const a of accounts) {
    const ac = (a.currency ?? display) as CurrencyCode;
    const inDisplay = convert(a.balance, ac, display);
    if (inDisplay >= 0) assets += inDisplay;
    else debt += Math.abs(inDisplay);
  }
  const net = assets - debt;
  raw.runSync(
    `INSERT OR REPLACE INTO net_worth_snapshots (date, assets, debt, net)
     VALUES (?, ?, ?, ?)`,
    [today, assets, debt, net],
  );
}

/** Called once per boot. Skips work when today's row is already there;
 *  the post-write hook handles intra-day refreshes. */
export function snapshotTodayIfMissing(): void {
  const raw = getRawDB();
  const today = isoDate();
  const exists = raw.getFirstSync(
    `SELECT 1 AS x FROM net_worth_snapshots WHERE date = ?`,
    [today],
  ) as { x: number } | undefined;
  if (exists) return;
  refreshTodaySnapshot();
}

export interface NetWorthPoint {
  date: string; // YYYY-MM-DD
  assets: number;
  debt: number;
  net: number;
}

/** One-shot historical backfill. Walks every transaction newest-to-
 *  oldest, undoing each into a per-account running balance map, and
 *  writes a month-end net-worth snapshot for every month that doesn't
 *  already have one. Uses INSERT OR IGNORE so any present row wins.
 *
 *  Caveat: FX rates used here are *current* rates (we don't reliably
 *  store the rate at each transaction's time on the per-account
 *  amount). Snapshots computed by this pass are approximations of
 *  past net worth, scaled by today's FX. Good enough to draw a chart;
 *  not authoritative for tax or audit.
 *
 *  Idempotent. Sets kv.netWorthBackfillDone='1' on success so we don't
 *  re-do the work on every boot. */
export function backfillNetWorthHistory(): void {
  // Per-profile gate. Keyed under `...DoneV2` because the v1 pass had
  // a subtly wrong emission rule (it emitted a snapshot for any month
  // whose successor month had transactions, instead of only months
  // that had transactions themselves). The new key forces every
  // profile to re-evaluate against v2's stricter rule.
  const profileId = getActiveProfileId();
  const doneCsv = kv.get('netWorthBackfillDoneV2') ?? '';
  const doneSet = new Set(doneCsv.split(',').filter(Boolean));
  if (doneSet.has(profileId)) return;
  const raw = getRawDB();
  // Each profile's first v2 backfill wipes its own pre-today rows.
  // Today's row is owned by refreshTodaySnapshot; everything else is
  // either v1 backfill noise (potentially the buggy April row) or
  // daily auto-rows that the monthly chart doesn't need.
  try {
    raw.runSync(
      `DELETE FROM net_worth_snapshots WHERE date < ?`,
      [isoDate()],
    );
  } catch { /* table empty / missing — ignore */ }

  // Account universe (active + included_in_total only — same filter
  // as refreshTodaySnapshot, so present-day snapshot agrees with
  // backfilled ones at the cutover).
  interface AcctRow { id: string; balance: number; currency: string | null }
  const accounts = raw.getAllSync<AcctRow>(
    `SELECT id, balance, currency
       FROM accounts
      WHERE (archived IS NULL OR archived != 1)
        AND (include_in_total IS NULL OR include_in_total != 0)`,
  );
  if (accounts.length === 0) {
    doneSet.add(profileId);
    kv.set('netWorthBackfillDone', Array.from(doneSet).join(','));
    return;
  }
  const display = (kv.get('currency') ?? 'USD') as CurrencyCode;

  // Working state: per-account running balance and currency.
  const bal = new Map<string, number>();
  const ccy = new Map<string, string>();
  for (const a of accounts) {
    bal.set(a.id, a.balance);
    ccy.set(a.id, a.currency ?? display);
  }

  interface TxRow {
    type: string;
    amount: number;
    account_id: string;
    to_account_id: string | null;
    to_amount: number | null;
    date: number;
  }
  const txns = raw.getAllSync<TxRow>(
    `SELECT type, amount, account_id, to_account_id, to_amount, date
       FROM transactions
      WHERE applied IS NULL OR applied = 1
      ORDER BY date DESC`,
  );

  // Cap on backfill window — protects against thousands of months on
  // exotic seed data. 36 months is plenty for the chart's "All" view.
  const MAX_MONTHS = 36;
  const now = new Date();
  // Start at the END of LAST month — today's row is owned by the
  // present-day writer (refreshTodaySnapshot).
  let cursor = new Date(now.getFullYear(), now.getMonth(), 0);
  let idx = 0;

  // Build the set of months that actually had transactions. We only
  // emit a snapshot for a month if that month itself had activity —
  // otherwise a chart would draw a bar for, say, April when the user
  // had nothing happen in April. The balance MIGHT have been X at
  // end-of-April (carried over from prior activity), but UX-wise
  // "show me data for months I touched" matches user expectation.
  const activeMonths = new Set<string>();
  for (const t of txns) {
    const d = new Date(t.date);
    activeMonths.add(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
    );
  }

  raw.execSync('BEGIN');
  try {
    for (let m = 0; m < MAX_MONTHS; m++) {
      // Undo every tx that happened AFTER cursor — those have already
      // been baked into the current balance map, so reverse their
      // effect to step back in time.
      while (idx < txns.length && txns[idx].date > cursor.getTime()) {
        undoTx(bal, txns[idx]);
        idx++;
      }
      const monthKey = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
      if (activeMonths.has(monthKey)) {
        let assets = 0;
        let debt = 0;
        for (const [id, balance] of bal.entries()) {
          const v = convert(balance, ccy.get(id) ?? display, display);
          if (v >= 0) assets += v;
          else debt += Math.abs(v);
        }
        const dateStr = isoDate(cursor);
        raw.runSync(
          `INSERT OR IGNORE INTO net_worth_snapshots (date, assets, debt, net)
           VALUES (?, ?, ?, ?)`,
          [dateStr, assets, debt, assets - debt],
        );
      }
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), 0); // last day of prev month
      // Stop when we've consumed every tx — earlier months would be
      // identical flat repeats of the starting balance.
      if (idx >= txns.length) break;
    }
    raw.execSync('COMMIT');
  } catch (e) {
    raw.execSync('ROLLBACK');
    throw e;
  }
  doneSet.add(profileId);
  kv.set('netWorthBackfillDoneV2', Array.from(doneSet).join(','));
}

/** Step a single transaction backwards through the per-account
 *  balance map (i.e. undo its effect). Mirror of how `addTransaction`
 *  applies the change. */
function undoTx(
  bal: Map<string, number>,
  t: { type: string; amount: number; account_id: string; to_account_id: string | null; to_amount: number | null },
): void {
  if (t.type === 'income') {
    bal.set(t.account_id, (bal.get(t.account_id) ?? 0) - t.amount);
  } else if (t.type === 'expense') {
    bal.set(t.account_id, (bal.get(t.account_id) ?? 0) + t.amount);
  } else if (t.type === 'transfer' && t.to_account_id) {
    bal.set(t.account_id, (bal.get(t.account_id) ?? 0) + t.amount);
    bal.set(
      t.to_account_id,
      (bal.get(t.to_account_id) ?? 0) - (t.to_amount ?? t.amount),
    );
  }
}

/** Pull the last N days of snapshots ordered chronologically. Returns
 *  empty when the table has no rows (first launch before snapshot ran). */
export function recentSnapshots(days = 90): NetWorthPoint[] {
  const raw = getRawDB();
  const rows = raw.getAllSync(
    `SELECT date, assets, debt, net FROM net_worth_snapshots
      ORDER BY date DESC
      LIMIT ?`,
    [days],
  ) as NetWorthPoint[];
  return rows.reverse();
}
