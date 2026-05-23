// FabButton — Reanimated port of v4's @keyframes pulseRing (line 29).

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { t as i18nT } from '@/utils/i18n';

export interface FabButtonProps {
  onPress: () => void;
  /** Phase 10w fast-entry: long-press opens the category grid for a
   *  zero-typing add path. Falls back to onPress when omitted. */
  onLongPress?: () => void;
  size?: number;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}

export function FabButton({ onPress, onLongPress, size = 56, icon = 'plus' }: FabButtonProps) {
  const pulse = useSharedValue(0);
  const haptics = useHaptics();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) {
      pulse.value = 0; // freeze ring at no-pulse state
      return;
    }
    pulse.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [pulse, reducedMotion]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + pulse.value * 0.4 }],
    opacity: 0.6 * (1 - pulse.value),
  }));

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.ring,
          { width: size, height: size, borderRadius: size / 2 },
          ringStyle,
        ]}
      />
      <Pressable
        onPressIn={haptics.press}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={350}
        style={({ pressed }) => [
          styles.fab,
          { width: size, height: size, borderRadius: size / 2 },
          pressed && { transform: [{ scale: 0.94 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={i18nT('fab.addTransaction')}
        accessibilityHint={onLongPress ? i18nT('fab.longPressHint') : undefined}
      >
        <MaterialCommunityIcons name={icon} size={size * 0.5} color={theme.bg} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: theme.accent,
  },
  fab: {
    backgroundColor: theme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
});
