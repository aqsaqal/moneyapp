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

export function StreakBadge({ count }: { count: number }) {
  const glow = useSharedValue(0);

  useEffect(() => {
    glow.value = withRepeat(
      withTiming(1, { duration: 1000 }),
      -1,
      true,
    );
  }, [glow]);

  const animStyle = useAnimatedStyle(() => ({
    shadowOpacity: 0.3 + glow.value * 0.4,
    shadowRadius: 8 + glow.value * 8,
  }));

  if (count < 1) return null;
  return (
    <Animated.View style={[styles.wrap, animStyle]}>
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
