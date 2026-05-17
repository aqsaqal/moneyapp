// BalanceCard — home screen balance summary.
//
// v1: <BalanceCard net + income + expense + disposable /> with Net leading.
// v2: <DisposableHeroCard /> leads with Disposable as THE one number; income
//     and expense are demoted to a single line of small subtext. Net moved
//     to Me/Accounts where it's the right context (rare-glance).
//
// Both exported from this file so callers can pick the right variant.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, radii, font, sizes, spacing } from '@/constants/theme';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { t } from '@/utils/i18n';

// =============================================================================
// v2 — DisposableHeroCard (Home)
// =============================================================================

export interface DisposableHeroCardProps {
  disposable: number;
  /** Used for empty-state detection. When 0 we render an empty-state
   *  panel with a context-appropriate CTA instead of meaningless zeros. */
  income: number;
  expense: number;
  daysLeft?: number;
  monthLabel?: string;
  currency?: CurrencyCode;
  /** Phase 10u — projected end-of-month disposable based on the current
   *  trajectory. Drives the trajectory state color (green/yellow/red)
   *  on the hero amount. Not rendered in the hero itself; the optional
   *  ForecastCard below the hero owns that display. */
  forecast?: number;
  /** Which empty state, if any, to render. Caller decides the order:
   *  'no-accounts' is the prerequisite, 'no-income' is the next step. */
  emptyKind?: 'no-accounts' | 'no-income' | null;
  /** Empty-state CTA — meaning depends on emptyKind. */
  onSetUp?: () => void;
}

/**
 * Two-line hero:
 *   Line 1 (huge):   "{currency} {disposable} left this month"
 *   Line 2 (medium): "{currency} {perDay}/day for {N} days"
 *
 * Color carries trajectory state, not the sign of the number:
 *   green   = forecast keeps you ≥10% buffer
 *   yellow  = forecast within 0–10% of zero
 *   red     = forecast < 0 (you'll overshoot at current pace)
 * Painting a positive Disposable red because the forecast says you'll
 * overshoot is the signal users actually need; painting it red just for
 * a temporary negative balance is noise.
 */
