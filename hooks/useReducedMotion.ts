// Reads + listens to the OS "Reduce Motion" accessibility setting.
//
// iOS: Settings → Accessibility → Motion → Reduce Motion
// Android: Settings → Accessibility → Remove animations
// Web: prefers-reduced-motion media query (RN Web maps this).
//
// Components that loop animations (FabButton pulse, StreakBadge glow,
// SuccessOverlay confetti) gate their `withRepeat` / `withSequence` calls
// behind this hook. Static visual + haptic still fire — the goal is to
// remove visual motion, not the feedback that something happened.

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) setReduced(v);
      })
      .catch(() => {
        /* leave default false */
      });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (v) => {
      setReduced(v);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}
