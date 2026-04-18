// Full Zakat calculator screen — reached from More tab via MoreMenuItems.
// Form: mazhab + nisab basis + hawl start date + per-asset-class entries +
// always-visible "consult your local scholar" disclaimer.

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';
import { formatMoney } from '@/constants/currency';
import { MAZHABS, type Mazhab } from './mazhab';
import { setZakatState } from './zakatState';
import { useZakatCalculation } from './useZakatCalculation';

export default function ZakatCalculator() {
  const router = useRouter();
  const z = useZakatCalculation();
  const [, force] = useState(0);

  const setS = (patch: Parameters<typeof setZakatState>[0]) => {
    setZakatState(patch);
    force((x) => x + 1);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={theme.text1} />
        </Pressable>
        <Text style={styles.title}>Zakat Calculator</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.dueCard}>
          <Text style={styles.dueLabel}>Zakat due</Text>
          <Text style={styles.dueAmount}>{formatMoney(z.zakatDue, z.currency)}</Text>
          <Text style={styles.dueSub}>
            Net eligible: {formatMoney(z.netEligible, z.currency)} ·
            Nisab ({z.state.nisabBasis}): {formatMoney(z.nisabValue, z.currency)}
          </Text>
          <Text style={styles.dueSub}>
            Hawl: {z.hawl.isComplete ? 'complete' : `${z.hawl.daysRemaining} days remaining`}
          </Text>
        </View>

        <Section title="Mazhab">
          <View style={styles.chipRow}>
            {(Object.keys(MAZHABS) as Mazhab[]).map((m) => (
              <Pressable
                key={m}
                onPress={() => setS({ mazhab: m })}
                style={[styles.chip, z.state.mazhab === m && styles.chipActive]}
              >
                <Text style={[styles.chipText, z.state.mazhab === m && styles.chipTextActive]}>
                  {MAZHABS[m].name}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.note}>{MAZHABS[z.state.mazhab].note}</Text>
        </Section>

        <Section title="Nisab basis">
          <View style={styles.chipRow}>
            {(['silver', 'gold'] as const).map((b) => (
              <Pressable
                key={b}
                onPress={() => setS({ nisabBasis: b })}
                style={[styles.chip, z.state.nisabBasis === b && styles.chipActive]}
              >
                <Text style={[styles.chipText, z.state.nisabBasis === b && styles.chipTextActive]}>
                  {b}
                </Text>
              </Pressable>
            ))}
          </View>
        </Section>

        <Section title="Wealth (auto from accounts)">
          <Row label="Cash + bank + savings" value={formatMoney(z.cashAssets, z.currency)} />
        </Section>

        <Section title="Wealth (manual entry)">
          <NumRow label="Gold (grams)" value={z.state.manualGold} onChange={(v) => setS({ manualGold: v })} />
          <NumRow label="Silver (grams)" value={z.state.manualSilver} onChange={(v) => setS({ manualSilver: v })} />
          <NumRow label="Business inventory" value={z.state.manualInventory} onChange={(v) => setS({ manualInventory: v })} />
          <NumRow label="Halal investments" value={z.state.manualInvestments} onChange={(v) => setS({ manualInvestments: v })} />
          <NumRow label="Receivables (debts owed to you)" value={z.state.manualReceivables} onChange={(v) => setS({ manualReceivables: v })} />
          <NumRow label="Liabilities (debts you owe)" value={z.state.manualDebts} onChange={(v) => setS({ manualDebts: v })} />
        </Section>

        <Section title="Other wealth">
          <Text style={styles.note}>
            For 401(k), crypto, or other complex assets, consult a qualified scholar.
          </Text>
          <TextInput
            value={z.state.otherWealthNote}
            onChangeText={(v) => setS({ otherWealthNote: v })}
            placeholder="Notes for your scholar consultation"
            placeholderTextColor={theme.text3}
            multiline
            style={styles.textarea}
          />
        </Section>

        <View style={styles.disclaimer}>
          <MaterialCommunityIcons name="information-outline" size={18} color={theme.gold} />
          <Text style={styles.disclaimerText}>
            This calculator uses the {z.appliedMazhab} method. Final rulings on your specific
            situation should come from a qualified scholar. The calculation is an estimate,
            not a fatwa.
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function NumRow({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value || ''));
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <TextInput
        value={text}
        onChangeText={(t) => {
          setText(t);
          const n = parseFloat(t);
          if (Number.isFinite(n)) onChange(n);
          else if (t === '') onChange(0);
        }}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={theme.text3}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  title: { color: theme.text1, fontSize: sizes.xl, fontFamily: font.displayBold },
  scroll: { padding: spacing.lg, gap: spacing.lg },
  dueCard: {
    padding: spacing.lg, borderRadius: radii.xl,
    backgroundColor: theme.bg2,
    borderWidth: 1, borderColor: `${theme.gold}55`,
    gap: 6,
  },
  dueLabel: { color: theme.text2, fontSize: sizes.sm },
  dueAmount: { color: theme.gold, fontSize: sizes.display, fontFamily: font.displayBold },
  dueSub: { color: theme.text3, fontSize: sizes.xs },
  section: { gap: 10 },
  sectionTitle: { color: theme.text2, fontSize: sizes.sm, textTransform: 'uppercase', letterSpacing: 1 },
  chipRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: theme.bg2, borderWidth: 1, borderColor: theme.border },
  chipActive: { backgroundColor: theme.gold, borderColor: 'transparent' },
  chipText: { color: theme.text2, fontSize: sizes.sm, textTransform: 'capitalize' },
  chipTextActive: { color: theme.bg, fontWeight: '700' },
  note: { color: theme.text3, fontSize: sizes.xs, fontStyle: 'italic' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, paddingHorizontal: 12, backgroundColor: theme.bg2, borderRadius: radii.md, borderWidth: 1, borderColor: theme.border },
  rowLabel: { color: theme.text1, fontSize: sizes.sm, flex: 1 },
  rowValue: { color: theme.text1, fontSize: sizes.md, fontFamily: font.display, fontWeight: '700' },
  input: { color: theme.text1, fontSize: sizes.md, fontFamily: font.display, minWidth: 100, textAlign: 'right', paddingVertical: 0 },
  textarea: { backgroundColor: theme.bg2, color: theme.text1, padding: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: theme.border, minHeight: 80, textAlignVertical: 'top' },
  disclaimer: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radii.lg, backgroundColor: `${theme.gold}10`, borderWidth: 1, borderColor: `${theme.gold}33` },
  disclaimerText: { color: theme.text2, fontSize: sizes.sm, flex: 1, lineHeight: 20 },
});
