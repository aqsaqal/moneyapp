// Skeleton — pulsing placeholder boxes shown while data is loading.
//
// Used on cold-launch in app/_layout.tsx instead of returning `null`,
// so the user never sees a blank screen between the splash dismissal
// and the first real frame.
//
// Reduced-motion: pulse animation skipped, static muted block instead.

import React, { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme, radii, spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export interface SkeletonProps {
  width?: number | `${number}%`;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function Skeleton({ width = '100%', height = 16, style }: SkeletonProps) {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.value = withRepeat(
      withTiming(1, { duration: 900 }),
      -1,
      true,
    );
  }, [opacity, reducedMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.box,
        { width: width as ViewStyle['width'], height },
        !reducedMotion && animatedStyle,
        style,
      ]}
    />
  );
}

/** Layout that approximates a Home tab so cold-boot feels like Home is
 *  loading, not crashing. Brand row + hero card + 3 placeholder rows. */
export function HomeSkeleton() {
  // Consume safe-area insets so the placeholder header isn't under the
  // status bar / notch when the device boots fast enough to show this
  // frame before the real Home tab takes over.
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: spacing.lg + insets.top }]}>
      <View style={styles.headerRow}>
        <Skeleton width={120} height={28} />
        <Skeleton width={36} height={36} style={{ borderRadius: 18 }} />
      </View>
      <Skeleton height={140} style={{ borderRadius: 16, marginBottom: spacing.lg }} />
      <Skeleton height={64} style={{ borderRadius: 12, marginBottom: spacing.md }} />
      <Skeleton width={80} height={12} style={{ marginBottom: spacing.sm }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.txRow}>
          <Skeleton width={36} height={36} style={{ borderRadius: 8 }} />
          <Skeleton width="60%" height={16} />
          <Skeleton width={64} height={16} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: theme.bg2,
    borderRadius: radii.sm,
  },
  screen: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: theme.bg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
});
