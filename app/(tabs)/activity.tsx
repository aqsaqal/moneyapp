// Activity — backward-looking money. Search + category/halal filters +
// day-grouped list with swipe-to-delete + analytics-on-scroll header.
//
// v2 IA: this is v1's history.tsx + v1's more.tsx → Analytics sub-tab folded
// in as a collapsible header. Plan owns "what's coming"; Activity owns
// "what already happened."

import React, { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { TransactionRow } from '@/components/TransactionRow';
import { SearchBar } from '@/components/SearchBar';
import { StatCard, sectionStyles } from '@/components/Sections';
import { MonthlyRecap } from '@/components/MonthlyRecap';
import { HeaderSettingsButton } from '@/components/HeaderSettingsButton';
import { NetWorthChart } from '@/components/NetWorthChart';
import { FeatureSlots } from '@/features';
import { useT } from '@/hooks/useT';
import { useRouter } from 'expo-router';
import { buildEditPrefill } from '@/utils/prefill';
import {
  useTransactions,
  useDailySpend,
  useMonthTotalsByCategory,
  useAccounts,
} from '@/hooks/useAppData';
import { convert as fxConvert } from '@/utils/fx';
import { catInfo } from '@/constants/categories';
import { useCategoriesWithMeta } from '@/hooks/useAppData';
import { CategoryPicker } from '@/components/CategoryPicker';
import { dayStr, monthKey, formatMoney } from '@/utils/format';
import { kv } from '@/utils/kv';
import { onTabReselect } from '@/utils/tabReselect';
import type { CurrencyCode } from '@/constants/currency';
import { CategoriesAnalytics } from '@/components/CategoriesAnalytics';
import { PickerSheet, type PickerOption } from '@/components/PickerSheet';

export default function Activity() {
  const t = useT();
  const router = useRouter();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  // List | Categories segmented control. Defaults to whatever the user
  // saw last in this session (kv-backed so a profile switch reset
  // doesn't accidentally drop the user back to List). Spec calls it
  // "per session" so we don't sync across devices either way.
  const [view, setView] = useState<'list' | 'categories'>(
    () => (kv.get('activityView') as 'list' | 'categories' | undefined) ?? 'categories',
  );
  // Month anchor for the Categories view. Step ±1 with the arrows;
  // the label opens a placeholder picker (TODO: wire to existing
  // PickerSheet once we add Day/Week/Year/Range presets).
  const [analyticsMonth, setAnalyticsMonth] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  // List-view filter drawer: collapsed by default so the top of the
  // tab is just the title + segmented control. Tap the filter icon
  // to reveal the search bar + category chip row. The auto-open-on-
  // filter-already-active case is wired below via useEffect once the
  // filter states have been declared.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterCat, setFilterCat] = useState<string | null>(null);
  // Filter chip strip: same pattern as the Smart Add chip row —
  // "All" + top 5 by THIS MONTH spend + "More". The full picker
  // (everything non-archived, including income categories) lives
  // behind the "More" chip.
  const allCategories = useCategoriesWithMeta();
  const monthTotalsForFilter = useMonthTotalsByCategory(monthKey(), 'expense');
  const top5Categories = useMemo(() => {
    const spendById = new Map(monthTotalsForFilter.map((m) => [m.category, m.total]));
    return allCategories
      .filter((c) => !c.archived && (spendById.get(c.id) ?? 0) > 0)
      .sort((a, b) => (spendById.get(b.id) ?? 0) - (spendById.get(a.id) ?? 0))
      .slice(0, 5);
  }, [allCategories, monthTotalsForFilter]);
  const allFilterCategories = useMemo(
    () => allCategories.filter((c) => !c.archived).sort((a, b) => a.name.localeCompare(b.name)),
    [allCategories],
  );
  const [filterMoreOpen, setFilterMoreOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [halalFilter, setHalalFilter] = useState<string | null>(null);
  // One-shot: if Activity mounts with any list filter already active
  // (e.g. user tapped a category from the analytics view), open the
  // filter drawer so the chip row is visible.
  React.useEffect(() => {
    if (filterCat || search.length > 0 || halalFilter) setFiltersOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCat, halalFilter]);
  // chartOpen drives the "Month at a glance" popup (was inline AnalyticsHeader).
  const [chartOpen, setChartOpen] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const [pageLimit, setPageLimit] = useState(200);

  // End-of-today as the boundary between Upcoming and history. Only
  // relevant when the user is browsing the current month — past months
  // can't have future-dated rows still classed as "upcoming."
  const endOfToday = useMemo(() => {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime();
  }, []);
  const isCurrentMonth = useMemo(() => {
    const now = new Date();
    return (
      analyticsMonth.getFullYear() === now.getFullYear() &&
      analyticsMonth.getMonth() === now.getMonth()
    );
  }, [analyticsMonth]);
  const upcomingTxns = useTransactions({
    category: filterCat,
    search: search || undefined,
    halalStatus: halalFilter,
    dateGt: endOfToday,
    limit: 100,
  });
  // List view now month-scoped: the carousel at the top of the tab
  // anchors which month's transactions are shown. monthKey reads
  // analyticsMonth so the date range mirrors the Categories view.
  const listMonthKey = useMemo(
    () => `${analyticsMonth.getFullYear()}-${String(analyticsMonth.getMonth() + 1).padStart(2, '0')}`,
    [analyticsMonth],
  );
  const txns = useTransactions({
    monthKey: listMonthKey,
    category: filterCat,
    search: search || undefined,
    halalStatus: halalFilter,
    dateLte: endOfToday,
    limit: pageLimit,
  });
  const reachedLimit = txns.length >= pageLimit;

  // Accounts map keyed by id — used to resolve each txn's source
  // currency when computing the per-day net sum below, AND to surface
  // the account name on each row. Includes archived so historical
  // transactions still display their account context after the user
  // has retired the wallet.
  const accounts = useAccounts({ includeArchived: true });
  const accountCcy = useMemo(() => {
    const m = new Map<string, CurrencyCode>();
    accounts.forEach((a) => {
      m.set(a.id, ((a.currency ?? currency) as CurrencyCode));
    });
    return m;
  }, [accounts, currency]);
  const accountName = useMemo(() => {
    const m = new Map<string, string>();
    accounts.forEach((a) => m.set(a.id, a.name));
    return m;
  }, [accounts]);
  // Icon + brand color keyed by id so rows can render a tiny chip next
  // to the account-label line. Built once per render — rows stay dumb.
  const accountMeta = useMemo(() => {
    const m = new Map<string, { icon: string; color: string }>();
    accounts.forEach((a) => m.set(a.id, { icon: a.icon, color: a.color }));
    return m;
  }, [accounts]);
  const labelFor = (tx: typeof txns[number]): string | undefined => {
    if (tx.type === 'transfer') {
      const from = accountName.get(tx.accountId ?? '');
      const to = accountName.get(tx.toAccountId ?? '');
      return from && to ? `${from} → ${to}` : (from ?? to);
    }
    return accountName.get(tx.accountId ?? '');
  };

  const grouped = useMemo(() => {
    const g = new Map<string, typeof txns>();
    txns.forEach((t) => {
      const k = dayStr(t.date);
      const arr = g.get(k) ?? [];
      arr.push(t);
      g.set(k, arr);
    });
    // Net for the day = income − expense, transfers excluded (they net
    // to zero across the user's own accounts). Each leg is converted
    // from its account currency to the display currency via the cached
    // FX rates; missing rates fall back to a 1:1 no-op upstream.
    return Array.from(g.entries()).map(([day, ts]) => {
      let net = 0;
      ts.forEach((t) => {
        if (t.type === 'transfer') return;
        const from = (accountCcy.get(t.accountId ?? '') ?? currency) as string;
        const v = fxConvert(t.amount, from, currency);
        net += t.type === 'income' ? v : -v;
      });
      return [day, ts, net] as const;
    });
  }, [txns, accountCcy, currency]);

  // ─── Categories analytics period range ────────────────────────────
  // For Month view: [first of month, first of next month).
  const analyticsRange = useMemo(() => {
    const start = analyticsMonth.getTime();
    const end = new Date(
      analyticsMonth.getFullYear(),
      analyticsMonth.getMonth() + 1,
      1,
    ).getTime();
    return { start, end };
  }, [analyticsMonth]);
  const analyticsLabel = useMemo(
    () => analyticsMonth.toLocaleString('default', { month: 'long', year: 'numeric' }),
    [analyticsMonth],
  );

  const setViewPersist = (v: 'list' | 'categories') => {
    setView(v);
    kv.set('activityView', v);
  };

  // Tapping the Activity tab while it's already focused flips the
  // segmented view — quick way to peek between Transactions and
  // Categories without aiming at the segmented control.
  React.useEffect(() => {
    return onTabReselect('activity', () => {
      setView((v) => {
        const next = v === 'list' ? 'categories' : 'list';
        kv.set('activityView', next);
        return next;
      });
    });
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <Text style={styles.title}>{t('activity.title')}</Text>
          <HeaderSettingsButton />
        </View>
        {/* Segmented control + filter toggle on one line. The filter
            toggle is visible only in List mode (Categories view has its
            own period nav) and shows a green dot when any list filter is
            active so the user knows the chip row exists. */}
        <View style={styles.segmentedRow}>
          <View style={styles.segmented}>
            {(['categories', 'list'] as const).map((v) => (
              <Pressable
                key={v}
                onPress={() => setViewPersist(v)}
                style={[styles.segmentedBtn, view === v && styles.segmentedBtnActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: view === v }}
              >
                <Text style={[styles.segmentedText, view === v && styles.segmentedTextActive]}>
                  {t(v === 'list' ? 'activity.view.list' : 'activity.view.categories')}
                </Text>
              </Pressable>
            ))}
          </View>
          <View style={styles.iconBtnRow}>
            {view === 'list' && (
              <Pressable
                onPress={() => setFiltersOpen((v) => !v)}
                style={[styles.filterToggle, filtersOpen && styles.filterToggleActive]}
                accessibilityRole="button"
                accessibilityLabel={t('activity.filterToggle')}
                accessibilityState={{ expanded: filtersOpen }}
                hitSlop={6}
              >
                <MaterialCommunityIcons
                  name={filtersOpen ? 'filter' : 'filter-outline'}
                  size={18}
                  color={filtersOpen ? theme.bg : theme.text2}
                />
                {(Boolean(filterCat) || search.length > 0 || Boolean(halalFilter)) && !filtersOpen && (
                  <View style={styles.filterToggleBadge} />
                )}
              </Pressable>
            )}
            <Pressable
              onPress={() => setChartOpen(true)}
              style={styles.filterToggle}
              accessibilityRole="button"
              accessibilityLabel={t('activity.glance')}
              hitSlop={6}
            >
              <MaterialCommunityIcons name="chart-line" size={18} color={theme.text2} />
            </Pressable>
          </View>
        </View>
        {view === 'list' && filtersOpen && (
          <>
        <SearchBar value={search} onChange={setSearch} placeholder={t('activity.searchPlaceholder')} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <FilterChip label={t('activity.allChip')} active={!filterCat} onPress={() => setFilterCat(null)} />
          {top5Categories.map((c) => (
            <FilterChip
              key={c.id}
              label={c.name}
              active={filterCat === c.id}
              onPress={() => setFilterCat(filterCat === c.id ? null : c.id)}
              color={c.color}
            />
          ))}
          {/* "More" only renders if the selected filter is hidden from
              the top-5, OR if there are more than 5 categories with any
              activity this month — otherwise it's noise. */}
          {(allFilterCategories.length > top5Categories.length || (filterCat && !top5Categories.some((c) => c.id === filterCat))) && (
            <FilterChip
              label={
                filterCat && !top5Categories.some((c) => c.id === filterCat)
                  ? `${t('smartAdd.more')} · ${catInfo(filterCat).name}`
                  : t('smartAdd.more')
              }
              active={Boolean(filterCat && !top5Categories.some((c) => c.id === filterCat))}
              onPress={() => setFilterMoreOpen(true)}
            />
          )}
          <FeatureSlots.HistoryFilterExtras value={halalFilter} onChange={setHalalFilter} />
        </ScrollView>
          </>
        )}
      </View>
      {view === 'categories' ? (
        <CategoriesAnalytics
          rangeStart={analyticsRange.start}
          rangeEnd={analyticsRange.end}
          periodLabel={analyticsLabel}
          onPrevPeriod={() =>
            setAnalyticsMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
          }
          onNextPeriod={() =>
            setAnalyticsMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
          }
          onPickPeriod={() => setMonthPickerOpen(true)}
          accountId={null}
          currency={currency}
          onSelectCategory={(catId) => {
            setFilterCat(catId);
            setViewPersist('list');
          }}
        />
      ) : (
      <ScrollView contentContainerStyle={styles.scroll}>
        {/* Month carousel — mirrors the one in the Categories view so
            switching segments keeps the user's mental anchor. Tap the
            label to open the month picker; arrows step ±1. */}
        <View style={styles.periodRow}>
          <Pressable
            onPress={() =>
              setAnalyticsMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))
            }
            hitSlop={8}
            style={styles.periodArrow}
            accessibilityRole="button"
            accessibilityLabel={t('activity.month.prev')}
          >
            <MaterialCommunityIcons name="chevron-left" size={22} color={theme.text2} />
          </Pressable>
          <Pressable
            onPress={() => setMonthPickerOpen(true)}
            style={styles.periodLabel}
            accessibilityRole="button"
            accessibilityLabel={t('activity.month.pick')}
            accessibilityValue={{ text: analyticsLabel }}
          >
            <Text style={styles.periodLabelText}>{analyticsLabel}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color={theme.text2} />
          </Pressable>
          <Pressable
            onPress={() =>
              setAnalyticsMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))
            }
            hitSlop={8}
            style={styles.periodArrow}
            accessibilityRole="button"
            accessibilityLabel={t('activity.month.next')}
          >
            <MaterialCommunityIcons name="chevron-right" size={22} color={theme.text2} />
          </Pressable>
        </View>
        <FeatureSlots.ActivityHeaderExtras />
        {grouped.length === 0 && (
          <View style={styles.emptyWrap}>
            <MaterialCommunityIcons
              name={search || filterCat || halalFilter ? 'filter-off-outline' : 'inbox-outline'}
              size={48}
              color={theme.text3}
            />
            <Text style={styles.emptyTitle}>
              {search || filterCat || halalFilter
                ? t('activity.empty.filtered.title')
                : t('activity.empty.fresh.title')}
            </Text>
            <Text style={styles.emptyHint}>
              {search || filterCat || halalFilter
                ? t('activity.empty.filtered.hint')
                : t('activity.empty.fresh.hint')}
            </Text>
          </View>
        )}
        {/* Upcoming — future-dated transactions. Only shown when the
            user is viewing the current month; past months can't have
            scheduled-but-not-yet-executed rows by definition. */}
        {isCurrentMonth && upcomingTxns.length > 0 && (
          <View style={styles.group}>
            <Text style={[styles.dayLabel, styles.upcomingLabel]}>UPCOMING</Text>
            <View style={{ gap: 2, opacity: 0.85 }}>
              {upcomingTxns.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  t={tx}
                  currency={currency}
                  accountLabel={labelFor(tx)}
                  fromCurrency={accountCcy.get(tx.accountId ?? '')}
                  toCurrency={tx.toAccountId ? accountCcy.get(tx.toAccountId) : undefined}
                  accountIcon={accountMeta.get(tx.accountId ?? '')?.icon}
                  accountColor={accountMeta.get(tx.accountId ?? '')?.color}
                  tag={{ text: 'scheduled', color: '#F59E0B' }}
                  onPressMore={() =>
                    router.push({
                      pathname: '/add',
                      params: { prefill: buildEditPrefill(tx) },
                    } as never)
                  }
                />
              ))}
            </View>
          </View>
        )}
        {grouped.map(([day, ts, net]) => (
          <View key={day} style={styles.group}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayLabel}>{day}</Text>
              {net !== 0 && (
                <Text
                  style={[
                    styles.dayTotal,
                    { color: net > 0 ? theme.accent : theme.text2 },
                  ]}
                >
                  {net > 0 ? '+' : '−'}
                  {formatMoney(Math.abs(net), currency)}
                </Text>
              )}
            </View>
            <View style={{ gap: 2 }}>
              {ts.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  t={tx}
                  currency={currency}
                  accountLabel={labelFor(tx)}
                  fromCurrency={accountCcy.get(tx.accountId ?? '')}
                  toCurrency={tx.toAccountId ? accountCcy.get(tx.toAccountId) : undefined}
                  accountIcon={accountMeta.get(tx.accountId ?? '')?.icon}
                  accountColor={accountMeta.get(tx.accountId ?? '')?.color}
                  onPressMore={() =>
                    router.push({
                      pathname: '/add',
                      params: { prefill: buildEditPrefill(tx) },
                    } as never)
                  }
                />
              ))}
            </View>
          </View>
        ))}
        {reachedLimit && (
          <Pressable
            onPress={() => setPageLimit((n) => n + 200)}
            style={({ pressed }) => [styles.loadMore, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel={t('activity.loadMore')}
          >
            <Text style={styles.loadMoreText}>{t('activity.loadMore')}</Text>
          </Pressable>
        )}
        <View style={{ height: 100 }} />
      </ScrollView>
      )}
      <MonthlyRecap visible={recapOpen} onClose={() => setRecapOpen(false)} />
      <ChartModal
        visible={chartOpen}
        currency={currency}
        onClose={() => setChartOpen(false)}
        onShareRecap={() => {
          setChartOpen(false);
          setRecapOpen(true);
        }}
      />
      {/* Month picker for Categories view — 24 entries (this month +
          previous 23) is a usable window without dragging in a real
          date picker dependency. Wider ranges can land alongside the
          Day/Week/Year/All-time presets in a follow-up. */}
      <PickerSheet
        visible={monthPickerOpen}
        title={t('activity.view.categories')}
        selected={analyticsMonth.toISOString().slice(0, 7)}
        options={Array.from({ length: 24 }, (_, i) => {
          const d = new Date();
          d.setDate(1); d.setHours(0, 0, 0, 0);
          d.setMonth(d.getMonth() - i);
          return {
            value: d.toISOString().slice(0, 7),
            label: d.toLocaleString('default', { month: 'long', year: 'numeric' }),
          } as PickerOption<string>;
        })}
        onPick={(iso) => {
          const [y, m] = iso.split('-').map(Number);
          setAnalyticsMonth(new Date(y, m - 1, 1));
        }}
        onClose={() => setMonthPickerOpen(false)}
      />
      <CategoryPicker
        visible={filterMoreOpen}
        mode="select"
        headerText={t('picker.filterByCategory')}
        onSelect={(id) => {
          setFilterCat(id);
          setFilterMoreOpen(false);
        }}
        onClose={() => setFilterMoreOpen(false)}
      />
    </SafeAreaView>
  );
}

