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

export interface FabButtonProps {
  onPress: () => void;
  size?: number;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}

export function FabButton({ onPress, size = 56, icon = 'plus' }: FabButtonProps) {
  const pulse = useSharedValue(0);
  const haptics = useHaptics();

  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }),
      -1,
      false,
    );
  }, [pulse]);

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
        style={({ pressed }) => [
          styles.fab,
          { width: size, height: size, borderRadius: size / 2 },
          pressed && { transform: [{ scale: 0.94 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
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
