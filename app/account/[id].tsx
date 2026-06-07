// Account detail screen — reached by tapping an account in Me → Accounts.
//
// Layout (top → bottom):
//   - Header: back chevron · account name · ⋯ menu
//   - Balance + type
//   - Compact 6-month balance line chart (computed from txns)
//   - "Transactions" section header + "+ Add" button
//   - Infinite-paginated transaction list for this account

import React, { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { CartesianChart, Line, Area } from 'victory-native';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { useT } from '@/hooks/useT';
import { kv } from '@/utils/kv';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import {
  useAccounts,
  useTransactions,
  deleteAccountCascade,
  upsertAccount,
} from '@/hooks/useAppData';
import { useAccountBalanceHistory } from '@/hooks/useAccountBalanceHistory';
import { TransactionRow } from '@/components/TransactionRow';
import { AccountSheet } from '@/components/AccountSheet';
import { Icon } from '@/components/Icon';
import { buildEditPrefill, buildPrefill } from '@/utils/prefill';

const PAGE = 50;

export default function AccountDetail() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const accounts = useAccounts({ includeArchived: true });
  const account = useMemo(() => accounts.find((a) => a.id === id), [accounts, id]);

  const [limit, setLimit] = useState(PAGE);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  type Period = 3 | 6 | 12 | 96;
  const [period, setPeriod] = useState<Period>(6);

  const txns = useTransactions({ accountId: id, limit });
  const reachedLimit = txns.length >= limit;
  // Earliest tx date for this account = practical "since" proxy. The
  // accounts table doesn't carry a createdAt column, so we infer from
  // the oldest activity. Null when there are no transactions yet.
  const earliestDate = useMemo(() => {
    if (txns.length === 0) return null;
    const min = txns.reduce((m, t) => (t.date < m ? t.date : m), txns[0].date);
    return new Date(min);
  }, [txns]);
  const ac = (account?.currency as CurrencyCode | null | undefined)
    ?? ((kv.get('currency') ?? 'USD') as CurrencyCode);

  const history = useAccountBalanceHistory(id, period);
  const series = useMemo(
    () => history.map((p, i) => ({ i, bal: p.balance })),
    [history],
  );
  // Map the selected period → subtitle key. Was naively using
  // `history.length` which produced wrong "за последние N мес." text
  // whenever the data started later than the window.
  const periodKey: '3m' | '6m' | '1y' | 'all' =
    period === 3 ? '3m' : period === 6 ? '6m' : period === 12 ? '1y' : 'all';
  const subtitle = useMemo(() => {
    if (history.length < 2) return null;
    const first = history[0].balance;
    const last = history[history.length - 1].balance;
    const diff = last - first;
    const up = diff >= 0;
    return {
      up,
      text:
        (up ? '+' : '−') +
        formatMoney(Math.abs(diff), ac) +
        ' ' +
        t(`account.chart.subtitle.${periodKey}`),
    };
  }, [history, ac, t, periodKey]);

  if (!account) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={theme.text2} />
          </Pressable>
          <View />
          <View />
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t('account.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const archive = () => {
    upsertAccount({ ...account, archived: account.archived === 1 ? 0 : 1 });
    setMenuOpen(false);
  };

  const adjust = () => {
    setMenuOpen(false);
    setEditOpen(true);
  };

  const onDelete = () => {
    setMenuOpen(false);
    Alert.alert(
      t('account.deleteAccount'),
      t('account.delete.body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            deleteAccountCascade(account.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Fixed header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.back')}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={theme.text1} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{account.name}</Text>
        <Pressable
          onPress={() => setMenuOpen(true)}
          hitSlop={10}
          accessibilityLabel={t('common.menu')}
        >
          <MaterialCommunityIcons name="dots-horizontal" size={22} color={theme.text2} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Balance + type */}
        <View style={styles.balanceWrap}>
          <View style={styles.iconChip}>
            <Icon name={account.icon} size={28} color={account.color} />
          </View>
          <Text
            style={[styles.balance, { color: account.balance >= 0 ? theme.text1 : theme.expense }]}
            adjustsFontSizeToFit
            numberOfLines={1}
          >
            {formatMoney(account.balance, ac)}
          </Text>
          <Text style={styles.type}>
            {t(`account.type.${account.type}`)}
            {earliestDate && (
              <Text style={styles.typeSince}>
                {'  ·  '}
                {t('account.since', { date: earliestDate.toLocaleDateString() })}
              </Text>
            )}
          </Text>
        </View>

        {/* Balance chart with period selector + subtitle. Whole block
            is a tap target — opens the full-screen expanded view. */}
        {series.length >= 2 && (
          <Pressable
            style={styles.chartCard}
            onPress={() =>
              router.push({ pathname: '/account-balance', params: { id } } as never)
            }
            accessibilityRole="button"
            accessibilityLabel={t('account.chart.title')}
          >
            <View style={styles.chartHead}>
              <Text style={styles.sectionLabel}>{t('account.chart.title')}</Text>
              <View style={styles.periodRow}>
                {(['3m', '6m', '1y', 'all'] as const).map((k, i) => {
                  const v: Period = [3, 6, 12, 96][i] as Period;
                  const active = v === period;
                  return (
                    <Pressable
                      key={k}
                      onPress={(e) => {
                        e.stopPropagation?.();
                        setPeriod(v);
                      }}
                      style={[styles.periodBtn, active && styles.periodBtnActive]}
                      hitSlop={4}
                    >
                      <Text style={[styles.periodText, active && styles.periodTextActive]}>
                        {t(`netWorth.period.${k}`)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            {subtitle && (
              <Text
                style={[
                  styles.chartSubtitle,
                  { color: subtitle.up ? theme.accent : theme.expense },
                ]}
              >
                {subtitle.text}
              </Text>
            )}
            <View style={styles.chartWrap}>
              <CartesianChart
                data={series}
                xKey="i"
                yKeys={['bal']}
                domainPadding={{ top: 12, bottom: 12 }}
              >
                {({ points: cp, chartBounds }) => (
                  <>
                    <Area
                      points={cp.bal}
                      y0={chartBounds.bottom}
                      color={`${account.color}33`}
                      animate={{ type: 'timing', duration: 300 }}
                    />
                    <Line
                      points={cp.bal}
                      color={account.color}
                      strokeWidth={2}
                      animate={{ type: 'timing', duration: 300 }}
                    />
                  </>
                )}
              </CartesianChart>
            </View>
          </Pressable>
        )}

        {/* Transactions header + Add */}
        <View style={styles.txHead}>
          <Text style={styles.sectionLabel}>{t('account.transactions')}</Text>
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/add',
                params: { prefill: buildPrefill({ accountId: account.id }) },
              } as never)
            }
            hitSlop={6}
            style={styles.addRow}
          >
            <MaterialCommunityIcons name="plus" size={14} color={theme.text2} />
            <Text style={styles.addText}>{t('common.add')}</Text>
          </Pressable>
        </View>

        {txns.length === 0 ? (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="inbox-outline" size={36} color={theme.text3} />
            <Text style={styles.emptyText}>{t('account.empty')}</Text>
          </View>
        ) : (
          <View style={{ gap: 2 }}>
            {txns.map((tx) => (
              <TransactionRow
                key={tx.id}
                t={tx}
                currency={ac}
                onPressMore={() =>
                  router.push({
                    pathname: '/add',
                    params: { prefill: buildEditPrefill(tx) },
                  } as never)
                }
              />
            ))}
            {reachedLimit && (
              <Pressable
                onPress={() => setLimit((n) => n + PAGE)}
                style={({ pressed }) => [styles.loadMore, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.loadMoreText}>{t('activity.loadMore')}</Text>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>

      {/* ⋯ action sheet */}
      {menuOpen && (
        <>
          <Pressable style={styles.backdrop} onPress={() => setMenuOpen(false)} />
          <SafeAreaView style={styles.sheet} edges={['bottom']}>
            <Pressable style={styles.sheetItem} onPress={() => { setMenuOpen(false); setEditOpen(true); }}>
              <MaterialCommunityIcons name="pencil-outline" size={18} color={theme.text1} />
              <Text style={styles.sheetText}>{t('common.edit')}</Text>
            </Pressable>
            <Pressable style={styles.sheetItem} onPress={adjust}>
              <MaterialCommunityIcons name="scale-balance" size={18} color={theme.text1} />
              <Text style={styles.sheetText}>{t('account.adjustBalance')}</Text>
            </Pressable>
            <Pressable style={styles.sheetItem} onPress={archive}>
              <MaterialCommunityIcons
                name={account.archived === 1 ? 'archive-arrow-up-outline' : 'archive-outline'}
                size={18}
                color={theme.text1}
              />
              <Text style={styles.sheetText}>
                {t(account.archived === 1 ? 'account.unarchive' : 'account.archive')}
              </Text>
            </Pressable>
            <Pressable style={styles.sheetItem} onPress={onDelete}>
              <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.expense} />
              <Text style={[styles.sheetText, { color: theme.expense }]}>{t('common.delete')}</Text>
            </Pressable>
          </SafeAreaView>
        </>
      )}

      <AccountSheet
        visible={editOpen}
        account={account}
        onClose={() => setEditOpen(false)}
      />
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
  title: { color: theme.text1, fontSize: sizes.xl, fontFamily: font.displayBold, flex: 1, textAlign: 'center', marginHorizontal: spacing.md },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  balanceWrap: { alignItems: 'center', gap: 4 },
  iconChip: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: theme.bg2, borderWidth: 1, borderColor: theme.border,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.sm,
  },
  balance: { color: theme.text1, fontSize: 36, fontFamily: font.displayBold },
  type: { color: theme.text3, fontSize: sizes.sm },
  typeSince: { color: theme.text3, fontSize: sizes.sm },
  chartWrap: { height: 120 },
  chartCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    gap: spacing.sm,
  },
  chartHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartSubtitle: { fontSize: sizes.sm, fontFamily: font.bodySemi },
  periodRow: {
    flexDirection: 'row',
    backgroundColor: theme.bg3,
    borderRadius: radii.pill,
    padding: 2,
    gap: 2,
  },
  periodBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radii.pill },
  periodBtnActive: { backgroundColor: theme.accent },
  periodText: { color: theme.text2, fontSize: 11, fontFamily: font.bodySemi },
  periodTextActive: { color: theme.bg },
  txHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { color: theme.text2, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 1 },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  addText: {
    color: theme.text2,
    fontSize: sizes.sm,
    fontFamily: font.body,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  empty: { padding: spacing.xl, alignItems: 'center', gap: spacing.md, borderRadius: radii.lg, backgroundColor: theme.bg2, borderWidth: 1, borderColor: theme.border },
  emptyText: { color: theme.text3, fontSize: sizes.sm, textAlign: 'center' },
  loadMore: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  loadMoreText: { color: theme.accent, fontSize: sizes.sm, fontFamily: font.bodySemi },
  backdrop: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: theme.bg1,
    borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg,
    padding: spacing.sm,
  },
  sheetItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  sheetText: { color: theme.text1, fontSize: sizes.md, fontFamily: font.body },
});
