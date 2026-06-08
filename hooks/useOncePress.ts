// Debounced press wrapper — prevents a single Pressable from firing
// its handler twice when the user double-taps faster than the next
// screen / modal can render. Common symptom: two account-detail
// pushes stack, two Smart Add modals open, the same transaction
// gets inserted twice.
//
// Usage:
//   const onPress = useOncePress(() => router.push('/account/123'));
//   <Pressable onPress={onPress} />
//
// The default window is 600 ms — long enough to swallow a real
// double-tap, short enough that a deliberate "open, close, re-open"
// still works.

import { useCallback, useRef } from 'react';

export function useOncePress<T extends (...args: never[]) => unknown>(
  handler: T,
  windowMs = 600,
): T {
  const lastFiredAt = useRef(0);
  return useCallback(((...args: never[]) => {
    const now = Date.now();
    if (now - lastFiredAt.current < windowMs) return;
    lastFiredAt.current = now;
    return handler(...args);
  }) as T, [handler, windowMs]);
}
