// ActiveEventCard — Home card shown while an event / trip is running:
// "Almaty trip · Day 3 of 7 · 4 days left" with what it has cost so far
// and the budget bar when one is set. Tap opens the event screen.
// Renders nothing when no event covers today.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { useEvents, useEventSpentMap, eventCoversDate, eventDayCount } from '@/hooks/useAppData';
import { useT } from '@/hooks/useT';
import { kv } from '@/utils/kv';
import { formatMoney } from '@/utils/format';
import { convert } from '@/utils/fx';
import type { CurrencyCode } from '@/constants/currency';

export function ActiveEventCard() {
  const t = useT();
  const router = useRouter();
  const events = useEvents();
  const spentMap = useEventSpentMap();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const now = Date.now();
  // Newest-starting running event wins when two overlap.
  const ev = events.find((e) => eventCoversDate(e, now));
  if (!ev) return null;

  const days = eventDayCount(ev);
  const dayIndex = Math.min(days, Math.max(1, Math.floor((now - ev.startDate) / 86_400_000) + 1));
  const daysLeft = days - dayIndex;
  const spent = spentMap.get(ev.id) ?? 0;
  const budgetMain =
    ev.budget != null && ev.budget > 0
      ? convert(ev.budget, (ev.budgetCurrency as CurrencyCode | null) ?? currency, currency)
      : null;
  const pct = budgetMain ? Math.min(1, spent / budgetMain) : dayIndex / days;
  const barColor = budgetMain && spent > budgetMain ? theme.expense : ev.color;

  return (
    <Pressable
      onPress={() => router.push(`/event/${ev.id}` as never)}
      style={[styles.card, { borderColor: `${ev.color}66` }]}
      accessibilityRole="button"
      accessibilityLabel={`${ev.name}, ${t('events.status.dayOf', { d: dayIndex, n: days })}, ${formatMoney(spent, currency)}`}
    >
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: `${ev.color}22` }]}>
          <MaterialCommunityIcons name={ev.icon as never} size={20} color={ev.color} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.name} numberOfLines={1}>{ev.name}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {t('events.status.dayOf', { d: dayIndex, n: days })}
            {' · '}
            {daysLeft > 1 ? t('home.event.daysLeft', { n: daysLeft }) : daysLeft === 1 ? t('home.event.oneDayLeft') : t('home.event.lastDay')}
          </Text>
        </View>
        <View style={styles.right}>
          <Text style={[styles.amount, { color: ev.color }]} adjustsFontSizeToFit numberOfLines={1}>
            {formatMoney(spent, currency)}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {budgetMain ? t('events.ofBudget.short', { budget: formatMoney(budgetMain, currency) }) : t('events.spent')}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.text3} />
      </View>
      <View style={styles.barBg}>
        <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    gap: spacing.sm,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 36, height: 36, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center' },
  name: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi },
  sub: { color: theme.text3, fontSize: sizes.xs, marginTop: 1 },
  right: { alignItems: 'flex-end', maxWidth: '40%' },
  amount: { fontSize: sizes.md, fontFamily: font.displayBold },
  barBg: { height: 5, backgroundColor: theme.bg3, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
});
