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
  const accounts = useAccounts();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  // Subscribe to FX bumps so balances re-convert when the cache updates.
  const fx = useFxRates();
  useEffect(() => {
    const hasMulti = accounts.some((a) => a.currency && a.currency !== currency);
    if (hasMulti && oldestFetchedAt() === 0 && !fx.refreshing) {
      void fx.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts.length]);

  // Mixed-currency totals: convert each account into the user's display
  // currency before summing. When a leg is uncached we still sum, but
  // mark the total as approximate.
  let approxFlag = false;
  const accountCurrency = (a: Account) =>
    (a.currency as string | null | undefined) ?? currency;
  const assets = accounts
    .filter((a) => a.balance >= 0)
    .reduce((s, a) => {
      const ac = accountCurrency(a);
      if (isApproximate(ac, currency)) approxFlag = true;
      return s + convert(a.balance, ac, currency);
    }, 0);
  const debt = accounts
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

        {accounts.map((a) => {
          const ac = accountCurrency(a) as CurrencyCode;
          return (
            <Pressable
              key={a.id}
              style={styles.acctCard}
              onPress={() => setEditing(a)}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${a.name}, ${formatMoney(a.balance, ac)}`}
            >
              <View style={[styles.iconBox, { backgroundColor: `${a.color}22` }]}>
                <MaterialCommunityIcons name="wallet-outline" size={20} color={a.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.acctName}>{a.name}</Text>
                <Text style={styles.acctType}>
                  {a.type}{ac !== currency ? ` · ${ac}` : ''}
                </Text>
                {a.creditLimit && (
                  <View style={[styles.barBg, { marginTop: 6 }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          width: `${Math.min(Math.abs(a.balance) / a.creditLimit, 1) * 100}%`,
                          backgroundColor: theme.expense,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>
              <Text style={[styles.acctBal, { color: a.balance >= 0 ? theme.accent : theme.expense }]}>
                {formatMoney(a.balance, ac)}
              </Text>
            </Pressable>
          );
        })}

        {process.env.APP_FLAVOR === 'islamic' && accounts.some((a) => a.isRiba === 1) && (
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
  acctName: { color: theme.text1, fontSize: sizes.md },
  acctType: { color: theme.text3, fontSize: sizes.xs, textTransform: 'capitalize' },
  acctBal: { fontSize: sizes.lg, fontFamily: font.display, fontWeight: '700' },
  barBg: { height: 6, backgroundColor: theme.bg3, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
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
