// Unified category picker — Phase 10z.
//
// One component, four entry points:
//   1. Budget creation (Plan → "+ Add budget")     → select, excludeWithBudget, +New
//   2. Activity "More" filter expansion             → select, all types, no +New
//   3. Smart Add long-press FAB (full-screen grid) → select, expense, showProgress, +New
//   4. Smart Add chip strip "More…"                → select, expense, showProgress, +New
//
// Plus a future-ready `multi-select` mode that returns an array on Done.
// Card grid is 3 columns, icon + name + optional budget progress bar.
// Pinned categories lead; alphabetical within groups.

import React, { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import {
  useCategoriesWithMeta,
  useMonthTotalsByCategory,
  type CategoryWithMeta,
} from '@/hooks/useAppData';
import { CustomCategorySheet } from '@/components/CustomCategorySheet';
import { monthKey } from '@/utils/format';
import { useT } from '@/hooks/useT';

export type CategoryPickerMode = 'select' | 'multi-select';

export interface CategoryPickerProps {
  visible: boolean;
  /** Single category (default) or array confirmation. */
  mode?: CategoryPickerMode;
  /** Filter to one half of the transaction taxonomy. 'expense' includes
   *  expense+both; 'income' includes income+both. Omit for "all kinds". */
  transactionType?: 'expense' | 'income';
  /** Hide categories that already have a monthly budget — for the
   *  "+ Add budget" flow where this picker should only offer
   *  un-budgeted categories. */
  excludeWithBudget?: boolean;
  /** Render a thin spend-vs-budget bar on each card. Off for budget
   *  creation (the card by definition has no budget yet). On for
   *  selection-during-entry contexts. */
  showBudgetProgress?: boolean;
  /** Show the "+ New category" tile in the grid footer. */
  showAddNew?: boolean;
  /** Defaults to "Pick category". */
  headerText?: string;
  /** Multi-select only: seed the initial selection. */
  initialSelection?: string[];
  /** Single-select callback. Picker closes immediately on tap. */
  onSelect?: (categoryId: string) => void;
  /** Multi-select callback. Fires when the user taps Done. */
  onConfirm?: (selectedIds: string[]) => void;
  onClose: () => void;
}

export function CategoryPicker({
  visible,
  mode = 'select',
  transactionType,
  excludeWithBudget = false,
  showBudgetProgress = false,
  showAddNew = false,
  headerText,
  initialSelection,
  onSelect,
  onConfirm,
  onClose,
}: CategoryPickerProps) {
  const t = useT();
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<Set<string>>(new Set(initialSelection ?? []));
  const [creating, setCreating] = useState(false);

  const categories = useCategoriesWithMeta();
  const monthTotals = useMonthTotalsByCategory(monthKey(), 'expense');
  const totalsMap = useMemo(
    () => new Map(monthTotals.map((m) => [m.category, m.total])),
    [monthTotals],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categories
      .filter((c) => !c.archived)
      .filter((c) => {
        if (!transactionType) return true;
        return c.type === transactionType || c.type === 'both';
      })
      .filter((c) => !excludeWithBudget || c.monthlyBudget == null)
      .filter((c) => q === '' || c.name.toLowerCase().includes(q))
      .sort((a, b) => {
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
      });
  }, [categories, transactionType, excludeWithBudget, search]);

  const handlePick = (c: CategoryWithMeta) => {
    if (mode === 'multi-select') {
      const next = new Set(selection);
      if (next.has(c.id)) next.delete(c.id);
      else next.add(c.id);
      setSelection(next);
      return;
    }
    onSelect?.(c.id);
    onClose();
  };

  const handleDone = () => {
    onConfirm?.(Array.from(selection));
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
            <MaterialCommunityIcons name="close" size={22} color={theme.text2} />
          </Pressable>
          <Text style={styles.title}>{headerText ?? t('picker.pickCategory')}</Text>
          {mode === 'multi-select' ? (
            <Pressable onPress={handleDone} hitSlop={10} accessibilityLabel={t('picker.done')}>
              <Text style={styles.done}>{t('picker.done')}</Text>
            </Pressable>
          ) : (
            <View style={{ width: 22 }} />
          )}
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
          contentContainerStyle={styles.grid}
          keyboardShouldPersistTaps="handled"
        >
          {filtered.map((c) => {
            const spent = totalsMap.get(c.id) ?? 0;
            const budget = c.monthlyBudget ?? 0;
            const pct = budget > 0 ? Math.min(spent / budget, 1) : 0;
            const over = budget > 0 && spent > budget;
            const high = !over && budget > 0 && pct >= 0.9;
            const warn = !over && !high && budget > 0 && pct >= 0.7;
            const barColor = over || high ? theme.expense : warn ? '#F97316' : '#10B981';
            const isSelected = mode === 'multi-select' && selection.has(c.id);
            return (
              <Pressable
                key={c.id}
                onPress={() => handlePick(c)}
                style={[
                  styles.tile,
                  isSelected && { borderColor: c.color, backgroundColor: `${c.color}11` },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={c.name}
              >
                <View style={[styles.tileIcon, { backgroundColor: `${c.color}22` }]}>
                  <MaterialCommunityIcons name={(c.icon as never) || 'tag-outline'} size={22} color={c.color} />
                </View>
                <Text style={styles.tileName} numberOfLines={1}>{c.name}</Text>
                {showBudgetProgress && budget > 0 && (
                  <View style={styles.tileBar}>
                    <View style={[styles.tileBarFill, { width: `${pct * 100}%`, backgroundColor: barColor }]} />
                  </View>
                )}
                {isSelected && (
                  <View style={[styles.checkBadge, { backgroundColor: c.color }]}>
                    <MaterialCommunityIcons name="check" size={12} color={theme.bg} />
                  </View>
                )}
              </Pressable>
            );
          })}
          {showAddNew && (
            <Pressable
              onPress={() => setCreating(true)}
              style={[styles.tile, styles.tileNew]}
              accessibilityRole="button"
              accessibilityLabel={t('category.new')}
            >
              <View style={[styles.tileIcon, { backgroundColor: theme.bg3 }]}>
                <MaterialCommunityIcons name="plus" size={22} color={theme.text2} />
              </View>
              <Text style={[styles.tileName, { color: theme.text2 }]}>{t('common.new')}</Text>
            </Pressable>
          )}
        </ScrollView>

        <CustomCategorySheet
          visible={creating}
          onClose={() => setCreating(false)}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // Fixed-ish height so a filtered list with only 2-3 matches doesn't
    // collapse the sheet to a narrow strip mid-screen. minHeight gives
    // the floor; maxHeight caps growth when the unfiltered list is long.
    minHeight: '78%',
    maxHeight: '92%',
    backgroundColor: theme.bg1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: { color: theme.text1, fontSize: sizes.lg, fontFamily: font.displayBold },
  done: { color: theme.accent, fontSize: sizes.md, fontFamily: font.bodySemi },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    paddingBottom: spacing.lg,
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
  tileNew: { borderStyle: 'dashed' },
  tileIcon: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
  },
  tileName: { color: theme.text1, fontSize: sizes.sm },
  tileBar: {
    width: '80%',
    height: 3,
    backgroundColor: theme.bg3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  tileBarFill: { height: '100%', borderRadius: 2 },
  checkBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
