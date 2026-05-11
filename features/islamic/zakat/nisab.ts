// Nisab thresholds and per-currency fallback prices.
// Per plan §6 decision 4: hardcode + opt-in refresh from a metals API.
//
// This module stays free of @/utils/* imports so the unit test runner
// can compile it without dragging in expo-sqlite + MMKV. Live spot
// prices flow in via an optional `metalsCache` parameter from the
// hook layer (useZakatCalculation), which is the only caller that
// can reach the cache.

export const GOLD_GRAMS = 87.48;       // gold nisab
export const SILVER_GRAMS = 612.36;    // silver nisab
export const ZAKAT_RATE = 0.025;       // 2.5%

// Fallback gold/silver prices (per gram). User can refresh via opt-in API call.
// Last updated 2026-04 — refresh annually.
export const FALLBACK_PRICES_PER_GRAM: Record<string, { gold: number; silver: number }> = {
  USD: { gold: 89, silver: 1.05 },
  EUR: { gold: 82, silver: 0.97 },
  GBP: { gold: 70, silver: 0.83 },
  SAR: { gold: 334, silver: 3.94 },
  AED: { gold: 327, silver: 3.86 },
  MYR: { gold: 408, silver: 4.81 },
  IDR: { gold: 1395000, silver: 16450 },
  TRY: { gold: 3450, silver: 40 },
  PKR: { gold: 24700, silver: 290 },
  EGP: { gold: 4360, silver: 51 },
  KZT: { gold: 45000, silver: 530 },
  RUB: { gold: 8200, silver: 97 },
};

export type NisabBasis = 'gold' | 'silver';

export interface LiveSpot {
  /** USD per gram, fetched live by the hook layer. */
  goldPerGramUsd: number;
  silverPerGramUsd: number;
  /** Convert a USD amount to the target currency using the live FX
   *  cache. Pass an identity converter when no FX is available. */
  usdTo: (usd: number, currency: string) => number;
}

export function calculateNisab(
  basis: NisabBasis,
  currency: string = 'USD',
  spot?: LiveSpot,
): number {
  // Prefer freshly-cached USD spot prices when present, then convert to the
  // user's currency via the FX cache. Falls back to the hardcoded table
  // when either is missing.
  if (spot) {
    const pricePerGramUsd = basis === 'gold' ? spot.goldPerGramUsd : spot.silverPerGramUsd;
    const grams = basis === 'gold' ? GOLD_GRAMS : SILVER_GRAMS;
    return spot.usdTo(grams * pricePerGramUsd, currency);
  }
  const price = FALLBACK_PRICES_PER_GRAM[currency] ?? FALLBACK_PRICES_PER_GRAM.USD;
  return basis === 'gold' ? GOLD_GRAMS * price.gold : SILVER_GRAMS * price.silver;
}
