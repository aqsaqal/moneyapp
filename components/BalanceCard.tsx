// BalanceCard — home screen balance summary.
//
// v1: <BalanceCard net + income + expense + disposable /> with Net leading.
// v2: <DisposableHeroCard /> leads with Disposable as THE one number; income
//     and expense are demoted to a single line of small subtext. Net moved
//     to Me/Accounts where it's the right context (rare-glance).
//
// Both exported from this file so callers can pick the right variant.

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, radii, font, sizes, spacing } from '@/constants/theme';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { t } from '@/utils/i18n';

// =============================================================================
// v2 — DisposableHeroCard (Home)
// =============================================================================

export interface DisposableHeroCardProps {
  disposable: number;
  income: number;
  expense: number;
  daysLeft?: number;
  monthLabel?: string;
  currency?: CurrencyCode;
  /** Phase 10u — projected end-of-month disposable based on the current
   *  trajectory. Rendered as a small line under the hero amount when set. */
  forecast?: number;
}

/**
 * One number, big. Disposable = income - fixed expenses - variable spend.
 * Subtext line: $income in · $spent out · N days left.
 *
 * Phase 6 of v2: replaces v1's BalanceCard on Home. Net Balance moved to
 * Me/Accounts — it's a "see all my money" answer, not a daily-glance answer.
 */
export function DisposableHeroCard({
  disposable,
  income,
  expense,
  daysLeft,
  monthLabel,
  currency = 'USD',
  forecast,
}: DisposableHeroCardProps) {
  const positive = disposable >= 0;
  return (
    <View
      style={styles.heroCard}
      accessible
      accessibilityLabel={`Disposable balance ${formatMoney(disposable, currency)}${monthLabel ? ` for ${monthLabel}` : ''}`}
    >
      <Text style={styles.heroLabel}>
        {t('home.disposable', { month: monthLabel ?? '' }).replace(/^\s*·\s*/, '')}
      </Text>
      <Text
        style={[styles.heroAmount, { color: positive ? theme.text1 : theme.expense }]}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {formatMoney(disposable, currency)}
      </Text>
      <Text style={styles.heroSubline}>
        {formatMoney(income, currency)} · {formatMoney(expense, currency)}
        {typeof daysLeft === 'number' ? ` · ${t('home.daysLeft', { n: daysLeft })}` : ''}
      </Text>
      {typeof forecast === 'number' && (
        // Color carries semantic weight — only paint red when the
        // forecast is actually negative (you'll overshoot). For a
        // healthy positive forecast, stay neutral. Also show the minus
        // sign explicitly so users don't rely on color alone to read
        // the direction.
        <Text
          style={[
            styles.heroForecast,
            { color: forecast < 0 ? theme.expense : theme.text2 },
          ]}
        >
          {t('home.forecast', {
            amount: `${forecast < 0 ? '−' : ''}${formatMoney(forecast, currency)}`,
          })}
        </Text>
      )}
    </View>
  );
}

// =============================================================================
// v1 — BalanceCard (kept for any caller still using it; e.g. future Me screen)
// =============================================================================

export interface BalanceCardProps {
  net: number;
  income: number;
  expense: number;
  disposable?: number;
  monthLabel?: string;
  currency?: CurrencyCode;
}

export function BalanceCard({
  net,
  income,
  expense,
  disposable,
  monthLabel,
  currency = 'USD',
}: BalanceCardProps) {
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
          <Text
            style={[
              styles.disposableValue,
              { color: disposable >= 0 ? theme.accent : theme.expense },
            ]}
          >
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
  // v2 hero
  heroCard: {
    backgroundColor: theme.bg2,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.border,
  },
  heroLabel: {
    color: theme.text2,
    fontSize: sizes.sm,
    fontFamily: font.body,
  },
  heroAmount: {
    color: theme.text1,
    fontSize: sizes.display,
    fontFamily: font.displayBold,
    letterSpacing: -1,
  },
  heroSubline: {
    color: theme.text3,
    fontSize: sizes.sm,
    fontFamily: font.body,
    marginTop: 2,
  },
  heroForecast: {
    fontSize: sizes.sm,
    fontFamily: font.bodySemi,
    marginTop: 6,
  },

  // v1 (kept)
  card: {
    backgroundColor: theme.bg2,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  label: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.body },
  net: { color: theme.text1, fontSize: sizes.display, fontFamily: font.displayBold },
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
