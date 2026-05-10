// HeaderSettingsButton — top-right cog on every tab.
// Opens the modal Settings screen (app/settings.tsx) via expo-router push.
//
// Lives in components/ so it can be dropped into any header layout
// (Home / Plan / Activity / Me) without each tab repeating the styling.

import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useT } from '@/hooks/useT';

export function HeaderSettingsButton() {
  const router = useRouter();
  const t = useT();
  return (
    <Pressable
      onPress={() => router.push('/settings' as never)}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={t('settings.title')}
    >
      <MaterialCommunityIcons name="cog-outline" size={22} color={theme.text2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
  },
});
