// Nisab thresholds and per-currency fallback prices.
// Per plan §6 decision 4: hardcode + opt-in refresh from goldapi.io.

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
};

export type NisabBasis = 'gold' | 'silver';

export function calculateNisab(basis: NisabBasis, currency: string = 'USD'): number {
  const price = FALLBACK_PRICES_PER_GRAM[currency] ?? FALLBACK_PRICES_PER_GRAM.USD;
  return basis === 'gold' ? GOLD_GRAMS * price.gold : SILVER_GRAMS * price.silver;
}