// ---- Chart modal (formerly inline "Month at a glance" header) ----
//
// Same numbers as before — avg/day, projected, total, category count,
// net-worth chart, share-recap — but now lives in a chart-icon popup
// instead of an always-visible collapsible at the top of List view.
// The popup is reachable from BOTH segmented modes (List + Categories)
// via the chart button next to the filter toggle.

function ChartModal({
  visible,
  currency,
  onClose,
  onShareRecap,
}: {
  visible: boolean;
  currency: CurrencyCode;
  onClose: () => void;
  onShareRecap: () => void;
}) {
  const t = useT();
  const key = monthKey();
  const monthTxns = useTransactions({ monthKey: key });
  const daily = useDailySpend(key);
  const totals = useMonthTotalsByCategory(key);

  const expenses = monthTxns.filter((t) => t.type === 'expense');
  const totalSpend = expenses.reduce((s, t) => s + t.amount, 0);
  const today = new Date();
  const dim = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  // Avg/Day = total spend ÷ elapsed calendar days. Using elapsed days
  // (not days-with-spending) keeps Avg × DaysInMonth ≈ projected, so
  // the three numbers reconcile against each other.
  const elapsedDays = Math.max(1, today.getDate());
  const avgDaily = totalSpend / elapsedDays;
  const projected = avgDaily * dim;
  void daily;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.modalHead}>
          <Text style={styles.modalTitle}>{t('activity.glance')}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
            <MaterialCommunityIcons name="close" size={22} color={theme.text2} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.modalBody}>
          <View style={sectionStyles.statGrid}>
            <StatCard label={t('activity.stat.avgDay')} value={formatMoney(avgDaily, currency)} />
            <StatCard label={t('activity.stat.projected')} value={formatMoney(projected, currency)} />
            <StatCard label={t('activity.stat.total')} value={formatMoney(totalSpend, currency)} />
            <StatCard label={t('activity.stat.categories')} value={String(totals.length)} />
          </View>
          <NetWorthChart />
          <Pressable
            onPress={onShareRecap}
            style={({ pressed }) => [styles.recapBtn, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Open monthly recap"
          >
            <MaterialCommunityIcons name="share-variant" size={16} color={theme.accent} />
            <Text style={styles.recapText}>{t('activity.shareMonth')}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ---- Filter chip ----

function FilterChip({
  label,
  active,
  onPress,
  color,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active && { backgroundColor: color ?? theme.accent, borderColor: 'transparent' },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && { color: theme.bg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  top: { padding: spacing.lg, gap: spacing.md },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  segmentedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: theme.bg2,
    borderRadius: radii.pill,
    padding: 3,
    alignSelf: 'flex-start',
  },
  filterToggle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterToggleActive: {
    backgroundColor: theme.accent,
    borderColor: 'transparent',
  },
  filterToggleBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.accent,
    borderWidth: 2,
    borderColor: theme.bg,
  },
  iconBtnRow: { flexDirection: 'row', gap: 8 },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    // The List view's ScrollView already pads spacing.lg horizontally;
    // cancel that here so the carousel hits the same screen-edge inset
    // as the Categories view (which renders without an outer pad).
    marginHorizontal: -spacing.lg,
  },
  periodArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.bg2,
  },
  periodLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: theme.bg2,
  },
  periodLabelText: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  modalTitle: { color: theme.text1, fontSize: sizes.xl, fontFamily: font.displayBold },
  modalBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  segmentedBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  segmentedBtnActive: { backgroundColor: theme.accent },
  segmentedText: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.bodySemi },
  segmentedTextActive: { color: theme.bg },
  title: { color: theme.text1, fontSize: sizes.xxxl, fontFamily: font.displayBold },
  chipRow: { gap: 8, paddingVertical: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10, // a11y: ≥44pt with the line-height; bumped from v1's 6
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg2,
  },
  chipText: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.body },
  upcomingLabel: { color: '#F59E0B' },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  group: { gap: spacing.sm },
  dayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayLabel: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.body, textTransform: 'uppercase' },
  dayTotal: { fontSize: sizes.sm, fontFamily: font.bodySemi },
  empty: { color: theme.text3, textAlign: 'center', marginTop: spacing.xxl },
  emptyWrap: {
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  emptyTitle: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi, textAlign: 'center' },
  emptyHint: { color: theme.text3, fontSize: sizes.sm, textAlign: 'center' },
  recapBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.sm,
    paddingVertical: 10,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: `${theme.accent}11`,
  },
  recapText: { color: theme.accent, fontSize: sizes.sm, fontFamily: font.bodySemi },
  loadMore: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    marginTop: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg2,
  },
  loadMoreText: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.bodySemi },
});
