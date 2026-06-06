// Insights — modal screen reached from Activity → chart icon.
// Hosts the Income vs Spending chart with a period selector. Future
// surfaces (Net Worth, category trends, savings rate) plug in here.

import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { useT } from '@/hooks/useT';
import { kv } from '@/utils/kv';
import type { CurrencyCode } from '@/constants/currency';
import { useMonthlyIncomeSpending } from '@/hooks/useMonthlyIncomeSpending';
import { IncomeVsSpendingChart } from '@/components/IncomeVsSpendingChart';

type Period = 6 | 12 | 24 | 96; // 96 = ~8y, our stand-in for "all"

const PERIOD_OPTIONS: { value: Period; labelKey: string }[] = [
  { value: 6, labelKey: 'insights.period.6m' },
  { value: 12, labelKey: 'insights.period.12m' },
  { value: 24, labelKey: 'insights.period.24m' },
  { value: 96, labelKey: 'insights.period.all' },
];

export default function InsightsScreen() {
  const router = useRouter();
  const t = useT();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const [period, setPeriod] = useState<Period>(6);

  const monthly = useMonthlyIncomeSpending(period);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel={t('common.close')}
        >
          <MaterialCommunityIcons name="close" size={22} color={theme.text2} />
        </Pressable>
        <Text style={styles.title}>{t('insights.title')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.periodRow}>
        {PERIOD_OPTIONS.map((p) => {
          const active = p.value === period;
          return (
            <Pressable
              key={p.value}
              onPress={() => setPeriod(p.value)}
              style={[styles.periodBtn, active && styles.periodBtnActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.periodText, active && styles.periodTextActive]}>
                {t(p.labelKey)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.sectionLabel}>
          {t('insights.spending.title')}
        </Text>
        {monthly.length === 0 ||
        monthly.every((m) => m.income === 0 && m.spending === 0) ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons
              name="chart-bar"
              size={36}
              color={theme.text3}
            />
            <Text style={styles.emptyText}>{t('insights.spending.empty')}</Text>
          </View>
        ) : (
          <IncomeVsSpendingChart
            data={monthly}
            currency={currency}
            onPressMonth={(monthKey) => {
              // Jump to the Activity tab anchored to this month.
              kv.set('activityJumpToMonth', monthKey);
              router.replace('/(tabs)/activity' as never);
            }}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { color: theme.text1, fontSize: sizes.xl, fontFamily: font.displayBold },
  periodRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    backgroundColor: theme.bg2,
    borderRadius: radii.pill,
    padding: 3,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 7,
    alignItems: 'center',
    borderRadius: radii.pill,
  },
  periodBtnActive: { backgroundColor: theme.accent },
  periodText: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.bodySemi },
  periodTextActive: { color: theme.bg },
  body: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  sectionLabel: {
    color: theme.text2,
    fontSize: sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  empty: {
    padding: spacing.xl,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyText: { color: theme.text3, fontSize: sizes.sm, textAlign: 'center' },
});
