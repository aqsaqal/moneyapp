// FX cache + conversion.
//
// Stores daily-fresh USD-anchored rates in the `fx_rates` table. Cross-rate
// math happens on the JS side, so a balance in EUR can be displayed in
// SAR without a network call once the cache is warm.
//
// Multi-source fallback (try in order, first success wins):
//   1. open.er-api.com   — free, no API key, ~160 currencies including
//      KZT/RUB/SAR/AED/IRR/EGP etc. that frankfurter doesn't cover.
//   2. fxratesapi.com    — free, no API key, broad coverage.
//   3. api.frankfurter.app — ECB, free, no API key, ~30 currencies.
// First two return wider coverage; frankfurter is the most trustworthy
// when its currencies are in scope, but it's last because it's narrowest.
//
// Privacy:
//   - Outbound URL only; no user data is included in the request.
//   - Auto-fetched once per 24h whenever the app boots with multi-currency
//     accounts, OR a single-currency user explicitly enables the toggle.
//   - Disclosed in docs/legal/privacy.md.

import { getRawDB } from './db/client';

export const FX_TTL_MS = 24 * 60 * 60 * 1000;
const FX_TIMEOUT_MS = 8000;

/** Sources tried in order. First non-error response wins. */
const FX_SOURCES: Array<{ name: string; url: string; extract: (data: unknown) => Record<string, number> | null }> = [
  {
    name: 'open.er-api',
    url: 'https://open.er-api.com/v6/latest/USD',
    extract: (data) => {
      const d = data as { result?: string; rates?: Record<string, number> };
      return d.result === 'success' && d.rates ? d.rates : null;
    },
  },
  {
    name: 'fxratesapi',
    url: 'https://api.fxratesapi.com/latest?base=USD',
    extract: (data) => {
      const d = data as { success?: boolean; rates?: Record<string, number> };
      return d.success !== false && d.rates ? d.rates : null;
    },
  },
  {
    name: 'frankfurter',
    url: 'https://api.frankfurter.app/latest?from=USD',
    extract: (data) => {
      const d = data as { base?: string; rates?: Record<string, number> };
      return d.base === 'USD' && d.rates ? d.rates : null;
    },
  },
];

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

/** Try each FX source in turn; first successful response wins. Returns
 *  the merged rate map and which source served it. Throws if every
 *  source fails. */
async function fetchWithFallback(): Promise<{ rates: Record<string, number>; source: string }> {
  const errors: string[] = [];
  for (const src of FX_SOURCES) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FX_TIMEOUT_MS);
      let response: Response;
      try {
        response = await fetch(src.url, { method: 'GET', signal: controller.signal });
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) {
        errors.push(`${src.name}: HTTP ${response.status}`);
        continue;
      }
      const data = (await response.json()) as unknown;
      const rates = src.extract(data);
      if (rates && Object.keys(rates).length > 0) {
        return { rates, source: src.name };
      }
      errors.push(`${src.name}: empty rates`);
    } catch (e) {
      errors.push(`${src.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  throw new Error(`fx: all sources failed (${errors.join(' · ')})`);
}

/** Fetch the latest USD-anchored rates from the source chain and overwrite
 *  the cache. Throws on total failure. Caller (useFxRates) decides
 *  whether to surface the error to the user. */
export async function refreshRates(): Promise<{ updated: number; source: string }> {
  const { rates, source } = await fetchWithFallback();
  const now = Date.now();
  const raw = getRawDB();
  raw.withTransactionSync(() => {
    for (const [quote, rate] of Object.entries(rates)) {
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
  return { updated: Object.keys(rates).length, source };
}
