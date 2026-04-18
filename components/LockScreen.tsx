// Biometric lock screen — shown when user has biometric enabled and app is in
// locked state (cold start or returning from > 30s background).

import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';
import { APP_NAME } from '@/constants/flavor';

export function LockScreen({ onUnlock }: { onUnlock: () => Promise<boolean> }) {
  useEffect(() => { onUnlock(); }, []);  // auto-prompt
  return (
    <View style={styles.wrap}>
      <MaterialCommunityIcons name="lock" size={48} color={theme.accent} />
      <Text style={styles.title}>{APP_NAME}</Text>
      <Text style={styles.sub}>Unlock with Face ID / fingerprint</Text>
      <Pressable onPress={onUnlock} style={styles.button}>
        <Text style={styles.buttonText}>Unlock</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  title: { color: theme.text1, fontSize: sizes.xxxl, fontFamily: font.displayBold },
  sub: { color: theme.text2, fontSize: sizes.md, fontFamily: font.body },
  button: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    backgroundColor: theme.accent,
  },
  buttonText: { color: theme.bg, fontSize: sizes.md, fontWeight: '700' },
});
