// Accounts tab — net-worth overview + accounts grouped by role.
//
// Layout (one NestableScrollContainer):
//   Overview   MeNetWorthCard, foreign-currency note, Assets / Debts
//              tiles (tap = filter the list to that side).
//   Groups     Spending (cash, bank) · Saving (savings, investment) ·
//              Owed (credit, loan). Each group = header with subtotal
//              in the display currency + a NestableDraggableFlatList so
//              reordering stays inside the group.
//   Footer     show-archived toggle, riba footer (islamic), tab spacer.
//
// Account card: icon · name + tags · type line · balance (native
// currency, ≈ display currency beneath when foreign) · 30-day sparkline
// + this-month delta · credit "available of limit" + bar + next due
// day · visible drag handle (press-and-hold to reorder) · swipe left →
// Transfer from / Adjust balance.
//
// Settings (profiles, language, currency, security, data, about) live in
// the /settings modal behind the cog on every tab.

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  NestableScrollContainer,
  NestableDraggableFlatList,
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { useOncePress } from '@/hooks/useOncePress';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { SectionHeader } from '@/components/Sections';
import { AccountSheet } from '@/components/AccountSheet';
import { Icon } from '@/components/Icon';
import { Sparkline } from '@/components/Sparkline';
import { MeNetWorthCard } from '@/components/MeNetWorthCard';
import { HeaderSettingsButton } from '@/components/HeaderSettingsButton';
import { useAccounts, useRecurring, useTransactions, reorderAccounts } from '@/hooks/useAppData';
import { balanceAt, balanceSeriesDaily } from '@/hooks/useAccountBalanceHistory';
import type { Account } from '@/utils/db/schema';
import { type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';
import { formatMoney } from '@/utils/format';
import { convert, isApproximate, oldestFetchedAt } from '@/utils/fx';
import { useFxRates } from '@/hooks/useFxRates';
import { useT } from '@/hooks/useT';
import { encodePrefill } from '@/utils/prefill';

type GroupKey = 'spending' | 'saving' | 'owed';
const GROUP_OF: Record<string, GroupKey> = {
  cash: 'spending',
  bank: 'spending',
  savings: 'saving',
  investment: 'saving',
  credit: 'owed',
  debt: 'owed',
  receivable: 'owed',
};
const GROUP_ORDER: GroupKey[] = ['spending', 'saving', 'owed'];
type Filter = 'all' | 'assets' | 'debts';
const SPARK_DAYS = 30;

export default function AccountsScreen() {
  const t = useT();
  // The net-worth chart card can be collapsed from the header chart
  // button (Assets / Debts tiles always stay); persists per profile.
  const [overviewHidden, setOverviewHidden] = useState(() =>
    kv.getBool('accountsOverviewHidden', false),
  );
  const toggleOverview = () => {
    setOverviewHidden((v) => {
      kv.setBool('accountsOverviewHidden', !v);
      return !v;
    });
  };
  // Deep link / handoff: flow://accounts?face=flow
  const params = useLocalSearchParams<{ face?: string }>();
  const face = params.face === 'flow' || params.face === 'net' ? params.face : undefined;
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.top}>
        <Text style={styles.title}>{t('me.title')}</Text>
        <View style={styles.headerBtns}>
          <Pressable
            onPress={toggleOverview}
            style={({ pressed }) => [
              styles.headerBtn,
              !overviewHidden && styles.headerBtnActive,
              pressed && { opacity: 0.6 },
            ]}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityState={{ selected: !overviewHidden }}
            accessibilityLabel={t(overviewHidden ? 'accounts.a11y.showOverview' : 'accounts.a11y.hideOverview')}
          >
            <MaterialCommunityIcons
              name="chart-line"
              size={20}
              color={overviewHidden ? theme.text2 : theme.accent}
            />
          </Pressable>
          <HeaderSettingsButton />
        </View>
      </View>
      <OverviewAndAccounts overviewHidden={overviewHidden} face={face} />
    </SafeAreaView>
  );
}

interface AccountStats {
  series: number[];
  delta: number;
}

