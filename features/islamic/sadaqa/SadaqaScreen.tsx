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

export default function SadaqaScreen() {
  const router = useRouter();
  const totals = useSadaqaTotals();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;

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
});
