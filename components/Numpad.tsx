// Numpad — ports v4 numpad() helper (line 217).
// IMPORTANT: Numpad is hardcoded LTR (I18nManager.swapLeftAndRightInRTL = false
// at the component root) because numeric layout must not flip on RTL — digits
// 1-9 always read left-to-right across Arabic apps by convention.

import React from 'react';
import { View, Text, Pressable, StyleSheet, I18nManager } from 'react-native';
import { theme, radii, font, sizes } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'del'] as const;

export interface NumpadProps {
  onPress: (key: string) => void;
}

export function Numpad({ onPress }: NumpadProps) {
  const haptics = useHaptics();
  const rtl = I18nManager.isRTL;
  return (
    <View style={[styles.grid, rtl && { direction: 'ltr' }]}>
      {KEYS.map((k) => (
        <Pressable
          key={k}
          onPressIn={haptics.tap}
          onPress={() => onPress(k)}
          style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
          accessibilityRole="button"
          accessibilityLabel={k === 'del' ? 'Delete' : k}
        >
          {k === 'del' ? (
            <Text style={styles.keyText}>⌫</Text>
          ) : (
            <Text style={styles.keyText}>{k}</Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  key: {
    width: '30%',
    aspectRatio: 1.6,
    backgroundColor: theme.bg2,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  keyPressed: {
    backgroundColor: theme.bg4,
    transform: [{ scale: 0.94 }],
  },
  keyText: {
    color: theme.text1,
    fontFamily: font.display,
    fontSize: sizes.xxl,
  },
});
