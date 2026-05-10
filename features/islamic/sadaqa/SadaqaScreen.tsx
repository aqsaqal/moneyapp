// Sadaqa Tracker screen — three stacked stat cards.
// No comparison, no sharing (riya concern).

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';
import { useSadaqaTotals } from './useSadaqaTotals';
import { ASNAF, loadAsnafBreakdown, type AsnafId } from './asnaf';
import { useTransactions } from '@/hooks/useAppData';

export default function SadaqaScreen() {
  const router = useRouter();
  const totals = useSadaqaTotals();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  // Subscribe to bumps so the breakdown re-runs after every add/edit.
  const _bump = useTransactions({ limit: 1 });
  void _bump;
  const breakdown = loadAsnafBreakdown();
  const grandTotal = breakdown.reduce((s, b) => s + b.total, 0);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={theme.text1} />
        </Pressable>
        <Text style={styles.title}>Sadaqa</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Stat label="This month" value={formatMoney(totals.thisMonth, currency)} />
        <Stat label="This year" value={formatMoney(totals.thisYear, currency)} />
        <Stat label="Lifetime" value={formatMoney(totals.lifetime, currency)} />

        {breakdown.length > 0 && (
          <View style={styles.breakdownCard}>
            <Text style={styles.breakdownTitle}>Distribution by recipient (8 asnaf)</Text>
            {breakdown.map((row) => {
              const meta = ASNAF.find((a) => a.id === row.asnaf as AsnafId);
              const pct = grandTotal > 0 ? Math.round((row.total / grandTotal) * 100) : 0;
              return (
                <View key={row.asnaf} style={styles.breakdownRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.breakdownName}>{meta?.label ?? row.asnaf}</Text>
                    <Text style={styles.breakdownArabic}>{meta?.arabic}</Text>
                  </View>
                  <Text style={styles.breakdownAmt}>{formatMoney(row.total, currency)}</Text>
                  <Text style={styles.breakdownPct}>{pct}%</Text>
                </View>
              );
            })}
          </View>
        )}

        <Text style={styles.note}>
          Includes Zakat, Sadaqa, and Qurban categories. Private — never shared.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  title: { color: theme.text1, fontSize: sizes.xl, fontFamily: font.displayBold },
  scroll: { padding: spacing.lg, gap: spacing.md },
  card: { padding: spacing.lg, borderRadius: radii.xl, backgroundColor: theme.bg2, borderWidth: 1, borderColor: theme.border, gap: 4 },
  label: { color: theme.text2, fontSize: sizes.sm },
  value: { color: theme.accent, fontSize: sizes.xxxl, fontFamily: font.displayBold },
  note: { color: theme.text3, fontSize: sizes.xs, textAlign: 'center', marginTop: spacing.lg, fontStyle: 'italic' },
  breakdownCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 6,
  },
  breakdownTitle: {
    color: theme.text2,
    fontSize: sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 6,
  },
  breakdownName: { color: theme.text1, fontSize: sizes.sm, fontFamily: font.bodySemi },
  breakdownArabic: { color: theme.gold, fontSize: sizes.xs, marginTop: 2 },
  breakdownAmt: { color: theme.text1, fontSize: sizes.sm, fontFamily: font.display },
  breakdownPct: { color: theme.text3, fontSize: sizes.xs, width: 40, textAlign: 'right' },
});
