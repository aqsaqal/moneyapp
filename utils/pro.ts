// Pro entitlement and feature gates.
//
//   isPro()        — the store says this account owns the unlock (cached in
//                    kv.proOwned so it works offline).
//   canUse(f, n)   — may this install use feature f right now?
//
// Grandfather rule: an install that completed onboarding before the first
// Pro build keeps what it already had for free (unlimited events, PDF
// reports). kv.proGate is written once, on the first launch of a Pro build.

import { useSyncExternalStore } from 'react';
import { kv } from '@/utils/kv';
import { listProfiles } from '@/utils/profiles';
import { initPurchases } from '@/utils/purchases';
import { FREE_EVENT_LIMIT, FREE_PROFILE_LIMIT, type ProFeature } from '@/constants/pro';
import { DEMO_CONTROLS } from '@/constants/flavor';

/** Overrides exist in dev and in demo builds only. */
const OVERRIDES = __DEV__ || DEMO_CONTROLS;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** Call once at startup, after the app data is ready. */
export function initPro() {
  if (!kv.get('proGate')) {
    kv.set('proGate', kv.getBool('onboardingCompleted', false) ? 'grandfathered' : 'gated');
  }
  initPurchases((pro) => {
    kv.setBool('proOwned', pro);
    emit();
  });
}

export function isPro(): boolean {
  if (OVERRIDES) {
    const o = kv.get('proDevOverride');
    if (o === '1') return true;
    if (o === '0') return false;
  }
  return kv.getBool('proOwned', false);
}

export function isGrandfathered(): boolean {
  if (OVERRIDES) {
    const o = kv.get('proGateOverride');
    if (o) return o === 'grandfathered';
  }
  return kv.get('proGate') === 'grandfathered';
}

/** Profiles the user made; the Demo profile is not one of them. */
export function ownProfileCount(): number {
  return listProfiles().filter((p) => p.name.toLowerCase() !== 'demo').length;
}

/**
 * `n` is the current count for the counted features: live events for
 * 'events', own profiles for 'profiles' (defaults to the real count).
 */
export function canUse(feature: ProFeature, n?: number): boolean {
  if (isPro()) return true;
  switch (feature) {
    case 'themes':
    case 'split':
    case 'widgets':
      return false;
    case 'pdf':
      return isGrandfathered();
    case 'events':
      return isGrandfathered() || (n ?? 0) < FREE_EVENT_LIMIT;
    case 'profiles':
      return (n ?? ownProfileCount()) < FREE_PROFILE_LIMIT;
  }
}

export function usePro(): boolean {
  return useSyncExternalStore(subscribe, isPro, isPro);
}

export function devProOverride(): '1' | '0' | null {
  const o = kv.get('proDevOverride');
  return o === '1' || o === '0' ? o : null;
}
export function devGateOverride(): 'gated' | 'grandfathered' | null {
  const o = kv.get('proGateOverride');
  return o === 'gated' || o === 'grandfathered' ? o : null;
}

/** Dev / demo switches for the screenshot controller, Settings → Demo controls and manual testing. */
export function devSetPro(v: '1' | '0' | null) {
  if (!OVERRIDES) return;
  if (v) kv.set('proDevOverride', v);
  else kv.delete('proDevOverride');
  emit();
}
export function devSetGate(v: 'gated' | 'grandfathered' | null) {
  if (!OVERRIDES) return;
  if (v) kv.set('proGateOverride', v);
  else kv.delete('proGateOverride');
  emit();
}
