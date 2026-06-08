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
import { useCategoriesWithMeta, type CategoryWithMeta } from '@/hooks/useAppData';
import { encodePrefill } from '@/utils/prefill';
import { useT } from '@/hooks/useT';

type Tab = 'expense' | 'income';

export default function CategoryGridScreen() {
  const router = useRouter();
  const t = useT();
  const { width } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);
  const [tab, setTab] = useState<Tab>('expense');
  const [search, setSearch] = useState('');
  const cats = useCategoriesWithMeta();

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
        <Pane width={width} cats={expense} onPick={(c) => pick(c, 'expense')} />
        <Pane width={width} cats={income} onPick={(c) => pick(c, 'income')} />
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
  onPick,
}: {
  width: number;
  cats: CategoryWithMeta[];
  onPick: (c: CategoryWithMeta) => void;
}) {
  return (
    <ScrollView style={{ width }} contentContainerStyle={styles.grid}>
      {cats.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => onPick(c)}
          style={styles.tile}
          accessibilityRole="button"
          accessibilityLabel={c.name}
        >
          <View style={[styles.tileIcon, { backgroundColor: `${c.color}22` }]}>
            <MaterialCommunityIcons name={(c.icon as never) || 'tag-outline'} size={22} color={c.color} />
          </View>
          <Text style={styles.tileName} numberOfLines={1}>{c.name}</Text>
        </Pressable>
      ))}
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
    width: '30%',
    aspectRatio: 1,
    padding: spacing.sm,
    backgroundColor: theme.bg2,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tileIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  tileName: { color: theme.text1, fontSize: sizes.sm },
});
