// Long-press FAB destination → two-pane category picker.
// Top: segmented Expense | Income tabs.
// Body: a horizontal pager (one full-screen grid per type).
// Swipe between panes or tap a tab; tapping a tile routes to /add
// prefilled with the matching transaction type + category.

import React, { useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { useCategoriesWithMeta, useMonthTotalsByCategory, type CategoryWithMeta } from '@/hooks/useAppData';
import { encodePrefill } from '@/utils/prefill';
import { useT } from '@/hooks/useT';
import { monthKey } from '@/utils/format';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { kv } from '@/utils/kv';

type Tab = 'expense' | 'income';

export default function CategoryGridScreen() {
  const router = useRouter();
  const t = useT();
  const { width } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);
  const [tab, setTab] = useState<Tab>('expense');
  const [search, setSearch] = useState('');
  const cats = useCategoriesWithMeta();
  // This-month per-category spend, keyed by category id, used by the
  // tile to show "spent" + (if a budget is set) "spent / budget".
  const monthSpend = useMonthTotalsByCategory(monthKey(), 'expense');
  const spentMap = useMemo(
    () => new Map(monthSpend.map((m) => [m.category, m.total])),
    [monthSpend],
  );
  const displayCcy = (kv.get('currency') ?? 'USD') as CurrencyCode;

  const expense = useMemo(() => filterFor(cats, 'expense', search), [cats, search]);
  const income = useMemo(() => filterFor(cats, 'income', search), [cats, search]);

  const switchTab = (next: Tab) => {
    setTab(next);
    pagerRef.current?.scrollTo({ x: next === 'expense' ? 0 : width, animated: true });
  };

  const onPagerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    const next: Tab = i === 0 ? 'expense' : 'income';
    if (next !== tab) setTab(next);
  };

  const pick = (c: CategoryWithMeta, type: Tab) => {
    router.replace({
      pathname: '/add',
      params: { prefill: encodePrefill({ type, category: c.id }) },
    } as never);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.close')}>
          <MaterialCommunityIcons name="close" size={22} color={theme.text2} />
        </Pressable>
        <Text style={styles.title}>{t('picker.pickCategory')}</Text>
        <View style={{ width: 22 }} />
      </View>

      <View style={styles.tabs}>
        <TabBtn
          label={t('add.expense')}
          active={tab === 'expense'}
          onPress={() => switchTab('expense')}
        />
        <TabBtn
          label={t('add.income')}
          active={tab === 'income'}
          onPress={() => switchTab('income')}
        />
      </View>

      <View style={styles.searchWrap}>
        <MaterialCommunityIcons name="magnify" size={18} color={theme.text3} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder={t('picker.search')}
          placeholderTextColor={theme.text3}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')} hitSlop={8} accessibilityLabel={t('common.close')}>
            <MaterialCommunityIcons name="close-circle" size={18} color={theme.text3} />
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPagerScroll}
        keyboardShouldPersistTaps="handled"
      >
        <Pane width={width} cats={expense} spent={spentMap} currency={displayCcy} onPick={(c) => pick(c, 'expense')} />
        <Pane width={width} cats={income} spent={spentMap} currency={displayCcy} onPick={(c) => pick(c, 'income')} />
      </ScrollView>
    </SafeAreaView>
  );
}

function filterFor(cats: CategoryWithMeta[], type: Tab, q: string): CategoryWithMeta[] {
  const needle = q.trim().toLowerCase();
  return cats
    .filter((c) => !c.archived)
    .filter((c) => c.type === type || c.type === 'both')
    .filter((c) => needle === '' || c.name.toLowerCase().includes(needle))
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
    });
}

function TabBtn({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.tabBtn, active && styles.tabBtnActive]}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Pane({
  width,
  cats,
  spent,
  currency,
  onPick,
}: {
  width: number;
  cats: CategoryWithMeta[];
  spent: Map<string, number>;
  currency: CurrencyCode;
  onPick: (c: CategoryWithMeta) => void;
}) {
  // Pixel-precise 3-column layout: derive tile width from the actual
  // pane width minus horizontal padding (spacing.md ×2) and the two
  // 10px inter-tile gaps. Percent widths drifted because 30% × 3 +
  // 20px gap doesn't quite equal 100% minus the padding.
  const HORIZONTAL_PADDING = spacing.md;
  const GAP = 10;
  const tileWidth = Math.floor((width - HORIZONTAL_PADDING * 2 - GAP * 2) / 3);
  return (
    <ScrollView style={{ width }} contentContainerStyle={styles.grid}>
      {cats.map((c) => {
        const s = spent.get(c.id) ?? 0;
        const budget = c.monthlyBudget ?? null;
        const budgetCcy = (c.budgetCurrency as CurrencyCode | null) ?? currency;
        const pct = budget != null && budget > 0 ? Math.min(s / budget, 1) : 0;
        const over = budget != null && budget > 0 && s > budget;
        const high = !over && budget != null && budget > 0 && pct >= 0.8;
        const barColor = over ? theme.expense : high ? '#F97316' : c.color;
        // Always show the spent amount as the caption (formatMoney(0, ...)
        // for categories with no this-month activity) so every tile has the
        // same vertical footprint and the icon row stays aligned across
        // columns. The progress bar still appears when a budget is set.
        const captionCcy = budget != null && budget > 0 ? budgetCcy : currency;
        const caption = formatMoney(s, captionCcy);
        return (
          <Pressable
            key={c.id}
            onPress={() => onPick(c)}
            style={[styles.tile, { width: tileWidth }]}
            accessibilityRole="button"
            accessibilityLabel={c.name}
          >
            <View style={[styles.tileIcon, { backgroundColor: `${c.color}22` }]}>
              <MaterialCommunityIcons name={(c.icon as never) || 'tag-outline'} size={22} color={c.color} />
            </View>
            <Text style={styles.tileName} numberOfLines={1}>{c.name}</Text>
            <Text
              style={[styles.tileCaption, over && { color: theme.expense }]}
              numberOfLines={1}
            >
              {caption}
            </Text>
            {budget != null && budget > 0 && (
              <View style={styles.tileBar}>
                <View style={[styles.tileBarFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
              </View>
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  title: { color: theme.text1, fontSize: sizes.lg, fontFamily: font.displayBold },
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.md,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  tabBtnActive: { backgroundColor: theme.accent, borderColor: theme.accent },
  tabText: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.bodySemi },
  tabTextActive: { color: theme.bg },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: spacing.md,
  },
  searchInput: { flex: 1, color: theme.text1, fontSize: sizes.sm, padding: 0 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xl,
  },
  tile: {
    // Width is set per-instance from useWindowDimensions so the
    // three columns line up pixel-perfect against the spacing.md
    // horizontal padding + 10px inter-tile gap.
    minHeight: 110,
    padding: spacing.sm,
    backgroundColor: theme.bg2,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.border,
    // Top-anchor every tile so the icon row lines up across columns
    // even when one tile has a caption and its neighbour doesn't.
    // Without this the tiles centre their contents and the icons drift
    // up/down depending on how much text follows them.
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: spacing.md,
    gap: 6,
  },
  tileIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  tileName: { color: theme.text1, fontSize: sizes.sm, textAlign: 'center' },
  tileCaption: { color: theme.text3, fontSize: 10, textAlign: 'center' },
  tileBar: {
    width: '80%', height: 3,
    backgroundColor: theme.bg3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  tileBarFill: { height: '100%', borderRadius: 2 },
});
