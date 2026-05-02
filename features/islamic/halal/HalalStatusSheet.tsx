// Halal status sheet — used as FeatureSlots.TxActionSheetExtras.
// Long-press on a transaction row to set/change halal status.
// Tone (per spec lines 323-326): neutral metadata. No emojis. No warnings.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme, font, sizes, radii } from '@/constants/theme';
import { setHalalStatus } from '@/hooks/useAppData';
import type { Transaction } from '@/utils/db/schema';

const STATUSES: { id: NonNullable<Transaction['halalStatus']>; label: string; color: string }[] = [
  { id: 'halal', label: 'Halal', color: theme.accent },
  { id: 'haram', label: 'Haram', color: theme.expense },
  { id: 'mushbooh', label: 'Mushbooh', color: theme.warning },
  { id: 'unspecified', label: 'Unspecified', color: theme.text3 },
];

export function HalalStatusSheet({ txId }: { txId: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Halal status</Text>
      <View style={styles.row}>
        {STATUSES.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => setHalalStatus(txId, s.id)}
            style={[styles.chip, { borderColor: s.color }]}
          >
            <Text style={[styles.chipText, { color: s.color }]}>{s.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 8, gap: 6 },
  label: { color: theme.text2, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: radii.pill, borderWidth: 1, backgroundColor: theme.bg2 },
  chipText: { fontSize: sizes.xs, fontFamily: font.body },
});
