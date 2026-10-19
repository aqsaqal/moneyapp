// Toast — a small, non-blocking confirmation that slides up above the
// tab bar for ~2s. Used for "saved" feedback on the edit sheets (goal,
// debt, recurring, account, category) where the full-screen
// SuccessOverlay used by Smart Add would be too heavy.
//
// Usage:
//   showToast(t('toast.saved.goal'));   // from anywhere, after a save
//
// <ToastHost /> is mounted once in app/_layout.tsx. The host sits as a
// sibling of the root Stack, so it renders above tab screens but UNDER
// native modal stack screens (settings, categories-manage). Sheets that
// open from those screens still get the haptic; the toast is a bonus
// where it is visible.

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const TOAST_MS = 1800;
// Clears the tab bar (≈ 64) + FAB overhang.
const TAB_BAR_CLEARANCE = 96;

type Listener = (message: string) => void;
let listener: Listener | null = null;

/** Show a short confirmation. No-op when the host isn't mounted. */
export function showToast(message: string): void {
  listener?.(message);
}

export function ToastHost() {
  const [message, setMessage] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    listener = (m) => {
      setMessage(m);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), TOAST_MS);
    };
    return () => {
      listener = null;
      if (timer) clearTimeout(timer);
    };
  }, []);

  if (!message) return null;
  return (
    <View
      pointerEvents="none"
      style={[styles.wrap, { bottom: TAB_BAR_CLEARANCE + insets.bottom }]}
    >
      <Animated.View
        entering={reduced ? undefined : FadeInDown.duration(180)}
        exiting={reduced ? undefined : FadeOutDown.duration(180)}
        style={styles.toast}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <MaterialCommunityIcons name="check-circle" size={16} color={theme.accent} />
        <Text style={styles.text} numberOfLines={2} maxFontSizeMultiplier={1.4}>
          {message}
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: theme.bg3,
    borderWidth: 1,
    borderColor: theme.border,
    maxWidth: '85%',
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: {
    color: theme.text1,
    fontFamily: font.bodySemi,
    fontSize: sizes.sm,
  },
});
