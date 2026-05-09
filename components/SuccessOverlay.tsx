// SuccessOverlay — Reanimated port of v4's checkPop + confetti @keyframes
// (lines 27-28, 40-43).
//
// Phase 9 (a11y): when Reduce Motion is on, skip the scale-bounce + confetti
// dots. A static green check still appears (so the user knows the action
// succeeded), and the haptic still fires.

import React, { useEffect } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, font, sizes } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const CONFETTI_COUNT = 8;

export interface SuccessOverlayProps {
  visible: boolean;
  /** Short delight caption shown below the check, e.g.
   *  "Predicted from 12 past 'coffee' adds". Truncates if longer. */
  caption?: string | null;
}

export function SuccessOverlay({ visible, caption }: SuccessOverlayProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(0);
  const rotate = useSharedValue(-45);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    if (reducedMotion) {
      // Static check: appear and hold; fade after the parent's 700ms timeout.
      scale.value = 1;
      rotate.value = 0;
      opacity.value = 1;
      opacity.value = withDelay(700, withTiming(0, { duration: 200 }));
      return;
    }
    scale.value = 0;
    rotate.value = -45;
    opacity.value = 1;
    scale.value = withSequence(
      withTiming(1.3, { duration: 250 }),
      withTiming(1, { duration: 150 }),
    );
    rotate.value = withTiming(0, { duration: 400 });
    opacity.value = withDelay(700, withTiming(0, { duration: 200 }));
  }, [visible, reducedMotion, scale, rotate, opacity]);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotate.value}deg` }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <View pointerEvents="none" style={styles.overlay} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Animated.View style={[styles.check, checkStyle]}>
        <MaterialCommunityIcons name="check" size={48} color={theme.bg} />
      </Animated.View>
      {caption ? (
        <Animated.View style={[styles.captionWrap, checkStyle]} pointerEvents="none">
          <Text style={styles.captionText} numberOfLines={2}>{caption}</Text>
        </Animated.View>
      ) : null}
      {/* Confetti only when motion is allowed. */}
      {!reducedMotion &&
        Array.from({ length: CONFETTI_COUNT }).map((_, i) => (
          <ConfettiDot key={i} index={i} visible={visible} />
        ))}
    </View>
  );
}

function ConfettiDot({ index, visible }: { index: number; visible: boolean }) {
  const ty = useSharedValue(0);
  const rot = useSharedValue(0);
  const op = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      ty.value = 0;
      rot.value = 0;
      op.value = 1;
      ty.value = withTiming(-80, { duration: 800 });
      rot.value = withTiming(360, { duration: 800 });
      op.value = withTiming(0, { duration: 800 });
    }
  }, [visible, ty, rot, op]);

  const colors = [theme.accent, theme.expense, theme.warning, theme.indigo, theme.transfer];
  const color = colors[index % colors.length];
  const spread = 120;
  const x = ((index - CONFETTI_COUNT / 2) * spread) / CONFETTI_COUNT;

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x }, { translateY: ty.value }, { rotate: `${rot.value}deg` }],
    opacity: op.value,
  }));

  return <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />;
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  check: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  captionWrap: {
    position: 'absolute',
    bottom: '38%',
    left: 24,
    right: 24,
    alignItems: 'center',
  },
  captionText: {
    color: theme.text2,
    fontSize: sizes.sm,
    fontFamily: font.body,
    textAlign: 'center',
    backgroundColor: `${theme.bg2}cc`,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
});
