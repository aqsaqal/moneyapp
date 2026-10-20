// Activity — backward-looking money, one scroll.
//
//   Month header   ‹ October 2026 ›  (tap label → picker; swipe the
//                  totals card left/right → previous / next month)
//   Totals card    Expenses big · Income small · "−12% vs last month ·
//                  ₸103k/day · ₸3.1M projected" · share-month button
//   Chips          All · top categories with amounts · More… · account
//                  · (islamic) halal · search · clear
//   See breakdown  → modal with the full category table (CategoriesAnalytics)
//   List           SectionList, sticky day headers with the day's net,
//                  swipe left = delete, swipe right = Repeat (Smart Add
//                  prefilled with category / account / note, no amount)
//   Scheduled      future-dated rows as the LAST section (current month)
//
// Replaces the Categories | Transactions segmented control, the hidden
// tab-reselect flip, the chart button and the glance modal. Long-range
// charts (net worth, income vs spending) live on the Accounts tab.

import React, { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter, useLocalSearchParams } from 'expo-router';
import { Modal, Pressable, ScrollView, SectionList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { TransactionRow } from '@/components/TransactionRow';
import { SearchBar } from '@/components/SearchBar';
import { MonthlyRecap } from '@/components/MonthlyRecap';
import { HeaderSettingsButton } from '@/components/HeaderSettingsButton';
import { CategoriesAnalytics } from '@/components/CategoriesAnalytics';
import { CategoryPicker } from '@/components/CategoryPicker';
import { PickerSheet, type PickerOption } from '@/components/PickerSheet';
import { FeatureSlots } from '@/features';
import { useT } from '@/hooks/useT';
import { useHaptics } from '@/hooks/useHaptics';
import { buildEditPrefill, encodePrefill } from '@/utils/prefill';
import {
  useTransactions,
  useMonthTotalsByCategory,
  useMonthFlow,
  useAccounts,
  useCategoriesWithMeta,
} from '@/hooks/useAppData';
import { convert as fxConvert } from '@/utils/fx';
import { catInfo } from '@/constants/categories';
import { dayStr, formatMoney, formatMonthYear } from '@/utils/format';
import { formatMoneyShort, type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';
import type { Transaction } from '@/utils/db/schema';

type Section = { title: string; net: number; scheduled?: boolean; data: Transaction[] };

export default function Activity() {
  const t = useT();
  const router = useRouter();
  const haptics = useHaptics();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;

  // ── Month anchor ─────────────────────────────────────────────────
  const [month, setMonth] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const stepMonth = (delta: number) => {
    haptics.tap();
    setMonth((d) => new Date(d.getFullYear(), d.getMonth() + delta, 1));
  };
  const monthLabel = useMemo(() => formatMonthYear(month), [month]);
  const listMonthKey = useMemo(
    () => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`,
    [month],
  );
  const now = new Date();
  const isCurrentMonth = month.getFullYear() === now.getFullYear() && month.getMonth() === now.getMonth();
  const dim = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const elapsedDays = isCurrentMonth ? Math.max(1, now.getDate()) : dim;

  // ── Filters ──────────────────────────────────────────────────────
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [filterAccount, setFilterAccount] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [halalFilter, setHalalFilter] = useState<string | null>(null);
  const [filterMoreOpen, setFilterMoreOpen] = useState(false);
  const [accountPickerOpen, setAccountPickerOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const [pageLimit, setPageLimit] = useState(200);
  const anyFilter = !!(filterCat || filterAccount || search || halalFilter);
  const clearFilters = () => {
    setFilterCat(null); setFilterAccount(null); setSearch(''); setSearchOpen(false); setHalalFilter(null);
  };

  // Deep link: flow://activity?view=categories opens the breakdown sheet.
  const params = useLocalSearchParams<{ view?: string }>();
  React.useEffect(() => {
    if (params.view === 'categories') setBreakdownOpen(true);
    else if (params.view === 'list') setBreakdownOpen(false);
  }, [params.view]);
  // Home / Insights hand off a month (and formerly a view) via kv.
  useFocusEffect(useCallback(() => {
    const jump = kv.get('activityJumpToMonth');
    const v = kv.get('activityJumpToView');
    if (typeof jump === 'string' && /^\d{4}-\d{2}$/.test(jump)) {
      const [y, m] = jump.split('-').map(Number);
      setMonth(new Date(y, m - 1, 1));
      kv.delete('activityJumpToMonth');
    }
    if (v === 'categories') setBreakdownOpen(true);
    if (v) kv.delete('activityJumpToView');
  }, []));

  // ── Data ─────────────────────────────────────────────────────────
  const endOfToday = useMemo(() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); }, []);
  const txns = useTransactions({
    monthKey: listMonthKey,
    category: filterCat,
    accountId: filterAccount,
    search: search || undefined,
    halalStatus: halalFilter,
    dateLte: endOfToday,
    limit: pageLimit,
  });
  const upcomingTxns = useTransactions({
    category: filterCat,
    accountId: filterAccount,
    search: search || undefined,
    halalStatus: halalFilter,
    dateGt: endOfToday,
    limit: 100,
  });
  const reachedLimit = txns.length >= pageLimit;
  const hasAnyTxns = useTransactions({ limit: 1 }).length > 0;

  // Totals for the header: this month up to "now" (or the whole month
  // when browsing the past) and the previous month cut at the same day
  // so the comparison is like-for-like.
  const thisCutoff = isCurrentMonth ? Date.now() : new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59).getTime();
  const flow = useMonthFlow(listMonthKey, thisCutoff);
  const prevMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const prevKey = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;
  const prevDim = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0).getDate();
  const prevCutoff = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), Math.min(elapsedDays, prevDim), 23, 59, 59).getTime();
  const prevFlow = useMonthFlow(prevKey, prevCutoff);
  const vsPrev = prevFlow.expense > 0 ? ((flow.expense - prevFlow.expense) / prevFlow.expense) * 100 : null;
  const perDay = flow.expense / elapsedDays;
  const projected = isCurrentMonth ? perDay * dim : null;

  // Category chips: top 5 by spend in the VIEWED month.
  const allCategories = useCategoriesWithMeta();
  const monthTotals = useMonthTotalsByCategory(listMonthKey, 'expense');
  const topCategories = useMemo(() => {
    const spend = new Map(monthTotals.map((m) => [m.category, m.total]));
    return allCategories
      .filter((c) => !c.archived && (spend.get(c.id) ?? 0) > 0)
      .sort((a, b) => (spend.get(b.id) ?? 0) - (spend.get(a.id) ?? 0))
      .slice(0, 5)
      .map((c) => ({ ...c, total: spend.get(c.id) ?? 0 }));
  }, [allCategories, monthTotals]);

  const accounts = useAccounts({ includeArchived: true });
  const accountCcy = useMemo(() => {
    const m = new Map<string, CurrencyCode>();
    accounts.forEach((a) => m.set(a.id, ((a.currency ?? currency) as CurrencyCode)));
    return m;
  }, [accounts, currency]);
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const accountMeta = useMemo(
    () => new Map(accounts.map((a) => [a.id, { icon: a.icon, color: a.color }])),
    [accounts],
  );
  const labelFor = (tx: Transaction): string | undefined => {
    if (tx.type === 'transfer') {
      const from = accountName.get(tx.accountId ?? '');
      const to = accountName.get(tx.toAccountId ?? '');
      return from && to ? `${from} → ${to}` : (from ?? to);
    }
    return accountName.get(tx.accountId ?? '');
  };

  const sections = useMemo<Section[]>(() => {
    const g = new Map<string, Transaction[]>();
    txns.forEach((tx) => {
      const k = dayStr(tx.date);
      const arr = g.get(k) ?? [];
      arr.push(tx);
      g.set(k, arr);
    });
    const out: Section[] = Array.from(g.entries()).map(([day, ts]) => {
      let net = 0;
      ts.forEach((tx) => {
        if (tx.type === 'transfer') return;
        const v = tx.amountMain ?? fxConvert(tx.amount, accountCcy.get(tx.accountId ?? '') ?? currency, currency);
        net += tx.type === 'income' ? v : -v;
      });
      return { title: day, net, data: ts };
    });
    if (isCurrentMonth && upcomingTxns.length > 0) {
      out.push({ title: t('activity.scheduledSection'), net: 0, scheduled: true, data: upcomingTxns });
    }
    return out;
  }, [txns, upcomingTxns, isCurrentMonth, accountCcy, currency, t]);

  // ── Actions ──────────────────────────────────────────────────────
  const edit = (tx: Transaction) =>
    router.push({ pathname: '/add', params: { prefill: buildEditPrefill(tx) } } as never);
  const repeat = (tx: Transaction) =>
    router.push({
      pathname: '/add',
      params: {
        prefill: encodePrefill({
          type: tx.type,
          category: tx.category ?? undefined,
          accountId: tx.accountId,
          toAccountId: tx.toAccountId ?? undefined,
          note: tx.note ?? undefined,
          originalCurrency: tx.originalCurrency ?? undefined,
        }),
      },
    } as never);

  // Swipe the totals card to change month.
  const monthSwipe = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX([-24, 24])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      if (e.translationX < -60) stepMonth(1);
      else if (e.translationX > 60) stepMonth(-1);
    });

  const Header = (
    <View style={styles.headerBlock}>
      <View style={styles.periodRow}>
        <Pressable onPress={() => stepMonth(-1)} hitSlop={8} style={styles.periodArrow} accessibilityRole="button" accessibilityLabel={t('activity.month.prev')}>
          <MaterialCommunityIcons name="chevron-left" size={22} color={theme.text2} />
        </Pressable>
        <Pressable onPress={() => setMonthPickerOpen(true)} style={styles.periodLabel} accessibilityRole="button" accessibilityLabel={t('activity.month.pick')} accessibilityValue={{ text: monthLabel }}>
          <Text style={styles.periodLabelText}>{monthLabel}</Text>
          <MaterialCommunityIcons name="chevron-down" size={16} color={theme.text2} />
        </Pressable>
        <Pressable onPress={() => stepMonth(1)} hitSlop={8} style={styles.periodArrow} accessibilityRole="button" accessibilityLabel={t('activity.month.next')}>
          <MaterialCommunityIcons name="chevron-right" size={22} color={theme.text2} />
        </Pressable>
      </View>

      <GestureDetector gesture={monthSwipe}>
        <View style={styles.totalsCard} accessible accessibilityLabel={`${t('analytics.expense')} ${formatMoney(flow.expense, currency)}, ${t('analytics.income')} ${formatMoney(flow.income, currency)}`}>
          <View style={styles.totalsHead}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.totalsLabel}>{t('analytics.expense').toUpperCase()}</Text>
              <Text style={styles.totalsValue} adjustsFontSizeToFit numberOfLines={1}>
                {formatMoney(flow.expense, currency)}
              </Text>
              <Text style={styles.totalsIncome}>
                {t('analytics.income')} · {formatMoney(flow.income, currency)}
              </Text>
            </View>
            <Pressable
              onPress={() => setRecapOpen(true)}
              style={styles.iconBtn}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t('activity.shareMonth')}
            >
              <MaterialCommunityIcons name="share-variant" size={18} color={theme.text2} />
            </Pressable>
          </View>
          <Text style={styles.compareLine} numberOfLines={2}>
            {vsPrev != null
              ? `${vsPrev >= 0 ? '+' : '−'}${Math.abs(Math.round(vsPrev))}% ${t('activity.vsLastMonth')}`
              : ''}
            {vsPrev != null && flow.expense > 0 ? ' · ' : ''}
            {flow.expense > 0 ? t('activity.perDay', { amount: formatMoneyShort(perDay, currency) }) : ''}
            {projected != null && flow.expense > 0 ? ` · ${t('activity.projectedShort', { amount: formatMoneyShort(projected, currency) })}` : ''}
          </Text>
        </View>
      </GestureDetector>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} keyboardShouldPersistTaps="handled">
        <Chip label={t('activity.allChip')} active={!filterCat} onPress={() => setFilterCat(null)} />
        {topCategories.map((c) => (
          <Chip
            key={c.id}
            label={`${c.name} ${formatMoneyShort(c.total, currency)}`}
            active={filterCat === c.id}
            color={c.color}
            onPress={() => setFilterCat(filterCat === c.id ? null : c.id)}
          />
        ))}
        {filterCat && !topCategories.some((c) => c.id === filterCat) && (
          <Chip label={catInfo(filterCat).name} active color={catInfo(filterCat).color} onPress={() => setFilterCat(null)} />
        )}
        <Chip label={t('smartAdd.more')} active={false} icon="dots-horizontal" onPress={() => setFilterMoreOpen(true)} />
        <Chip
          label={filterAccount ? (accountName.get(filterAccount) ?? '') : t('activity.filter.allAccounts')}
          active={!!filterAccount}
          icon="wallet-outline"
          onPress={() => setAccountPickerOpen(true)}
        />
        <FeatureSlots.HistoryFilterExtras value={halalFilter} onChange={setHalalFilter} />
        <Chip label={t('activity.search')} active={searchOpen || !!search} icon="magnify" onPress={() => setSearchOpen((v) => !v)} />
        {anyFilter && (
          <Chip label={t('activity.filter.clear')} active={false} icon="close" onPress={clearFilters} />
        )}
      </ScrollView>
      {(searchOpen || !!search) && (
        <SearchBar value={search} onChange={setSearch} placeholder={t('activity.searchPlaceholder')} />
      )}

      <Pressable onPress={() => setBreakdownOpen(true)} style={styles.breakdownLink} accessibilityRole="button" accessibilityLabel={t('activity.seeBreakdown')} hitSlop={6}>
        <MaterialCommunityIcons name="chart-bar" size={16} color={theme.accent} />
        <Text style={styles.breakdownLinkText}>{t('activity.seeBreakdown')}</Text>
      </Pressable>
      <FeatureSlots.ActivityHeaderExtras />
    </View>
  );

  const Empty = (() => {
    const variant = anyFilter ? 'filtered' : hasAnyTxns ? 'period' : 'fresh';
    const iconName = variant === 'filtered' ? 'filter-off-outline' : variant === 'period' ? 'chart-bar' : 'inbox-outline';
    return (
      <View style={styles.emptyWrap}>
        <MaterialCommunityIcons name={iconName} size={48} color={theme.text3} />
        <Text style={styles.emptyTitle}>{t(`activity.empty.${variant}.title`)}</Text>
        <Text style={styles.emptyHint}>{t(`activity.empty.${variant}.hint`)}</Text>
      </View>
    );
  })();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.top}>
        <Text style={styles.title}>{t('activity.title')}</Text>
        <HeaderSettingsButton />
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(tx) => tx.id}
        stickySectionHeadersEnabled
        initialNumToRender={12}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scroll}
        ListHeaderComponent={Header}
        ListEmptyComponent={Empty}
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <Text style={[styles.dayLabel, section.scheduled && styles.scheduledLabel]}>{section.title}</Text>
            {section.net !== 0 && (
              <Text style={[styles.dayTotal, { color: section.net > 0 ? theme.accent : theme.text2 }]}>
                {section.net > 0 ? '+' : '−'}{formatMoney(Math.abs(section.net), currency)}
              </Text>
            )}
          </View>
        )}
        renderItem={({ item: tx, section }) => (
          <View style={{ paddingBottom: 2, opacity: section.scheduled ? 0.85 : 1 }}>
            <TransactionRow
              t={tx}
              currency={currency}
              accountLabel={labelFor(tx)}
              fromCurrency={accountCcy.get(tx.accountId ?? '')}
              toCurrency={tx.toAccountId ? accountCcy.get(tx.toAccountId) : undefined}
              accountIcon={accountMeta.get(tx.accountId ?? '')?.icon}
              accountColor={accountMeta.get(tx.accountId ?? '')?.color}
              tag={section.scheduled ? { text: t('activity.scheduled'), color: '#F59E0B' } : undefined}
              onPressMore={() => edit(tx)}
              onRepeat={() => repeat(tx)}
            />
          </View>
        )}
        ListFooterComponent={
          <View>
            {reachedLimit && (
              <Pressable onPress={() => setPageLimit((n) => n + 200)} style={({ pressed }) => [styles.loadMore, pressed && { opacity: 0.7 }]} accessibilityRole="button" accessibilityLabel={t('activity.loadMore')}>
                <Text style={styles.loadMoreText}>{t('activity.loadMore')}</Text>
              </Pressable>
            )}
            <View style={{ height: 100 }} />
          </View>
        }
      />

      {/* Full category table — the old Categories view, now on demand. */}
      <Modal visible={breakdownOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setBreakdownOpen(false)}>
        <SafeAreaView style={styles.safe} edges={['top']}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>{t('analytics.breakdown')}</Text>
            <Pressable onPress={() => setBreakdownOpen(false)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
              <MaterialCommunityIcons name="close" size={22} color={theme.text2} />
            </Pressable>
          </View>
          <CategoriesAnalytics
            rangeStart={month.getTime()}
            rangeEnd={new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime()}
            periodLabel={monthLabel}
            onPrevPeriod={() => stepMonth(-1)}
            onNextPeriod={() => stepMonth(1)}
            onPickPeriod={() => { setBreakdownOpen(false); setMonthPickerOpen(true); }}
            accountId={filterAccount}
            currency={currency}
            onSelectCategory={(id) => { setFilterCat(id); setBreakdownOpen(false); }}
          />
        </SafeAreaView>
      </Modal>

      <MonthlyRecap visible={recapOpen} onClose={() => setRecapOpen(false)} />
      <PickerSheet
        visible={monthPickerOpen}
        title={t('activity.month.pick')}
        selected={listMonthKey}
        options={Array.from({ length: 24 }, (_, i) => {
          const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() - i);
          return { value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: formatMonthYear(d) } as PickerOption<string>;
        })}
        onPick={(iso) => { const [y, m] = iso.split('-').map(Number); setMonth(new Date(y, m - 1, 1)); }}
        onClose={() => setMonthPickerOpen(false)}
      />
      <PickerSheet
        visible={accountPickerOpen}
        title={t('activity.filter.account')}
        selected={filterAccount ?? ''}
        options={[
          { value: '', label: t('activity.filter.allAccounts'), icon: 'wallet-outline' },
          ...accounts.filter((a) => a.archived !== 1).map<PickerOption<string>>((a) => ({ value: a.id, label: a.name, icon: 'wallet-outline', iconColor: a.color })),
        ]}
        onPick={(id) => setFilterAccount(id || null)}
        onClose={() => setAccountPickerOpen(false)}
      />
      <CategoryPicker
        visible={filterMoreOpen}
        mode="select"
        headerText={t('picker.filterByCategory')}
        onSelect={(id) => { setFilterCat(id); setFilterMoreOpen(false); }}
        onClose={() => setFilterMoreOpen(false)}
      />
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress, color, icon }: {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, active && { backgroundColor: color ?? theme.accent, borderColor: 'transparent' }]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
    >
      {icon && <MaterialCommunityIcons name={icon} size={14} color={active ? theme.bg : theme.text2} />}
      <Text style={[styles.chipText, active && { color: theme.bg }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  top: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: theme.text1, fontSize: sizes.xxxl, fontFamily: font.displayBold },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  headerBlock: { gap: spacing.md, paddingBottom: spacing.sm },
  periodRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  periodArrow: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg2 },
  periodLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radii.md, backgroundColor: theme.bg2 },
  periodLabelText: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi },
  totalsCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 6,
  },
  totalsHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  totalsLabel: { color: theme.text2, fontSize: sizes.xs, letterSpacing: 0.6 },
  totalsValue: { color: theme.expense, fontSize: sizes.xxxl, fontFamily: font.displayBold, marginTop: 2 },
  totalsIncome: { color: theme.accent, fontSize: sizes.sm, fontFamily: font.bodySemi, marginTop: 2 },
  compareLine: { color: theme.text3, fontSize: sizes.xs },
  iconBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg3 },
  chipRow: { gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg2,
    maxWidth: 200,
  },
  chipText: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.body },
  breakdownLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingVertical: 2 },
  breakdownLinkText: { color: theme.accent, fontSize: sizes.sm, fontFamily: font.bodySemi },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.bg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  dayLabel: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.body, textTransform: 'uppercase' },
  scheduledLabel: { color: '#F59E0B' },
  dayTotal: { fontSize: sizes.sm, fontFamily: font.bodySemi },
  emptyWrap: { alignItems: 'center', gap: 6, marginTop: spacing.xxl, paddingHorizontal: spacing.lg },
  emptyTitle: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi, textAlign: 'center' },
  emptyHint: { color: theme.text3, fontSize: sizes.sm, textAlign: 'center' },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  modalTitle: { color: theme.text1, fontSize: sizes.xl, fontFamily: font.displayBold },
  loadMore: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md, marginTop: spacing.md, borderRadius: radii.md, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.bg2 },
  loadMoreText: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.bodySemi },
});
