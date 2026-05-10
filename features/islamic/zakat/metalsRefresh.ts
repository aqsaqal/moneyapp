// Phase 10q.2 — gold + silver spot price refresh.
//
// Source: api.gold-api.com — free, no API key, returns spot in USD per
// troy ounce. We convert to per-gram and persist alongside the existing
// FALLBACK_PRICES_PER_GRAM in MMKV. Cross-currency conversion reuses
// utils/fx.ts (which is itself opt-in via fxAutoRefresh).
//
// Cache key: kv.islamic.metalsCache = JSON {
//   fetchedAt: number,
//   pricesUsdPerGram: { gold, silver },
// }
//
// Privacy: outbound URL only — no user data leaves the device. Only
// fired when kv.islamic.nisabAutoRefresh is on AND cache is stale.
// Disclosed in privacy.md alongside the FX call.

import { kv } from '@/utils/kv';

const GOLD_URL = 'https://api.gold-api.com/price/XAU';
const SILVER_URL = 'https://api.gold-api.com/price/XAG';
const TROY_OZ_TO_GRAMS = 31.1034768;

const CACHE_KEY = 'islamic.metalsCache';
const REFRESH_TTL_MS = 24 * 60 * 60 * 1000;

export interface MetalsCache {
  fetchedAt: number;
  pricesUsdPerGram: {
    gold: number;
    silver: number;
  };
}

export function loadMetalsCache(): MetalsCache | null {
  return kv.getJSON<MetalsCache>(CACHE_KEY) ?? null;
}

export function isStale(): boolean {
  const c = loadMetalsCache();
  if (!c) return true;
  return Date.now() - c.fetchedAt > REFRESH_TTL_MS;
}

interface GoldApiResponse {
  name: string;        // 'XAU' or 'XAG'
  price: number;       // USD per troy oz
  symbol: string;
  updatedAt: string;
}

async function fetchOne(url: string): Promise<number> {
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as GoldApiResponse;
  if (!Number.isFinite(data.price)) throw new Error('bad payload');
  return data.price / TROY_OZ_TO_GRAMS;
}

export async function refreshMetals(): Promise<MetalsCache> {
  const [gold, silver] = await Promise.all([
    fetchOne(GOLD_URL),
    fetchOne(SILVER_URL),
  ]);
  const cache: MetalsCache = {
    fetchedAt: Date.now(),
    pricesUsdPerGram: { gold, silver },
  };
  kv.setJSON(CACHE_KEY, cache);
  return cache;
}
