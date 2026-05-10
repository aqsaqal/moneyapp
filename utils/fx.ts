// FX cache + conversion — Phase 10k.
//
// Stores daily-fresh USD-anchored rates in the `fx_rates` table. Cross-rate
// math happens on the JS side, so a balance in EUR can be displayed in
// SAR without a network call once the cache is warm.
//
// Privacy:
//   - The fetch goes to api.frankfurter.app (free, no API key, ECB-sourced
//     daily reference rates). Outbound URL only — no user data leaves
//     the device.
//   - Off by default. Toggled in Settings → Preferences → "FX auto-refresh".
//     When off, balances render in their native currency without conversion;
//     summaries that mix currencies show the per-currency breakdown
//     instead of a forced single-unit total.

import { getRawDB } from './db/client';

export const FX_TTL_MS = 24 * 60 * 60 * 1000;
export const FX_API = 'https://api.frankfurter.app/latest?from=USD';

export interface FxRow {
  quote: string;
  rate: number;
  fetchedAt: number;
}

/** Load all cached rates as a Map keyed by quote currency. */
export function loadRates(): Map<string, FxRow> {
  const raw = getRawDB();
  const rows = raw.getAllSync(
    `SELECT quote, rate, fetched_at as fetchedAt FROM fx_rates`,
  ) as FxRow[];
  return new Map(rows.map((r) => [r.quote, r]));
}

/** Earliest fetchedAt across all cached rows. Returns 0 when empty. */
export function oldestFetchedAt(): number {
  const raw = getRawDB();
  const row = raw.getFirstSync(
    `SELECT MIN(fetched_at) as t FROM fx_rates`,
  ) as { t: number | null } | undefined;
  return row?.t ?? 0;
}

/** Convert `amount` from one ISO 4217 currency to another using the cached
 *  USD-anchored rates. When a rate isn't cached the function falls back to
 *  the input amount unchanged — UI must surface an "approximate" indicator
 *  upstream when it can detect mismatches. Same currency is a no-op. */
export function convert(amount: number, from: string, to: string): number {
  if (from === to) return amount;
  const rates = loadRates();
  const fromRate = from === 'USD' ? 1 : rates.get(from)?.rate;
  const toRate = to === 'USD' ? 1 : rates.get(to)?.rate;
  if (!fromRate || !toRate) return amount;
  // Convert to USD first, then to the target.
  const usd = amount / fromRate;
  return usd * toRate;
}

/** Sync helper: did the cache miss for either of these currencies? Used
 *  to flag converted totals as "approximate" when one leg is uncached. */
export function isApproximate(from: string, to: string): boolean {
  if (from === to) return false;
  const rates = loadRates();
  const has = (c: string) => c === 'USD' || rates.has(c);
  return !(has(from) && has(to));
}

interface FrankfurterResponse {
  amount: number;
  base: string;
  date: string;
  rates: Record<string, number>;
}

/** Fetch the latest USD-anchored rates from frankfurter.app and overwrite
 *  the cache. Throws on network failure. Caller (useFxRates) decides
 *  whether to surface the error to the user. */
export async function refreshRates(): Promise<{ updated: number; date: string }> {
  const response = await fetch(FX_API, { method: 'GET' });
  if (!response.ok) {
    throw new Error(`fx: HTTP ${response.status}`);
  }
  const data = (await response.json()) as FrankfurterResponse;
  if (data.base !== 'USD') {
    throw new Error('fx: unexpected base currency');
  }
  const now = Date.now();
  const raw = getRawDB();
  raw.withTransactionSync(() => {
    for (const [quote, rate] of Object.entries(data.rates)) {
      raw.runSync(
        `INSERT INTO fx_rates (quote, rate, fetched_at)
         VALUES (?, ?, ?)
         ON CONFLICT(quote) DO UPDATE SET
           rate = excluded.rate,
           fetched_at = excluded.fetched_at`,
        [quote, rate, now],
      );
    }
  });
  return { updated: Object.keys(data.rates).length, date: data.date };
}
