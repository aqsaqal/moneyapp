// useFxRates — Phase 10k.
//
// Hook that:
//   - Subscribes to the version bumper so consumers re-render when rates
//     refresh.
//   - Optionally kicks off an auto-refresh on mount when `kv.fxAutoRefresh`
//     is on AND the cache is stale (>24h or empty).
//   - Exposes a `refresh()` callback for manual "pull to refresh" use.
//
// All conversion math lives in utils/fx.ts; this hook is just the React
// glue + lifecycle.

import { useCallback, useEffect, useState } from 'react';
import { kv } from '@/utils/kv';
import { FX_TTL_MS, oldestFetchedAt, refreshRates } from '@/utils/fx';

type Listener = () => void;
const listeners = new Set<Listener>();
let version = 0;
function bumpFx() {
  version += 1;
  listeners.forEach((l) => l());
}

export interface FxState {
  /** Returns the latest cache version; bumped after refresh succeeds. */
  version: number;
  /** Last successful fetch timestamp (ms); 0 when cache is empty. */
  lastFetched: number;
  /** True while a refresh is in flight. */
  refreshing: boolean;
  /** Last error message from refresh (if any). null after a successful run. */
  error: string | null;
  /** Manually trigger a refresh. Caller chooses whether to await. */
  refresh: () => Promise<void>;
}

export function useFxRates(): FxState {
  const [, setV] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<number>(() => oldestFetchedAt());

  useEffect(() => {
    const l = () => {
      setV((x) => x + 1);
      setLastFetched(oldestFetchedAt());
    };
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, []);

  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      await refreshRates();
      setLastFetched(Date.now());
      bumpFx();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  // One-shot: if auto-refresh is on and the cache is stale, kick off a
  // refresh on mount. Won't block render — `refreshing` flips while it
  // happens; consumers can show a subtle indicator.
  useEffect(() => {
    if (!kv.getBool('fxAutoRefresh', false)) return;
    const stale = lastFetched === 0 || Date.now() - lastFetched > FX_TTL_MS;
    if (!stale) return;
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { version, lastFetched, refreshing, error, refresh };
}
