// BalanceCard — home screen net-balance + monthly inc/exp cards (v4 lines 347-395).

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, radii, font, sizes, spacing } from '@/constants/theme';
import { formatMoney, type CurrencyCode } from '@/constants/currency';

export interface BalanceCardProps {
  net: number;
  income: number;
  expense: number;
  disposable?: number;
  monthLabel?: string;
  currency?: CurrencyCode;
}

export function BalanceCard({ net, income, expense, disposable, monthLabel, currency = 'USD' }: BalanceCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Net Balance{monthLabel ? ` · ${monthLabel}` : ''}</Text>
      <Text style={styles.net}>{formatMoney(net, currency)}</Text>
      <View style={styles.row}>
        <Pill label="Income" value={income} color={theme.accent} icon="arrow-top-right" currency={currency} />
        <Pill label="Spent" value={expense} color={theme.expense} icon="arrow-bottom-left" currency={currency} />
      </View>
      {disposable !== undefined && (
        <View style={styles.disposable}>
          <Text style={styles.disposableLabel}>Disposable</Text>
          <Text style={[styles.disposableValue, { color: disposable >= 0 ? theme.accent : theme.expense }]}>
            {formatMoney(disposable, currency)}
          </Text>
        </View>
      )}
    </View>
  );
}

function Pill({
  label,
  value,
  color,
  icon,
  currency,
}: {
  label: string;
  value: number;
  color: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  currency: CurrencyCode;
}) {
  return (
    <View style={[styles.pill, { borderColor: theme.border }]}>
      <MaterialCommunityIcons name={icon} size={14} color={color} />
      <View>
        <Text style={styles.pillLabel}>{label}</Text>
        <Text style={[styles.pillValue, { color }]}>{formatMoney(value, currency)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.bg2,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  label: {
    color: theme.text2,
    fontSize: sizes.sm,
    fontFamily: font.body,
  },
  net: {
    color: theme.text1,
    fontSize: sizes.display,
    fontFamily: font.displayBold,
  },
  row: { flexDirection: 'row', gap: spacing.md },
  pill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  pillLabel: { color: theme.text2, fontSize: sizes.xs },
  pillValue: { fontSize: sizes.md, fontFamily: font.display, fontWeight: '700' },
  disposable: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.border,
  },
  disposableLabel: { color: theme.text2, fontSize: sizes.sm },
  disposableValue: { fontSize: sizes.lg, fontFamily: font.display, fontWeight: '700' },
});
