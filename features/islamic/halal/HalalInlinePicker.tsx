// Inline halal picker for the Add modal — used as FeatureSlots.AddTxExtras.
// Optional; defaults to unspecified.

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme, font, sizes, radii } from '@/constants/theme';
import { ASNAF } from '../sadaqa/asnaf';
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
  // Phase 10q.3 — when this transaction is going to a giving category,
  // surface the 8-asnaf picker so the user can tag the recipient.
  const cat = (txDraft as { category?: string | null }).category ?? null;
  const isGiving = cat === 'zakat' || cat === 'sadaqa' || cat === 'qurban';
  const asnaf = (txDraft as { asnaf?: string | null }).asnaf ?? null;
  return (
    <View style={{ gap: 14 }}>
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
      {isGiving && (
        <View style={styles.wrap}>
          <Text style={styles.label}>Recipient (8 asnaf, optional)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {ASNAF.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => onChange({ asnaf: asnaf === a.id ? null : a.id } as Partial<Transaction>)}
                style={[
                  styles.chip,
                  asnaf === a.id && { backgroundColor: theme.gold, borderColor: theme.gold },
                ]}
                accessibilityLabel={`${a.label} — ${a.brief}`}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: asnaf === a.id ? theme.bg : theme.text2 },
                  ]}
                >
                  {a.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { color: theme.text2, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.pill, borderWidth: 1, backgroundColor: theme.bg2 },
  chipText: { fontSize: sizes.sm, fontFamily: font.body },
});
