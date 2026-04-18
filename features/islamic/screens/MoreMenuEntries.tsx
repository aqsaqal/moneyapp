// Used as FeatureSlots.MoreMenuItems — adds Zakat + Sadaqa entries to the
// Recurring sub-tab in More.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';

export function MoreMenuEntries({ onNavigate }: { onNavigate: (path: string) => void }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.section}>Islamic</Text>
      <Pressable onPress={() => onNavigate('/(islamic)/zakat')} style={styles.row}>
        <View style={[styles.icon, { backgroundColor: `${theme.gold}22` }]}>
          <MaterialCommunityIcons name="hand-heart" size={20} color={theme.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Zakat Calculator</Text>
          <Text style={styles.sub}>Calculate based on your accounts + manual entries</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.text3} />
      </Pressable>
      <Pressable onPress={() => onNavigate('/(islamic)/sadaqa')} style={styles.row}>
        <View style={[styles.icon, { backgroundColor: `${theme.accent}22` }]}>
          <MaterialCommunityIcons name="heart-circle" size={20} color={theme.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Sadaqa Tracker</Text>
          <Text style={styles.sub}>Private totals: month, year, lifetime</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.text3} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  section: { color: theme.text2, fontSize: sizes.sm, textTransform: 'uppercase', letterSpacing: 1, marginTop: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderRadius: radii.lg, backgroundColor: theme.bg2, borderWidth: 1, borderColor: theme.border },
  icon: { width: 40, height: 40, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  label: { color: theme.text1, fontSize: sizes.md, fontFamily: font.body },
  sub: { color: theme.text3, fontSize: sizes.xs, marginTop: 2 },
});
