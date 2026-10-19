// SafeToSpendCard — the one Home hero.
//
// Merges the old DisposableHeroCard ("X left this month") and the
// ForecastCard ("at this pace you'll overshoot") into a single card so
// the screen never shows two large numbers that disagree.
//
//   SAFE TO SPEND
//   ₸67 040  a day                      ← the number you use at a shop
//   [━━━━━━━━━●──────]  Day 20 of 31 · 12 days left
//   ● On track · ₸804 000 left after bills      ← ONE verdict, one color
//   ▸ Breakdown (tap)  projected · avg daily · remaining bills · left
//
// Tone comes from the forecast (projected end-of-month disposable):
//   < 0                         → red   "Overshooting by X at this pace"
//   small cushion               → amber "Close · X cushion at this pace"
//   otherwise                   → green "On track · X left after bills"

import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { useT } from '@/hooks/useT';

export interface SafeToSpendCardProps {
  /** Income − unpaid bills − spent so far (display currency). */
  disposable: number;
  daysLeft: number;
  daysElapsed: number;
  daysInMonth: number;
  /** Projected end-of-month disposable; null = not enough data. */
  forecast: number | null;
  avgDailyVariable: number;
  remainingBills: number;
  currency: CurrencyCode;
  onOpenPlan?: () => void;
}

export function SafeToSpendCard({
  disposable,
  daysLeft,
  daysElapsed,
  daysInMonth,
  forecast,
  avgDailyVariable,
  remainingBills,
  currency,
  onOpenPlan,
}: SafeToSpendCardProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const days = Math.max(1, daysLeft);
  const perDay = Math.max(0, disposable) / days;

  // Same thresholds the old ForecastCard used (absolute OR relative).
  const ABS_WARN = 20;
  const REL_WARN = 0.1;
  let tone: 'good' | 'warn' | 'bad' = 'good';
  if (disposable < 0 || (forecast != null && forecast < 0)) tone = 'bad';
  else if (forecast != null && forecast < ABS_WARN && forecast < disposable * REL_WARN) tone = 'warn';
  const toneColor = tone === 'bad' ? theme.expense : tone === 'warn' ? '#EAB308' : theme.accent;

  const verdict =
    disposable < 0
      ? t('hero.verdict.negative', { amount: formatMoney(Math.abs(disposable), currency) })
      : tone === 'bad'
        ? t('hero.verdict.overshoot', { amount: formatMoney(Math.abs(forecast ?? 0), currency) })
        : tone === 'warn'
          ? t('hero.verdict.close', { amount: formatMoney(forecast ?? 0, currency) })
          : t('hero.verdict.onTrack', { amount: formatMoney(disposable, currency) });

  const progress = Math.min(1, Math.max(0, daysElapsed / Math.max(1, daysInMonth)));

  return (
    <Pressable
      onPress={() => setOpen((v) => !v)}
      style={styles.card}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      accessibilityLabel={`${t('hero.safeToSpend')} ${formatMoney(perDay, currency)} ${t('hero.aDay')}. ${verdict}`}
    >
      <Text style={styles.label}>{t('hero.safeToSpend')}</Text>
      <View style={styles.amountRow}>
        <Text style={styles.amount} adjustsFontSizeToFit numberOfLines={1}>
          {formatMoney(perDay, currency)}
        </Text>
        <Text style={styles.aDay}>{t('hero.aDay')}</Text>
      </View>

      <View style={styles.barWrap}>
        <View style={styles.barBg}>
          <View style={[styles.barFill, { width: `${progress * 100}%`, backgroundColor: toneColor }]} />
          <View style={[styles.todayDot, { left: `${progress * 100}%`, backgroundColor: toneColor }]} />
        </View>
        <Text style={styles.barCaption}>
          {t('hero.dayOf', { d: daysElapsed, n: daysInMonth, left: daysLeft })}
        </Text>
      </View>

      <View style={styles.verdictRow}>
        <View style={[styles.dot, { backgroundColor: toneColor }]} />
        <Text style={[styles.verdict, { color: toneColor }]} numberOfLines={2}>{verdict}</Text>
        <MaterialCommunityIcons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.text3} />
      </View>

      {open && (
        <View style={styles.breakdown}>
          <Row label={t('hero.leftThisMonth')} value={formatMoney(disposable, currency)} color={disposable < 0 ? theme.expense : theme.text1} />
          {forecast != null && (
            <Row label={t('hero.projected')} value={`${forecast < 0 ? '−' : ''}${formatMoney(Math.abs(forecast), currency)}`} color={toneColor} />
          )}
          <Row label={t('forecast.avgPerDay')} value={formatMoney(avgDailyVariable, currency)} />
          <Row label={t('forecast.remainingBills')} value={formatMoney(remainingBills, currency)} />
          <Text style={styles.hint}>{t('forecast.basedOn', { days: daysLeft })}</Text>
          {onOpenPlan && (
            <Pressable
              onPress={onOpenPlan}
              style={styles.planLink}
              accessibilityRole="link"
              accessibilityLabel={t('hero.openPlan')}
              hitSlop={6}
            >
              <Text style={styles.planLinkText}>{t('hero.openPlan')}</Text>
              <MaterialCommunityIcons name="chevron-right" size={16} color={theme.accent} />
            </Pressable>
          )}
        </View>
      )}
    </Pressable>
  );
}

function Row({ label, value, color = theme.text1 }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, { color }]} numberOfLines={1}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.bg2,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: theme.border,
  },
  label: {
    color: theme.text2,
    fontSize: sizes.xs,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  amount: {
    color: theme.text1,
    fontSize: sizes.display,
    fontFamily: font.displayBold,
    letterSpacing: -1,
    flexShrink: 1,
  },
  aDay: { color: theme.text2, fontSize: sizes.md, fontFamily: font.body },
  barWrap: { gap: 4 },
  barBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: theme.bg3,
    overflow: 'visible',
  },
  barFill: { height: '100%', borderRadius: 3 },
  todayDot: {
    position: 'absolute',
    top: -3,
    marginLeft: -6,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.bg2,
  },
  barCaption: { color: theme.text3, fontSize: sizes.xs },
  verdictRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  verdict: { flex: 1, fontSize: sizes.sm, fontFamily: font.bodySemi },
  breakdown: {
    marginTop: 2,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    gap: 6,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  rowLabel: { color: theme.text3, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 0.4 },
  rowValue: { fontSize: sizes.sm, fontFamily: font.bodySemi },
  hint: { color: theme.text3, fontSize: sizes.xs, lineHeight: 16, marginTop: 2 },
  planLink: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginTop: 2 },
  planLinkText: { color: theme.accent, fontSize: sizes.sm, fontFamily: font.bodySemi },
});
