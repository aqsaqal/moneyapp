// Inline halal picker for the Add modal — used as FeatureSlots.AddTxExtras.
// Optional; defaults to unspecified.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme, font, sizes, radii } from '@/constants/theme';
import type { Transaction } from '@/utils/db/schema';

const STATUSES: { id: NonNullable<Transaction['halalStatus']>; label: string; color: string }[] = [
  { id: 'halal', label: 'Halal', color: theme.accent },
  { id: 'haram', label: 'Haram', color: theme.expense },
  { id: 'mushbooh', label: 'Mushbooh', color: theme.warning },
];

export function HalalInlinePicker({
  txDraft,
  onChange,
}: {
  txDraft: Partial<Transaction>;
  onChange: (patch: Partial<Transaction>) => void;
}) {
  const current = txDraft.halalStatus ?? null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Halal status (optional)</Text>
      <View style={styles.row}>
        {STATUSES.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => onChange({ halalStatus: current === s.id ? null : s.id })}
            style={[
              styles.chip,
              { borderColor: s.color },
              current === s.id && { backgroundColor: s.color },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                { color: current === s.id ? theme.bg : s.color },
              ]}
            >
              {s.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: theme.text2, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill, borderWidth: 1, backgroundColor: theme.bg2 },
  chipText: { fontSize: sizes.sm, fontFamily: font.body },
});
