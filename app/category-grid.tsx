// Phase 10w fast-entry: long-press the FAB on any tab to land here.
//
// Three-column grid of category cards (icon + name + budget bar). Tap a
// card → /add modal opens with category prefilled, ready for the keypad.
// "+ New category" tile at the end opens the edit sheet for an immediate
// create.

import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import {
  useCategoriesWithMeta,
  useMonthTotalsByCategory,
  type CategoryWithMeta,
} from '@/hooks/useAppData';
import { CustomCategorySheet } from '@/components/CustomCategorySheet';
import { encodePrefill } from '@/utils/prefill';
import { monthKey } from '@/utils/format';
import { useT } from '@/hooks/useT';

export default function CategoryGridScreen() {
  const router = useRouter();
  const t = useT();
  const categories = useCategoriesWithMeta();
  const totals = useMonthTotalsByCategory(monthKey(), 'expense');
  const totalsMap = useMemo(() => new Map(totals.map((tt) => [tt.category, tt.total])), [totals]);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return categories
      .filter(
        (c) =>
          !c.archived &&
          c.id !== 'adjustment' &&
          (c.type === 'expense' || c.type === 'both') &&
          (q === '' || c.name.toLowerCase().includes(q)),
      )
      .sort(
        (a, b) =>
          (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0) ||
          a.sortOrder - b.sortOrder ||
          a.name.localeCompare(b.name),
      );
  }, [categories, query]);

  const pickCategory = (c: CategoryWithMeta) => {
    router.replace({
      pathname: '/add',
      params: {
        prefill: encodePrefill({ type: 'expense', category: c.id }),
      },
    } as never);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t('common.close')}>
          <MaterialCommunityIcons name="close" size={24} color={theme.text1} />
        </Pressable>
        <Text style={styles.title}>Pick category</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.searchWrap}>
        <MaterialCommunityIcons name="magnify" size={18} color={theme.text3} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search…"
          placeholderTextColor={theme.text3}
          style={styles.searchInput}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <ScrollView contentContainerStyle={styles.grid}>
        {filtered.map((c) => {
          const spent = totalsMap.get(c.id) ?? 0;
          const budget = c.monthlyBudget ?? 0;
          const pct = budget > 0 ? Math.min(spent / budget, 1) : 0;
          const over = budget > 0 && spent > budget;
          const warn = !over && budget > 0 && spent / budget >= 0.7 && spent / budget < 0.9;
          const high = !over && budget > 0 && spent / budget >= 0.9;
          const barColor = over || high ? theme.expense : warn ? '#F97316' : '#10B981';
          return (
            <Pressable
              key={c.id}
              onPress={() => pickCategory(c)}
              style={styles.tile}
              accessibilityRole="button"
              accessibilityLabel={
                budget > 0
                  ? `${c.name}, ${Math.round(pct * 100)} percent of budget used`
                  : c.name
              }
            >
              <View style={[styles.tileIcon, { backgroundColor: `${c.color}22` }]}>
                <MaterialCommunityIcons name={(c.icon as never) || 'tag-outline'} size={26} color={c.color} />
              </View>
              <Text style={styles.tileName} numberOfLines={1}>{c.name}</Text>
              {budget > 0 && (
                <View style={styles.tileBar}>
                  <View style={[styles.tileBarFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
                </View>
              )}
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setCreating(true)}
          style={[styles.tile, styles.tileNew]}
          accessibilityRole="button"
          accessibilityLabel="New category"
        >
          <View style={[styles.tileIcon, { backgroundColor: theme.bg3 }]}>
            <MaterialCommunityIcons name="plus" size={26} color={theme.text2} />
          </View>
          <Text style={[styles.tileName, { color: theme.text2 }]}>New</Text>
        </Pressable>
      </ScrollView>

      <CustomCategorySheet
        visible={creating}
        onClose={() => setCreating(false)}
      />
    </SafeAreaView>
  );
}

const TILE_GAP = 10;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { color: theme.text1, fontSize: sizes.xl, fontFamily: font.displayBold },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: spacing.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  searchInput: { flex: 1, color: theme.text1, fontSize: sizes.sm, padding: 0 },
  grid: {
    padding: spacing.lg,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TILE_GAP,
  },
  tile: {
    // 30% × 3 tiles = 90%; remaining 10% absorbs the two horizontal
    // gaps. The earlier `(100 - 6)/3 = 31.3%` math overflowed when
    // gap + paint rounding pushed the row past 100%, collapsing to 2
    // columns on some Android densities.
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
  tileNew: { borderStyle: 'dashed' },
  tileIcon: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  tileName: { color: theme.text1, fontSize: sizes.sm },
  tileBar: {
    width: '80%',
    height: 4,
    backgroundColor: theme.bg3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  tileBarFill: { height: '100%', borderRadius: 2 },
});
