// Biometric unlock (§6 item 2, user chose to include).
// Lazy-opt-in: off by default; user enables in Settings.
// Re-auths on foreground after > 30s background time.

import { useCallback, useEffect, useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import { AppState, type AppStateStatus } from 'react-native';
import { kv } from '@/utils/kv';

const LOCK_TIMEOUT_MS = 30_000;

export function useBiometricSupported(): boolean {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setSupported(hasHardware && enrolled);
    })();
  }, []);
  return supported;
}

export function isBiometricEnabled(): boolean {
  return kv.getBool('biometricEnabled', false);
}

export function setBiometricEnabled(on: boolean): void {
  kv.setBool('biometricEnabled', on);
}

export async function authenticate(reason = 'Unlock MoneyFlow'): Promise<boolean> {
  const res = await LocalAuthentication.authenticateAsync({
    promptMessage: reason,
    fallbackLabel: 'Use passcode',
    disableDeviceFallback: false,
  });
  return res.success;
}

/**
 * Gate hook — returns `locked` true when biometric is required.
 * On app foreground after > 30s in background, locks again.
 */
export function useAppLock(): { locked: boolean; unlock: () => Promise<boolean> } {
  const [locked, setLocked] = useState<boolean>(() => isBiometricEnabled());
  const [bgAt, setBgAt] = useState<number | null>(null);

  useEffect(() => {
    if (!isBiometricEnabled()) return;
    const sub = AppState.addEventListener('change', (status: AppStateStatus) => {
      if (status === 'background' || status === 'inactive') {
        setBgAt(Date.now());
      } else if (status === 'active') {
        if (bgAt && Date.now() - bgAt > LOCK_TIMEOUT_MS) {
          setLocked(true);
        }
        setBgAt(null);
      }
    });
    return () => sub.remove();
  }, [bgAt]);

  const unlock = useCallback(async () => {
    const ok = await authenticate();
    if (ok) setLocked(false);
    return ok;
  }, []);

  return { locked, unlock };
}
