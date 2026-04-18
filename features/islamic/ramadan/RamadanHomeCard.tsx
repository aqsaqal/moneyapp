// Ramadan home card — appears only when current Hijri month === 9.
// Shows suhoor + iftar (offline via adhan), this-Ramadan sadaqa total,
// Zakat al-Fitr reminder in last 10 days.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';
import { isRamadan, isLastTenOfRamadan, toHijri } from '../hijri/conversion';
import { computePrayerTimes } from './prayerTimes';
import { useRamadanSadaqa } from '../sadaqa/useSadaqaTotals';
import umalqura from '@umalqura/core';

function ramadanStartDate(): Date {
  // Find Gregorian date of 1 Ramadan in current Hijri year.
  const today = umalqura(new Date());
  const ramadan1 = umalqura.$.hijriToGregorian(today.hy, 9, 1);
  return new Date(ramadan1.gy, ramadan1.gm - 1, ramadan1.gd);
}

export function RamadanHomeCard() {
  if (!isRamadan()) return null;
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const times = computePrayerTimes();
  const start = ramadanStartDate();
  const sadaqaTotal = useRamadanSadaqa(start);
  const lastTen = isLastTenOfRamadan();
  const h = toHijri(new Date(), 'en');

  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <MaterialCommunityIcons name="moon-waning-crescent" size={20} color={theme.accent} />
        <Text style={styles.heading}>Ramadan {h.year}</Text>
        <Text style={styles.day}>Day {h.day}/30</Text>
      </View>

      {times ? (
        <View style={styles.timesRow}>
          <Time label="Suhoor ends" value={fmtTime(times.fajr)} />
          <Time label="Iftar" value={fmtTime(times.maghrib)} />
        </View>
      ) : (
        <Text style={styles.note}>
          Set your location in Settings to see prayer times.
        </Text>
      )}

      <View style={styles.sadaqaRow}>
        <Text style={styles.sadaqaLabel}>Sadaqa this Ramadan</Text>
        <Text style={styles.sadaqaValue}>{formatMoney(sadaqaTotal, currency)}</Text>
      </View>

      {lastTen && (
        <View style={styles.fitr}>
          <MaterialCommunityIcons name="information-outline" size={14} color={theme.warning} />
          <Text style={styles.fitrText}>Reminder: Zakat al-Fitr is due before Eid prayer.</Text>
        </View>
      )}
    </View>
  );
}

function Time({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.timeBlock}>
      <Text style={styles.timeLabel}>{label}</Text>
      <Text style={styles.timeValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.md, borderRadius: radii.lg, backgroundColor: theme.bg2, borderWidth: 1, borderColor: theme.border, gap: spacing.md },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heading: { color: theme.text1, fontSize: sizes.lg, fontFamily: font.displayBold, flex: 1 },
  day: { color: theme.text3, fontSize: sizes.xs },
  timesRow: { flexDirection: 'row', gap: spacing.md },
  timeBlock: { flex: 1 },
  timeLabel: { color: theme.text2, fontSize: sizes.xs },
  timeValue: { color: theme.text1, fontSize: sizes.lg, fontFamily: font.displayBold },
  note: { color: theme.text3, fontSize: sizes.xs, fontStyle: 'italic' },
  sadaqaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
  sadaqaLabel: { color: theme.text2, fontSize: sizes.sm },
  sadaqaValue: { color: theme.accent, fontSize: sizes.lg, fontFamily: font.displayBold },
  fitr: { flexDirection: 'row', alignItems: 'center', gap: 6, padding: 8, backgroundColor: `${theme.warning}15`, borderRadius: radii.md },
  fitrText: { color: theme.warning, fontSize: sizes.xs, flex: 1 },
});
