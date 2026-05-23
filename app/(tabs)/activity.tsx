// Activity — backward-looking money. Search + category/halal filters +
// day-grouped list with swipe-to-delete + analytics-on-scroll header.
//
// v2 IA: this is v1's history.tsx + v1's more.tsx → Analytics sub-tab folded
// in as a collapsible header. Plan owns "what's coming"; Activity owns
// "what already happened."

import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { TransactionRow } from '@/components/TransactionRow';
import { SearchBar } from '@/components/SearchBar';
import { StatCard, sectionStyles } from '@/components/Sections';
import { MonthlyRecap } from '@/components/MonthlyRecap';
import { HeaderSettingsButton } from '@/components/HeaderSettingsButton';
import { InsightsStrip } from '@/components/InsightsStrip';
import { NetWorthChart } from '@/components/NetWorthChart';
import { FeatureSlots } from '@/features';
import { useT } from '@/hooks/useT';
import { useRouter } from 'expo-router';
import { buildEditPrefill } from '@/utils/prefill';
import {
  useTransactions,
  useDailySpend,
  useMonthTotalsByCategory,
} from '@/hooks/useAppData';
import { catInfo } from '@/constants/categories';
import { useCategoriesWithMeta } from '@/hooks/useAppData';
import { CategoryPicker } from '@/components/CategoryPicker';
import { dayStr, monthKey, formatMoney } from '@/utils/format';
import { kv } from '@/utils/kv';
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
  const [analyticsOpen, setAnalyticsOpen] = useState(false);
  const [recapOpen, setRecapOpen] = useState(false);
  const [pageLimit, setPageLimit] = useState(200);

  // End-of-today as the boundary between Upcoming and history.
  const endOfToday = useMemo(() => {
    const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime();
  }, []);
  const upcomingTxns = useTransactions({
    category: filterCat,
    search: search || undefined,
    halalStatus: halalFilter,
    dateGt: endOfToday,
    limit: 100,
  });
  const txns = useTransactions({
    category: filterCat,
    search: search || undefined,
    halalStatus: halalFilter,
    dateLte: endOfToday,
    limit: pageLimit,
  });
  const reachedLimit = txns.length >= pageLimit;

  const grouped = useMemo(() => {
    const g = new Map<string, typeof txns>();
    txns.forEach((t) => {
      const k = dayStr(t.date);
      const arr = g.get(k) ?? [];
      arr.push(t);
      g.set(k, arr);
    });
    return Array.from(g.entries());
  }, [txns]);

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
        <InsightsStrip />
        <AnalyticsHeader
          currency={currency}
          open={analyticsOpen}
          onToggle={() => setAnalyticsOpen((x) => !x)}
          onShareRecap={() => setRecapOpen(true)}
        />
        <FeatureSlots.ActivityHeaderExtras />
        {grouped.length === 0 && (
          <View style={styles.emptyWrap}>
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
        {/* Upcoming — future-dated transactions. Scheduled but not yet
            executed. Amber tone, slightly dimmed so they read as "not
            yet real" without looking broken. Stays tappable so the
            user can edit / cancel the scheduled item. */}
        {upcomingTxns.length > 0 && (
          <View style={styles.group}>
            <Text style={[styles.dayLabel, styles.upcomingLabel]}>UPCOMING</Text>
            <View style={{ gap: 2, opacity: 0.85 }}>
              {upcomingTxns.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  t={tx}
                  currency={currency}
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
        {grouped.map(([day, ts]) => (
          <View key={day} style={styles.group}>
            <Text style={styles.dayLabel}>{day}</Text>
            <View style={{ gap: 2 }}>
              {ts.map((tx) => (
                <TransactionRow
                  key={tx.id}
                  t={tx}
                  currency={currency}
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

// ---- Collapsible analytics header (formerly More → Analytics sub-tab) ----

function AnalyticsHeader({
  currency,
  open,
  onToggle,
  onShareRecap,
}: {
  currency: CurrencyCode;
  open: boolean;
  onToggle: () => void;
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
  // Avg/Day reads as "what I spend on a typical calendar day this month."
  // Use elapsed calendar days, not days-with-spending — otherwise a user
  // who only spent on 6 of the past 12 days sees a 2× inflated daily
  // average, and "Avg/Day × days-in-month ≠ Total" trust breaks.
  const elapsedDays = Math.max(1, today.getDate());
  const avgDaily = totalSpend / elapsedDays;
  const projected = avgDaily * dim;
  void daily; // strip the now-unused dependency


  return (
    <View style={styles.analytics}>
      <Pressable
        onPress={onToggle}
        style={styles.analyticsHead}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={styles.analyticsTitle}>{t('activity.glance')}</Text>
        <MaterialCommunityIcons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.text2}
        />
      </Pressable>
      {open && (
        <>
          <View style={sectionStyles.statGrid}>
            <StatCard label={t('activity.stat.avgDay')} value={formatMoney(avgDaily, currency)} />
            <StatCard label={t('activity.stat.projected')} value={formatMoney(projected, currency)} />
            <StatCard label={t('activity.stat.total')} value={formatMoney(totalSpend, currency)} />
            <StatCard label={t('activity.stat.categories')} value={String(totals.length)} />
          </View>
          {/* Per-category breakdown lived here in v1. Removed — the
              dedicated Categories view in the segmented control above
              owns this surface now (with month nav + Expense/Income
              toggle + tap-to-filter), and duplicating it inside the
              List view was confusing readers. */}
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
        </>
      )}
    </View>
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
  analytics: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    gap: spacing.md,
  },
  analyticsHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  analyticsTitle: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi },
  group: { gap: spacing.sm },
  dayLabel: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.body, textTransform: 'uppercase' },
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
