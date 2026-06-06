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
