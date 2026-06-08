// Categories management — two-tab swipeable view (Expense | Income).
// Each tab is its own DraggableFlatList; long-press a row to drag and
// reorder within that type. Drag reorders only the visible tab's IDs
// so the two types maintain independent sort_order sequences.

import React, { useMemo, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { SectionHeader } from '@/components/Sections';
import {
  useCategoriesWithMeta,
  reorderCategories,
  type CategoryWithMeta,
} from '@/hooks/useAppData';
import { CustomCategorySheet } from '@/components/CustomCategorySheet';
import { useT } from '@/hooks/useT';

type Tab = 'expense' | 'income';

export default function CategoriesManageScreen() {
  const router = useRouter();
  const t = useT();
  const { width } = useWindowDimensions();
  const pagerRef = useRef<ScrollView>(null);
  const categories = useCategoriesWithMeta();
  const [editing, setEditing] = useState<CategoryWithMeta | null | undefined>(undefined);
  const [showArchived, setShowArchived] = useState(false);
  const [tab, setTab] = useState<Tab>('expense');

  // Active set partitioned by type. 'both' (e.g. adjustment, gift)
  // shows up in BOTH tabs so the user can pin / reorder it relative
  // to either side. Adjustment is the bookkeeping system row and is
  // hidden from this management surface entirely.
  const partition = useMemo(() => {
    const visible = categories.filter((c) => !c.archived && c.id !== 'adjustment');
    const sorter = (a: CategoryWithMeta, b: CategoryWithMeta) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
    };
    return {
      expense: visible.filter((c) => c.type === 'expense' || c.type === 'both').sort(sorter),
      income: visible.filter((c) => c.type === 'income' || c.type === 'both').sort(sorter),
    };
  }, [categories]);

  const archived = categories.filter((c) => c.archived);

  const hintFor = (c: CategoryWithMeta) => {
    const budgetLabel = c.monthlyBudget != null
      ? `${c.monthlyBudget.toFixed(0)} ${c.budgetCurrency ?? ''}`.trim()
      : c.type === 'income' ? t('categories.type.income')
        : c.type === 'both' ? t('categories.type.both')
        : t('categories.type.expense');
    return (c.isSystem ? `🔒 ${t('categories.system')} · ` : '') + budgetLabel;
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    pagerRef.current?.scrollTo({ x: next === 'expense' ? 0 : width, animated: true });
  };

  const onPagerScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    const next: Tab = i === 0 ? 'expense' : 'income';
    if (next !== tab) setTab(next);
  };

  const Header = (
    <View style={{ marginBottom: spacing.sm }}>
      <SectionHeader
        title=""
        onAdd={() => setEditing(null)}
        addLabel={t('common.add')}
      />
    </View>
  );

  const Footer = (
    <View style={{ marginTop: spacing.md }}>
      {archived.length > 0 && (
        <Pressable
          onPress={() => setShowArchived((v) => !v)}
          style={styles.archiveToggle}
          accessibilityRole="button"
        >
          <MaterialCommunityIcons
            name={showArchived ? 'eye-off-outline' : 'archive-outline'}
            size={16}
            color={theme.text3}
          />
          <Text style={styles.archiveText}>
            {showArchived
              ? t('categories.hideArchived')
              : t('categories.showArchived', { n: archived.length })}
          </Text>
        </Pressable>
      )}
      {showArchived && archived.map((c) => (
        <Pressable
          key={c.id}
          onPress={() => setEditing(c)}
          style={[styles.row, styles.rowDimmed]}
        >
          <View style={[styles.iconBox, { backgroundColor: `${c.color}22` }]}>
            <MaterialCommunityIcons name={c.icon as never} size={20} color={c.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.label}>{c.name}</Text>
            <Text style={styles.hint}>{`${t('categories.archived')} · ${hintFor(c)}`}</Text>
          </View>
        </Pressable>
      ))}
      <View style={{ height: 60 }} />
    </View>
  );

  const renderItem = ({ item: c, drag, isActive }: RenderItemParams<CategoryWithMeta>) => (
    <ScaleDecorator activeScale={1.02}>
      <Pressable
        onPress={() => setEditing(c)}
        onLongPress={drag}
        delayLongPress={300}
        style={[styles.row, isActive && { borderColor: theme.accent }]}
        accessibilityRole="button"
        accessibilityLabel={`${c.name}, ${hintFor(c)}, long-press to reorder`}
      >
        <View style={[styles.iconBox, { backgroundColor: `${c.color}22` }]}>
          <MaterialCommunityIcons name={c.icon as never} size={20} color={c.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={styles.label}>{c.name}</Text>
            {c.isPinned && (
              <MaterialCommunityIcons name="pin" size={12} color={theme.text3} />
            )}
          </View>
          <Text style={styles.hint}>{hintFor(c)}</Text>
        </View>
        <MaterialCommunityIcons name="drag" size={20} color={theme.text3} />
      </Pressable>
    </ScaleDecorator>
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel={t('common.close')}
        >
          <MaterialCommunityIcons name="close" size={24} color={theme.text1} />
        </Pressable>
        <Text style={styles.title}>{t('settings.categories.title')}</Text>
        <View style={{ width: 24 }} />
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

      <ScrollView
        ref={pagerRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onPagerScroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ width }}>
          <DraggableFlatList
            data={partition.expense}
            keyExtractor={(c) => c.id}
            ListHeaderComponent={Header}
            ListFooterComponent={tab === 'expense' ? Footer : undefined}
            contentContainerStyle={styles.scroll}
            activationDistance={20}
            onDragEnd={({ data }) => {
              reorderCategories(data.map((c) => c.id));
            }}
            renderItem={renderItem}
          />
        </View>
        <View style={{ width }}>
          <DraggableFlatList
            data={partition.income}
            keyExtractor={(c) => c.id}
            ListHeaderComponent={Header}
            ListFooterComponent={tab === 'income' ? Footer : undefined}
            contentContainerStyle={styles.scroll}
            activationDistance={20}
            onDragEnd={({ data }) => {
              reorderCategories(data.map((c) => c.id));
            }}
            renderItem={renderItem}
          />
        </View>
      </ScrollView>

      <CustomCategorySheet
        visible={editing !== undefined}
        category={editing ?? undefined}
        onClose={() => setEditing(undefined)}
      />
    </SafeAreaView>
  );
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
  tabs: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
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
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: theme.bg2,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: spacing.sm,
  },
  rowDimmed: { opacity: 0.6 },
  iconBox: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi },
  hint: { color: theme.text3, fontSize: sizes.sm, marginTop: 2 },
  archiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: spacing.md,
  },
  archiveText: { color: theme.text3, fontSize: sizes.sm },
});
