// Tab order — which of the four tabs sits where around the + button.
//
// Stored device-wide (not per profile) as a JSON array of route names.
// The tab bar subscribes through useTabOrder() so a change made in
// Settings is reflected the moment the sheet closes, no reload needed.

import { useEffect, useState } from 'react';
import { kv } from '@/utils/kv';

export type TabRoute = 'index' | 'plan' | 'activity' | 'accounts';
export const DEFAULT_TAB_ORDER: TabRoute[] = ['index', 'plan', 'activity', 'accounts'];

const listeners = new Set<() => void>();

function sanitize(raw: unknown): TabRoute[] {
  if (!Array.isArray(raw)) return DEFAULT_TAB_ORDER;
  const seen = new Set<string>();
  const out: TabRoute[] = [];
  for (const r of raw) {
    if (typeof r === 'string' && (DEFAULT_TAB_ORDER as string[]).includes(r) && !seen.has(r)) {
      seen.add(r);
      out.push(r as TabRoute);
    }
  }
  // Anything missing (older saves, future tabs) is appended in default order.
  for (const r of DEFAULT_TAB_ORDER) if (!seen.has(r)) out.push(r);
  return out;
}

export function getTabOrder(): TabRoute[] {
  return sanitize(kv.getJSON<unknown>('tabOrder'));
}

export function setTabOrder(order: TabRoute[]): void {
  const next = sanitize(order);
  if (next.join() === DEFAULT_TAB_ORDER.join()) kv.delete('tabOrder');
  else kv.setJSON('tabOrder', next);
  listeners.forEach((l) => l());
}

export function isDefaultTabOrder(order: TabRoute[] = getTabOrder()): boolean {
  return order.join() === DEFAULT_TAB_ORDER.join();
}

export function useTabOrder(): TabRoute[] {
  const [order, setOrder] = useState<TabRoute[]>(getTabOrder);
  useEffect(() => {
    const l = () => setOrder(getTabOrder());
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  return order;
}
