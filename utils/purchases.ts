// Store purchases for the Pro unlock. Everything goes straight to the App
// Store / Google Play through expo-iap: no account, no server. Pro is on
// when the store says this store account owns the product. Every call is
// safe when the store cannot be reached.

import type { Purchase } from 'expo-iap';
import { PRO_PRODUCT_ID } from '@/constants/pro';

// Loaded lazily: a build without the native module (an old dev client, a
// flavor that strips billing) must not crash at import time; it just sees
// the store as unavailable.
type Iap = typeof import('expo-iap');
let iap: Iap | null | undefined;
function store(): Iap | null {
  if (iap === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      iap = require('expo-iap') as Iap;
    } catch {
      iap = null;
    }
  }
  return iap;
}

export type PurchaseOutcome = 'purchased' | 'cancelled' | 'unavailable' | 'failed';
export type RestoreOutcome = 'restored' | 'nothing' | 'unavailable' | 'failed';

let connected: Promise<boolean> | null = null;
let notify: (pro: boolean) => void = () => {};
let price: string | null = null;
/** The purchase the paywall is waiting on, if any. */
let pending: ((outcome: PurchaseOutcome) => void) | null = null;

const settle = (outcome: PurchaseOutcome) => {
  const done = pending;
  pending = null;
  done?.(outcome);
};

const isOurs = (p: Purchase) => p.productId === PRO_PRODUCT_ID && p.purchaseState === 'purchased';

function connect(): Promise<boolean> {
  const s = store();
  if (!s) return Promise.resolve(false);
  if (!connected) {
    let p: Promise<boolean>;
    try {
      p = Promise.resolve(s.initConnection()).then((ok) => !!ok);
    } catch {
      p = Promise.resolve(false);
    }
    connected = p.catch(() => false);
    // A failed connection may work later (no network at launch): don't cache it.
    connected.then((ok) => {
      if (!ok) connected = null;
    });
  }
  return connected;
}

/** Ask the store what this account owns: true / false, or null when it could not be asked. */
async function owned(): Promise<boolean | null> {
  if (!(await connect())) return null;
  try {
    const list = await store()!.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
    return list.some(isOurs);
  } catch {
    return null;
  }
}

/** Start listening to the store and report the Pro state: now and after every purchase or refund. */
export function initPurchases(onPro: (pro: boolean) => void) {
  notify = onPro;
  const s = store();
  if (!s) return;
  try {
    s.purchaseUpdatedListener(async (purchase) => {
    if (!isOurs(purchase)) {
      // Ours but not yet purchased (e.g. Ask to Buy pending): nothing to unlock yet.
      if (purchase.productId === PRO_PRODUCT_ID) settle('failed');
      return;
    }
    // Acknowledge, or Google refunds the purchase after three days.
    try {
      await s.finishTransaction({ purchase, isConsumable: false });
    } catch {}
    notify(true);
    settle('purchased');
  });
    s.purchaseErrorListener((error) => {
      settle(error.code === s.ErrorCode.UserCancelled ? 'cancelled' : 'failed');
    });
  } catch {
    // Native module present but not functional (e.g. a stripped build): behave as offline.
    return;
  }
  owned()
    .then((has) => {
      // Unknown (offline) keeps the last known answer, so Pro keeps working without a connection.
      if (has !== null) notify(has);
    })
    .catch(() => {});
}

/** The store's own price in the buyer's currency; null when the store cannot be reached. */
export async function loadPrice(): Promise<string | null> {
  if (price) return price;
  if (!(await connect())) return null;
  try {
    const found = (await store()!.fetchProducts({ skus: [PRO_PRODUCT_ID], type: 'in-app' })) ?? [];
    for (const p of found as Array<{ id?: string; displayPrice?: string }>) {
      const dp = typeof p.displayPrice === 'string' ? p.displayPrice.trim() : '';
      if (p.id === PRO_PRODUCT_ID && dp) price = dp;
    }
  } catch {}
  return price;
}

export async function buy(): Promise<PurchaseOutcome> {
  if (!(await connect())) return 'unavailable';
  // No price means the store does not know the product (not approved yet, wrong account).
  if (!(await loadPrice())) return 'unavailable';
  if (pending) return 'failed';
  const outcome = new Promise<PurchaseOutcome>((resolve) => {
    pending = resolve;
  });
  try {
    await store()!.requestPurchase({
      type: 'in-app',
      request: { apple: { sku: PRO_PRODUCT_ID }, google: { skus: [PRO_PRODUCT_ID] } },
    });
  } catch (e: unknown) {
    // The listeners normally report the result; this covers a rejection that never reaches them.
    const code = (e as { code?: string })?.code;
    settle(code === store()?.ErrorCode.UserCancelled ? 'cancelled' : 'failed');
  }
  return outcome;
}

export async function restore(): Promise<RestoreOutcome> {
  if (!(await connect())) return 'unavailable';
  try {
    await store()!.restorePurchases();
  } catch {
    return 'failed';
  }
  const has = await owned();
  if (has === null) return 'failed';
  notify(has);
  return has ? 'restored' : 'nothing';
}
