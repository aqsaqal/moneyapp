// Cycling halal filter chip — used as FeatureSlots.HistoryFilterExtras.

import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { theme, font, sizes, radii } from '@/constants/theme';

const STATES: (string | null)[] = [null, 'halal', 'haram', 'mushbooh', 'unspecified'];
const LABELS: Record<string, string> = {
  null: 'Halal: All',
  halal: 'Halal only',
  haram: 'Haram only',
  mushbooh: 'Mushbooh only',
  unspecified: 'Unspecified',
};

export function HalalFilterChip({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  const next = () => {
    const i = STATES.indexOf(value);
    onChange(STATES[(i + 1) % STATES.length]);
  };
  const label = LABELS[String(value)] ?? 'Halal: All';
  const active = value !== null;
  return (
    <Pressable onPress={next} style={[styles.chip, active && styles.active]}>
      <Text style={[styles.text, active && styles.activeText]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: theme.bg2, borderWidth: 1, borderColor: theme.border },
  active: { backgroundColor: theme.accent, borderColor: 'transparent' },
  text: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.body },
  activeText: { color: theme.bg, fontWeight: '700' },
});
