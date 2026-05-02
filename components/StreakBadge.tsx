// StreakBadge — Reanimated port of v4's @keyframes streakGlow (line 30).

import React, { useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { theme, radii } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export function StreakBadge({ count }: { count: number }) {
  const glow = useSharedValue(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      glow.value = 0.5; // mid-glow static (still readable, no pulse)
      return;
    }
    glow.value = withRepeat(
      withTiming(1, { duration: 1000 }),
      -1,
      true,
    );
  }, [glow, reducedMotion]);

  const animStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.3 + glow.value * 0.4,
    shadowRadius: 8 + glow.value * 8,
  }));

  if (count < 1) return null;
  return (
    <Animated.View
      style={[styles.wrap, animStyle]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`Logging streak: ${count} ${count === 1 ? 'day' : 'days'}`}
    >
      <Text style={styles.text}>🔥 {count}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.pill,
    backgroundColor: theme.bg2,
    shadowColor: theme.warning,
    shadowOffset: { width: 0, height: 0 },
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
  },
  text: {
    color: theme.warning,
    fontSize: 14,
    fontWeight: '700',
  },
});