function OverviewAndAccounts({ overviewHidden, face }: { overviewHidden: boolean; face?: 'net' | 'flow' }) {
  const t = useT();
  const router = useRouter();
  // Debounced row open — a quick double-tap must not push two detail
  // modals onto the stack.
  const openAccount = useOncePress((id: string) =>
    router.push(`/account/${id}` as never),
  );
  const allAccounts = useAccounts({ includeArchived: true });
  const txns = useTransactions({ limit: 5000 });
  const recurring = useRecurring();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  // Subscribe to FX bumps so balances re-convert when the cache updates.
  const fx = useFxRates();
  const [showArchived, setShowArchived] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => {
    const hasMulti = allAccounts.some((a) => a.currency && a.currency !== currency);
    if (hasMulti && oldestFetchedAt() === 0 && !fx.refreshing) {
      void fx.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allAccounts.length]);

  const active = allAccounts.filter((a) => a.archived !== 1);
  const archivedAccounts = allAccounts.filter((a) => a.archived === 1);
  // Totals exclude archived AND any account flagged include_in_total=0.
  const counted = active.filter((a) => a.includeInTotal !== 0);
  const accountCurrency = (a: Account): CurrencyCode =>
    ((a.currency as string | null | undefined) ?? currency) as CurrencyCode;
  const toDisplay = (a: Account) => convert(a.balance, accountCurrency(a), currency);

  let approx = false;
  const assets = counted
    .filter((a) => a.balance >= 0)
    .reduce((s, a) => {
      if (isApproximate(accountCurrency(a), currency)) approx = true;
      return s + toDisplay(a);
    }, 0);
  const debt = counted
    .filter((a) => a.balance < 0)
    .reduce((s, a) => {
      if (isApproximate(accountCurrency(a), currency)) approx = true;
      return s + Math.abs(toDisplay(a));
    }, 0);
  const foreignCount = counted.filter((a) => accountCurrency(a) !== currency).length;
  // Money owed TO the user (receivable accounts). Already inside
  // `assets`; surfaced as a sub-line so net worth stays honest.
  const owedToMe = counted
    .filter((a) => a.type === 'receivable' && a.balance > 0)
    .reduce((s, a) => s + toDisplay(a), 0);

  // 30-day balance series + this-month delta per account, one pass
  // over the transaction list (not one DB query per row).
  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const m = new Map<string, AccountStats>();
    allAccounts.forEach((a) => {
      const mine = txns.filter((x) => x.accountId === a.id || x.toAccountId === a.id);
      m.set(a.id, {
        series: balanceSeriesDaily(a, mine, SPARK_DAYS),
        delta: a.balance - balanceAt(a, mine, monthStart - 1),
      });
    });
    return m;
  }, [allAccounts, txns]);

  // Next bill day for credit cards: earliest recurring expense on this
  // account still ahead this month, else the earliest next month.
  const dueDayFor = (id: string): number | null => {
    const days = recurring
      .filter((r) => r.type === 'expense' && r.accountId === id)
      .map((r) => r.dayOfMonth);
    if (days.length === 0) return null;
    const today = new Date().getDate();
    const ahead = days.filter((d) => d >= today);
    return ahead.length ? Math.min(...ahead) : Math.min(...days);
  };

  // null = creating new; Account = editing; undefined = sheet closed
  const [editing, setEditing] = useState<Account | null | undefined>(undefined);

  const visible = (showArchived ? allAccounts : active).filter((a) =>
    filter === 'all' ? true : filter === 'assets' ? a.balance >= 0 : a.balance < 0,
  );
  const groups = useMemo(
    () =>
      GROUP_ORDER.map((key) => {
        const items = visible
          .filter((a) => (GROUP_OF[a.type] ?? 'spending') === key)
          .sort((a, b) => a.sortOrder - b.sortOrder);
        const countedItems = items.filter((a) => a.archived !== 1 && a.includeInTotal !== 0);
        const subtotal = countedItems.reduce((s, a) => s + toDisplay(a), 0);
        // Owed group splits both ways: what I owe (negative balances)
        // vs what is owed to me (receivable accounts).
        const owedBy = countedItems
          .filter((a) => a.balance < 0)
          .reduce((s, a) => s + Math.abs(toDisplay(a)), 0);
        const owedTo = countedItems
          .filter((a) => a.type === 'receivable' && a.balance > 0)
          .reduce((s, a) => s + toDisplay(a), 0);
        return { key, items, subtotal, owedBy, owedTo };
      }).filter((g) => g.items.length > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visible, currency],
  );

  const startTransfer = (a: Account) =>
    router.push({
      pathname: '/add',
      params: { prefill: encodePrefill({ type: 'transfer', accountId: a.id }) },
    } as never);

  const renderRow = ({ item: a, drag, isActive }: RenderItemParams<Account>) => (
    <ScaleDecorator activeScale={1.02}>
      <AccountCard
        account={a}
        accountCcy={accountCurrency(a)}
        displayCcy={currency}
        stats={stats.get(a.id)}
        dueDay={a.type === 'credit' ? dueDayFor(a.id) : null}
        drag={drag}
        isActive={isActive}
        onOpen={() => openAccount(a.id)}
        onTransfer={() => startTransfer(a)}
        onAdjust={() => setEditing(a)}
      />
    </ScaleDecorator>
  );

  return (
    <>
      <NestableScrollContainer
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {!overviewHidden && (
          <>
        <SectionHeader title={t('me.section.overview')} />
        <MeNetWorthCard initialFace={face} />
        {foreignCount > 0 && (
          <Text style={styles.foreignNote}>
            {t('accounts.foreignNote', { n: foreignCount })}
            {approx ? ' · ≈' : ''}
          </Text>
        )}
          </>
        )}
        <View style={styles.tiles}>
          <SideTile
            label={t('netWorth.assets')}
            value={formatMoney(assets, currency)}
            sub={owedToMe > 0 ? t('accounts.tile.owedToYou', { amount: formatMoney(owedToMe, currency) }) : undefined}
            color={theme.accent}
            selected={filter === 'assets'}
            onPress={() => setFilter((f) => (f === 'assets' ? 'all' : 'assets'))}
          />
          <SideTile
            label={t('netWorth.debts')}
            value={formatMoney(debt, currency)}
            color={debt > 0 ? theme.expense : theme.text2}
            selected={filter === 'debts'}
            onPress={() => setFilter((f) => (f === 'debts' ? 'all' : 'debts'))}
          />
        </View>

        <SectionHeader
          title={t('me.section.accounts')}
          onAdd={() => setEditing(null)}
          addLabel={t('common.add')}
        />
        {groups.length === 0 && (
          <Text style={styles.emptyText}>{t('accounts.emptyFilter')}</Text>
        )}
        {groups.map((g) => (
          <View key={g.key} style={styles.group}>
            <View style={styles.groupHead}>
              <Text style={styles.groupTitle}>{t(`accounts.group.${g.key}`)}</Text>
              {g.key === 'owed' ? (
                <View style={styles.owedSplit}>
                  <Text style={styles.groupTotal}>
                    <Text style={styles.owedLabel}>{t('accounts.group.owedBy')} </Text>
                    <Text style={{ color: g.owedBy > 0 ? theme.expense : theme.text2 }}>
                      {formatMoney(g.owedBy, currency)}
                    </Text>
                  </Text>
                  <Text style={styles.groupTotal}>
                    <Text style={styles.owedLabel}>{t('accounts.group.owedTo')} </Text>
                    <Text style={{ color: g.owedTo > 0 ? theme.accent : theme.text2 }}>
                      {formatMoney(g.owedTo, currency)}
                    </Text>
                  </Text>
                </View>
              ) : (
                <Text style={styles.groupTotal}>{formatMoney(g.subtotal, currency)}</Text>
              )}
            </View>
            <NestableDraggableFlatList
              data={g.items}
              keyExtractor={(a) => a.id}
              activationDistance={20}
              onDragEnd={({ data }) => reorderAccounts(data.map((a) => a.id))}
              renderItem={renderRow}
              ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
            />
          </View>
        ))}

        {archivedAccounts.length > 0 && (
          <Pressable
            onPress={() => setShowArchived((v) => !v)}
            style={styles.archiveToggle}
            accessibilityRole="button"
            accessibilityLabel={
              showArchived
                ? t('categories.hideArchived')
                : t('categories.showArchived', { n: archivedAccounts.length })
            }
          >
            <MaterialCommunityIcons
              name={showArchived ? 'eye-off-outline' : 'archive-outline'}
              size={16}
              color={theme.text3}
            />
            <Text style={styles.archiveToggleText}>
              {showArchived
                ? t('categories.hideArchived')
                : t('categories.showArchived', { n: archivedAccounts.length })}
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
        <View style={{ height: 100 }} />
      </NestableScrollContainer>

      <AccountSheet
        visible={editing !== undefined}
        account={editing ?? undefined}
        onClose={() => setEditing(undefined)}
      />
    </>
  );
}

function SideTile({
  label,
  value,
  sub,
  color,
  selected,
  onPress,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tile, selected && { borderColor: color }]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${label} ${value}`}
    >
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, { color }]} adjustsFontSizeToFit numberOfLines={1}>
        {value}
      </Text>
      {sub && <Text style={styles.tileSub} numberOfLines={1}>{sub}</Text>}
    </Pressable>
  );
}

function AccountCard({
  account: a,
  accountCcy,
  displayCcy,
  stats,
  dueDay,
  drag,
  isActive,
  onOpen,
  onTransfer,
  onAdjust,
}: {
  account: Account;
  accountCcy: CurrencyCode;
  displayCcy: CurrencyCode;
  stats: AccountStats | undefined;
  dueDay: number | null;
  drag: () => void;
  isActive: boolean;
  onOpen: () => void;
  onTransfer: () => void;
  onAdjust: () => void;
}) {
  const t = useT();
  const swipeRef = useRef<Swipeable>(null);
  const isExcluded = a.includeInTotal === 0;
  const isArchived = a.archived === 1;
  const foreign = accountCcy !== displayCcy;
  const delta = stats?.delta ?? 0;
  const deltaColor = delta > 0 ? theme.accent : delta < 0 ? theme.expense : theme.text3;
  const deltaText =
    delta === 0
      ? t('accounts.noChange')
      : `${delta > 0 ? '+' : '−'}${formatMoney(Math.abs(delta), accountCcy)} ${t('accounts.thisMonth')}`;
  const balColor = a.balance > 0 ? theme.accent : a.balance < 0 ? theme.expense : theme.text1;

  // Credit: what's left to spend matters more than % used.
  const limit = a.type === 'credit' && a.creditLimit && a.creditLimit > 0 ? a.creditLimit : null;
  const used = limit ? Math.min(Math.abs(a.balance), limit) : 0;
  const utilPct = limit ? used / limit : null;
  const utilColor =
    utilPct == null ? theme.text3
      : utilPct < 0.3 ? theme.accent
        : utilPct < 0.7 ? '#EAB308'
          : utilPct < 0.9 ? '#F97316'
            : theme.expense;

  const closeThen = (fn: () => void) => () => {
    swipeRef.current?.close();
    fn();
  };
  const renderActions = () => (
    <View style={styles.swipeActions}>
      <Pressable
        style={[styles.swipeBtn, { backgroundColor: theme.transfer }]}
        onPress={closeThen(onTransfer)}
        accessibilityRole="button"
        accessibilityLabel={t('accounts.swipe.transfer')}
      >
        <MaterialCommunityIcons name="swap-horizontal" size={20} color="#FFFFFF" />
        <Text style={styles.swipeText}>{t('accounts.swipe.transfer')}</Text>
      </Pressable>
      <Pressable
        style={[styles.swipeBtn, { backgroundColor: theme.indigo }]}
        onPress={closeThen(onAdjust)}
        accessibilityRole="button"
        accessibilityLabel={t('accounts.swipe.adjust')}
      >
        <MaterialCommunityIcons name="scale-balance" size={20} color="#FFFFFF" />
        <Text style={styles.swipeText}>{t('accounts.swipe.adjust')}</Text>
      </Pressable>
    </View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={renderActions}
      overshootRight={false}
      friction={2}
      rightThreshold={40}
      enabled={!isActive}
    >
      <Pressable
        style={[
          styles.acctCard,
          (isExcluded || isArchived) && styles.acctCardDimmed,
          isActive && { borderColor: theme.accent },
        ]}
        onPress={onOpen}
        onLongPress={drag}
        delayLongPress={300}
        accessibilityRole="button"
        accessibilityLabel={t('accounts.a11y.open', { name: a.name, balance: formatMoney(a.balance, accountCcy) })}
      >
        <View style={styles.cardTop}>
          <View style={[styles.iconBox, { backgroundColor: `${a.color}22` }]}>
            <Icon name={a.icon} size={20} color={a.color} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.acctNameRow}>
              <Text style={styles.acctName} numberOfLines={1}>{a.name}</Text>
              {isArchived && <Text style={styles.acctTag}>{t('categories.archived')}</Text>}
              {!isArchived && isExcluded && <Text style={styles.acctTag}>{t('account.excluded')}</Text>}
            </View>
            <Text style={styles.acctType}>
              {t(`accountType.${a.type}`)}{foreign ? ` · ${accountCcy}` : ''}
            </Text>
          </View>
          <View style={styles.balCol}>
            <Text style={[styles.acctBal, { color: balColor }]} adjustsFontSizeToFit numberOfLines={1}>
              {formatMoney(a.balance, accountCcy)}
            </Text>
            {foreign && (
              <Text style={styles.balApprox} numberOfLines={1}>
                ≈ {formatMoney(convert(a.balance, accountCcy, displayCcy), displayCcy)}
              </Text>
            )}
          </View>
          <Pressable
            onPressIn={drag}
            disabled={isActive}
            hitSlop={8}
            style={styles.handle}
            accessibilityRole="button"
            accessibilityLabel={t('accounts.a11y.reorder')}
          >
            <MaterialCommunityIcons name="drag-vertical" size={20} color={theme.text3} />
          </Pressable>
        </View>

        <View style={styles.cardBottom}>
          <Sparkline values={stats?.series ?? []} width={88} height={22} color={deltaColor} />
          <Text style={[styles.delta, { color: deltaColor }]} numberOfLines={1}>
            {deltaText}
          </Text>
        </View>

        {limit != null && (
          <View style={styles.creditBlock}>
            <View style={styles.barBg}>
              <View
                style={[
                  styles.barFill,
                  { width: `${(utilPct ?? 0) * 100}%`, backgroundColor: utilColor },
                ]}
              />
            </View>
            <View style={styles.creditRow}>
              <Text style={[styles.creditText, { color: utilColor }]} numberOfLines={1}>
                {t('accounts.available', {
                  available: formatMoney(Math.max(limit - used, 0), accountCcy),
                  limit: formatMoney(limit, accountCcy),
                })}
              </Text>
              {dueDay != null && (
                <Text style={styles.creditDue}>{t('accounts.dueDay', { n: dueDay })}</Text>
              )}
            </View>
          </View>
        )}
      </Pressable>
    </Swipeable>
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
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  headerBtnActive: { borderColor: theme.accentMid, backgroundColor: theme.accentDim },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md },
  foreignNote: {
    color: theme.text3,
    fontSize: sizes.xs,
    textAlign: 'center',
    marginTop: -spacing.xs,
  },
  tiles: { flexDirection: 'row', gap: spacing.sm },
  tile: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 2,
  },
  tileLabel: {
    color: theme.text2,
    fontSize: sizes.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tileValue: { fontSize: sizes.lg, fontFamily: font.displayBold },
  tileSub: { color: theme.text3, fontSize: 10 },
  owedSplit: { alignItems: 'flex-end', gap: 1 },
  owedLabel: { color: theme.text3, fontFamily: font.body },
  emptyText: { color: theme.text3, fontSize: sizes.sm, textAlign: 'center', padding: spacing.md },
  group: { gap: spacing.sm },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  groupTitle: {
    color: theme.text2,
    fontSize: sizes.xs,
    fontFamily: font.bodySemi,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  groupTotal: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.bodySemi },
  acctCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    gap: spacing.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acctCardDimmed: { opacity: 0.55 },
  acctNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  acctName: { color: theme.text1, fontSize: sizes.lg, fontFamily: font.display, flexShrink: 1 },
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
  balCol: { alignItems: 'flex-end', maxWidth: '45%' },
  acctBal: { fontSize: sizes.lg, fontFamily: font.display, fontWeight: '700' },
  balApprox: { color: theme.text3, fontSize: sizes.xs, marginTop: 1 },
  handle: { paddingLeft: 2 },
  delta: { flex: 1, fontSize: sizes.xs, fontFamily: font.bodySemi },
  creditBlock: { gap: 4 },
  creditRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  creditText: { flex: 1, fontSize: sizes.xs, fontFamily: font.bodySemi },
  creditDue: { color: theme.text3, fontSize: sizes.xs },
  barBg: { height: 6, backgroundColor: theme.bg3, borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  swipeActions: { flexDirection: 'row', alignItems: 'stretch', marginLeft: spacing.sm },
  swipeBtn: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: radii.lg,
    marginLeft: 6,
  },
  swipeText: { color: '#FFFFFF', fontSize: sizes.xs, fontFamily: font.bodySemi },
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
