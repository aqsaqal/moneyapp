// Accounts tab — single-purpose: net-worth Overview + the accounts list.
//
// v2 Phase 10g: settings (+ Profiles, language, currency, security, data,
// about, islamic mazhab/method) all live in the /settings modal reachable
// from the cog button on every tab. This screen is just two sections.

import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import {
  SectionHeader,
  SummaryCard,
  sectionStyles,
} from '@/components/Sections';
import { AccountSheet } from '@/components/AccountSheet';
import { HeaderSettingsButton } from '@/components/HeaderSettingsButton';
import { useAccounts } from '@/hooks/useAppData';
import type { Account } from '@/utils/db/schema';
import { type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';
import { formatMoney } from '@/utils/format';
import { convert, isApproximate, oldestFetchedAt } from '@/utils/fx';
import { useFxRates } from '@/hooks/useFxRates';
import { useT } from '@/hooks/useT';

export default function AccountsScreen() {
  const t = useT();
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.top}>
        <Text style={styles.title}>{t('me.title')}</Text>
        <HeaderSettingsButton />
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <OverviewAndAccounts />
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function OverviewAndAccounts() {
  const t = useT();
  const allAccounts = useAccounts({ includeArchived: true });
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  // Subscribe to FX bumps so balances re-convert when the cache updates.
  const fx = useFxRates();
  // Show-archived toggle lives at the bottom of the list. Off by default
  // so the active set is uncluttered.
  const [showArchived, setShowArchived] = useState(false);
  useEffect(() => {
    const hasMulti = allAccounts.some((a) => a.currency && a.currency !== currency);
    if (hasMulti && oldestFetchedAt() === 0 && !fx.refreshing) {
      void fx.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAccounts.length]);

  // Split active vs archived. Both totals + list visibility care.
  const active = allAccounts.filter((a) => a.archived !== 1);
  const archivedAccounts = allAccounts.filter((a) => a.archived === 1);
  // Totals exclude archived AND any account flagged include_in_total=0.
  const counted = active.filter((a) => a.includeInTotal !== 0);

  // Mixed-currency totals: convert each account into the user's display
  // currency before summing. When a leg is uncached we still sum, but
  // mark the total as approximate.
  let approxFlag = false;
  const accountCurrency = (a: Account) =>
    (a.currency as string | null | undefined) ?? currency;
  const assets = counted
    .filter((a) => a.balance >= 0)
    .reduce((s, a) => {
      const ac = accountCurrency(a);
      if (isApproximate(ac, currency)) approxFlag = true;
      return s + convert(a.balance, ac, currency);
    }, 0);
  const debt = counted
    .filter((a) => a.balance < 0)
    .reduce((s, a) => {
      const ac = accountCurrency(a);
      if (isApproximate(ac, currency)) approxFlag = true;
      return s + Math.abs(convert(a.balance, ac, currency));
    }, 0);
  const net = assets - debt;
  const approx = approxFlag;

  // null = creating new; Account = editing; undefined = sheet closed
  const [editing, setEditing] = useState<Account | null | undefined>(undefined);
  const visibleAccounts = showArchived ? allAccounts : active;

  return (
    <View style={{ gap: spacing.lg }}>
      {/* OVERVIEW — single hero card: big Net, Assets+Debt split below. */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader title={t('me.section.overview')} />
        <View style={styles.overviewCard}>
          <Text style={styles.netLabel}>{t('me.netBalance')}</Text>
          <Text
            style={[styles.netValue, { color: net >= 0 ? theme.accent : theme.expense }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.6}
          >
            {approx ? '≈ ' : ''}{formatMoney(net, currency)}
          </Text>
          <View style={[sectionStyles.summaryRow, { marginTop: spacing.md }]}>
            <SummaryCard label={t('me.assets')} value={assets} color={theme.accent} currency={currency} />
            <SummaryCard label={t('me.debt')} value={debt} color={theme.expense} currency={currency} />
          </View>
        </View>
      </View>

      {/* ACCOUNTS — list with + Add header. */}
      <View style={{ gap: spacing.md }}>
        <SectionHeader
          title={t('me.section.accounts')}
          onAdd={() => setEditing(null)}
          addLabel={t('common.add')}
        />

        {visibleAccounts.map((a) => {
          const ac = accountCurrency(a) as CurrencyCode;
          // Credit utilization: balance is stored negative for credit
          // accounts (debt = -spent). The bar shows how much of the
          // limit is consumed; thresholds escalate by color.
          const utilPct =
            a.type === 'credit' && a.creditLimit && a.creditLimit > 0
              ? Math.min(Math.abs(a.balance) / a.creditLimit, 1)
              : null;
          const utilColor =
            utilPct == null
              ? theme.text3
              : utilPct < 0.3
                ? theme.accent
                : utilPct < 0.7
                  ? '#EAB308'
                  : utilPct < 0.9
                    ? '#F97316'
                    : theme.expense;
          const isExcluded = a.includeInTotal === 0;
          const isArchived = a.archived === 1;
          return (
            <Pressable
              key={a.id}
              style={[
                styles.acctCard,
                (isExcluded || isArchived) && styles.acctCardDimmed,
              ]}
              onPress={() => setEditing(a)}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${a.name}, ${formatMoney(a.balance, ac)}${isArchived ? ', archived' : isExcluded ? ', excluded from total' : ''}`}
            >
              <View style={[styles.iconBox, { backgroundColor: `${a.color}22` }]}>
                <MaterialCommunityIcons name="wallet-outline" size={20} color={a.color} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.acctNameRow}>
                  <Text style={styles.acctName}>{a.name}</Text>
                  {isArchived && <Text style={styles.acctTag}>archived</Text>}
                  {!isArchived && isExcluded && <Text style={styles.acctTag}>excluded</Text>}
                </View>
                <Text style={styles.acctType}>
                  {a.type}{ac !== currency ? ` · ${ac}` : ''}
                </Text>
                {utilPct != null && (
                  <>
                    <View style={[styles.barBg, { marginTop: 6 }]}>
                      <View
                        style={[
                          styles.barFill,
                          { width: `${utilPct * 100}%`, backgroundColor: utilColor },
                        ]}
                      />
                    </View>
                    <Text style={[styles.acctUtil, { color: utilColor }]}>
                      {Math.round(utilPct * 100)}% used
                    </Text>
                  </>
                )}
              </View>
              <Text style={[styles.acctBal, { color: a.balance >= 0 ? theme.accent : theme.expense }]}>
                {formatMoney(a.balance, ac)}
              </Text>
            </Pressable>
          );
        })}

        {archivedAccounts.length > 0 && (
          <Pressable
            onPress={() => setShowArchived((v) => !v)}
            style={styles.archiveToggle}
            accessibilityRole="button"
            accessibilityLabel={showArchived ? 'Hide archived accounts' : `Show ${archivedAccounts.length} archived accounts`}
          >
            <MaterialCommunityIcons
              name={showArchived ? 'eye-off-outline' : 'archive-outline'}
              size={16}
              color={theme.text3}
            />
            <Text style={styles.archiveToggleText}>
              {showArchived ? 'Hide archived' : `Show archived (${archivedAccounts.length})`}
            </Text>
          </Pressable>
        )}

        {process.env.APP_FLAVOR === 'islamic' && allAccounts.some((a) => a.isRiba === 1) && (
          <View style={styles.ribaFooter}>
            <MaterialCommunityIcons name="alert-circle-outline" size={16} color={theme.warning} />
            <Text style={styles.ribaFooterText}>
              One or more accounts are flagged as earning interest. Consult a scholar
              for the right zakat treatment.
            </Text>
          </View>
        )}
      </View>

      <AccountSheet
        visible={editing !== undefined}
        account={editing ?? undefined}
        onClose={() => setEditing(undefined)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  title: { color: theme.text1, fontSize: sizes.xxxl, fontFamily: font.displayBold },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  overviewCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  netLabel: { color: theme.text2, fontSize: sizes.sm },
  netValue: { fontSize: sizes.xxl, fontFamily: font.displayBold, marginTop: 4 },
  acctCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acctCardDimmed: { opacity: 0.55 },
  acctNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  acctName: { color: theme.text1, fontSize: sizes.md },
  acctTag: {
    color: theme.text3,
    fontSize: 10,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: theme.bg3,
    overflow: 'hidden',
  },
  acctType: { color: theme.text3, fontSize: sizes.xs, textTransform: 'capitalize' },
  acctBal: { fontSize: sizes.lg, fontFamily: font.display, fontWeight: '700' },
  acctUtil: { fontSize: sizes.xs, marginTop: 4, fontFamily: font.bodySemi },
  barBg: { height: 6, backgroundColor: theme.bg3, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  archiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: spacing.md,
  },
  archiveToggleText: { color: theme.text3, fontSize: sizes.sm },
  ribaFooter: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: spacing.md,
    backgroundColor: `${theme.warning}11`,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: `${theme.warning}55`,
  },
  ribaFooterText: { flex: 1, color: theme.warning, fontSize: sizes.xs, lineHeight: 16 },
});
