// StreakBadge — Reanimated port of v4's @keyframes streakGlow (line 30).

import React, { useEffect, useState } from 'react';
import { Alert, Pressable, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { theme, radii } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { useT } from '@/hooks/useT';

export function StreakBadge({ count }: { count: number }) {
  const t = useT();
  const glow = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const [, force] = useState(0);
  void force;

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
  const explain = () => {
    // Tap reveals the definition — "consecutive days you've logged an
    // expense." Avoids the user wondering whether it tracks budget,
    // calories, or anything else.
    Alert.alert(
      t('streak.title', { n: count }),
      t('streak.body'),
      [{ text: t('common.close') }],
    );
  };
  return (
    <Pressable
      onPress={explain}
      accessibilityRole="button"
      accessibilityLabel={t('streak.a11y', { n: count })}
      hitSlop={6}
    >
      <Animated.View style={[styles.wrap, animStyle]}>
        <Text style={styles.text}>🔥 {count}</Text>
      </Animated.View>
    </Pressable>
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