export function DisposableHeroCard({
  disposable,
  income,
  expense,
  daysLeft,
  monthLabel,
  currency = 'USD',
  forecast,
  emptyKind,
  onSetUp,
}: DisposableHeroCardProps) {
  void expense; void monthLabel; void income; // retained on the prop API for callers

  // Empty state: depends on what's missing. 'no-accounts' is the
  // prerequisite for everything else, so it takes precedence.
  if (emptyKind) {
    const title =
      emptyKind === 'no-accounts'
        ? t('hero.empty.noAcct.title')
        : t('hero.empty.noIncome.title');
    const body =
      emptyKind === 'no-accounts'
        ? t('hero.empty.noAcct.body')
        : t('hero.empty.noIncome.body');
    const cta =
      emptyKind === 'no-accounts'
        ? t('hero.empty.noAcct.cta')
        : t('hero.empty.noIncome.cta');
    return (
      <View style={styles.heroCard} accessible accessibilityLabel={title}>
        <Text style={styles.heroEmptyTitle}>{title}</Text>
        <Text style={styles.heroEmptyBody}>{body}</Text>
        {onSetUp && (
          <Pressable
            onPress={onSetUp}
            style={({ pressed }) => [
              styles.heroCta,
              pressed && { transform: [{ scale: 0.97 }] },
            ]}
            accessibilityRole="button"
            accessibilityLabel={cta}
          >
            <Text style={styles.heroCtaText}>{cta}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const days = typeof daysLeft === 'number' && daysLeft > 0 ? daysLeft : 1;
  const perDay = disposable / days;

  // Trajectory state via forecast (computed by caller). When forecast is
  // undefined we treat it as healthy (no judgement yet).
  let trajColor = theme.accent; // green
  if (typeof forecast === 'number') {
    if (forecast < 0) trajColor = theme.expense;
    else if (forecast < disposable * 0.1) trajColor = '#EAB308';
  }

  return (
    <View
      style={styles.heroCard}
      accessible
      accessibilityLabel={`${formatMoney(disposable, currency)} ${t('hero.left')}, ${t('hero.perDay', { amount: formatMoney(perDay, currency), days })}`}
    >
      <Text
        style={[styles.heroAmount, { color: trajColor }]}
        adjustsFontSizeToFit
        numberOfLines={1}
      >
        {formatMoney(disposable, currency)} {t('hero.left')}
      </Text>
      <Text style={styles.heroSubline}>
        {t('hero.perDay', { amount: formatMoney(perDay, currency), days })}
      </Text>
    </View>
  );
}

// =============================================================================
// ForecastCard — Phase 10x: dedicated, tappable card below the hero
// =============================================================================

export interface ForecastCardProps {
  forecast: number;
  disposable: number;
  daysLeft: number;
  currency?: CurrencyCode;
}

/** Tappable forecast card. Collapsed: shows the headline. Expanded:
 *  reveals projected end-of-month + a one-line explanation of how it's
 *  computed (avg daily variable spend × days left + remaining bills). */
export function ForecastCard({
  forecast,
  disposable,
  daysLeft,
  currency = 'USD',
}: ForecastCardProps) {
  const [open, setOpen] = React.useState(false);
  // Tone matches the hero's trajectory color.
  let toneColor = theme.accent;
  let tone: 'good' | 'warn' | 'bad' = 'good';
  if (forecast < 0) {
    toneColor = theme.expense;
    tone = 'bad';
  } else if (forecast < disposable * 0.1) {
    toneColor = '#EAB308';
    tone = 'warn';
  }
  const headline =
    tone === 'bad'
      ? t('forecast.overshoot')
      : tone === 'warn'
        ? t('forecast.close')
        : t('forecast.onTrack');
  return (
    <Pressable
      onPress={() => setOpen((v) => !v)}
      style={styles.forecastCard}
      accessibilityRole="button"
      accessibilityLabel={headline}
    >
      <View style={styles.forecastRow}>
        <View style={[styles.forecastDot, { backgroundColor: toneColor }]} />
        <Text style={[styles.forecastHead, { color: toneColor }]}>{headline}</Text>
        <Text style={styles.forecastCta}>{open ? t('forecast.hide') : t('forecast.tap')}</Text>
      </View>
      {open && (
        <View style={styles.forecastBody}>
          <Text style={styles.forecastLine}>
            {t('forecast.projected')}{' '}
            <Text style={{ color: toneColor, fontFamily: font.bodySemi }}>
              {forecast < 0 ? '−' : ''}{formatMoney(forecast, currency)}
            </Text>
          </Text>
          <Text style={styles.forecastHint}>
            {t('forecast.basedOn', { days: daysLeft })}
          </Text>
        </View>
      )}
    </Pressable>
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
  heroEmptyTitle: {
    color: theme.text1,
    fontSize: sizes.lg,
    fontFamily: font.displayBold,
    marginTop: 4,
  },
  heroEmptyBody: {
    color: theme.text3,
    fontSize: sizes.sm,
    fontFamily: font.body,
    marginTop: 6,
    lineHeight: 20,
  },
  heroCta: {
    alignSelf: 'flex-start',
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    backgroundColor: theme.accent,
  },
  heroCtaText: {
    color: theme.bg,
    fontSize: sizes.sm,
    fontFamily: font.bodySemi,
  },
  forecastCard: {
    backgroundColor: theme.bg2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  forecastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  forecastDot: { width: 8, height: 8, borderRadius: 4 },
  forecastHead: { fontSize: sizes.sm, fontFamily: font.bodySemi, flex: 1 },
  forecastCta: { color: theme.text3, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  forecastBody: { marginTop: spacing.sm, gap: 4 },
  forecastLine: { color: theme.text2, fontSize: sizes.sm },
  forecastHint: { color: theme.text3, fontSize: sizes.xs, lineHeight: 16 },

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
