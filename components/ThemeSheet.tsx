// ThemeSheet — pick one of the color themes (Settings → Look).
//
// Each row previews the theme in the current light/dark mode: a card in
// the theme's surface color with its accent, income and expense dots.
// Picking a theme stores kv.themeId; the caller confirms the reload, the
// same way the appearance (light / dark) switch works.

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  theme, THEMES, THEME_IDS, activeThemeIsLight, font, radii, sizes, spacing, type ThemeId,
} from '@/constants/theme';
import { useT } from '@/hooks/useT';

export function themeName(t: (k: string) => string, id: ThemeId): string {
  return t(`me.theme.${id}`);
}

export function ThemeSheet({
  visible,
  selected,
  onPick,
  onClose,
}: {
  visible: boolean;
  selected: ThemeId;
  onPick: (id: ThemeId) => void;
  onClose: () => void;
}) {
  const t = useT();
  const mode = activeThemeIsLight() ? 'light' : 'dark';
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t('common.close')} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <Text style={styles.title}>{t('me.theme')}</Text>
        <Text style={styles.hint}>{t('me.theme.hint')}</Text>
        <ScrollView contentContainerStyle={styles.list}>
          {THEME_IDS.map((id) => {
            const p = THEMES[id][mode];
            const isSel = id === selected;
            return (
              <Pressable
                key={id}
                onPress={() => {
                  onPick(id);
                  onClose();
                }}
                style={[styles.row, isSel && styles.rowSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={themeName(t, id)}
              >
                <View style={[styles.swatch, { backgroundColor: p.bg, borderColor: p.border }]}>
                  <View style={[styles.swatchCard, { backgroundColor: p.bg2 }]}>
                    <View style={[styles.dot, { backgroundColor: p.accent }]} />
                    <View style={[styles.dot, { backgroundColor: p.income }]} />
                    <View style={[styles.dot, { backgroundColor: p.expense }]} />
                  </View>
                  <View style={[styles.swatchLine, { backgroundColor: p.text1 }]} />
                  <View style={[styles.swatchLine, { backgroundColor: p.text3, width: 22 }]} />
                </View>
                <Text style={[styles.label, isSel && { color: theme.accent, fontFamily: font.bodySemi }]}>
                  {themeName(t, id)}
                </Text>
                {isSel && <MaterialCommunityIcons name="check" size={20} color={theme.accent} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '75%',
    backgroundColor: theme.bg1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
    paddingTop: spacing.sm,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border, marginBottom: spacing.md },
  title: { color: theme.text1, fontSize: sizes.lg, fontFamily: font.displayBold },
  hint: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.body, marginTop: 2, marginBottom: spacing.sm },
  list: { gap: 4, paddingBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  rowSelected: { backgroundColor: theme.bg3 },
  swatch: {
    width: 64,
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    padding: 6,
    gap: 4,
  },
  swatchCard: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  swatchLine: { height: 3, borderRadius: 2, width: 34 },
  label: { flex: 1, color: theme.text1, fontSize: sizes.md, fontFamily: font.body },
});
