// Phase 10w: dedicated full-screen Categories management surface.
// Now a DraggableFlatList — long-press a row to reorder. Both seeded
// and custom categories participate; reorderCategories upserts a
// custom_categories row when needed so seeded-only ids persist.

import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
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

export default function CategoriesManageScreen() {
  const router = useRouter();
  const t = useT();
  const categories = useCategoriesWithMeta();
  const [editing, setEditing] = useState<CategoryWithMeta | null | undefined>(undefined);
  const [showArchived, setShowArchived] = useState(false);

  // Active set — pinned first, then by sortOrder/name. Adjustment is
  // the bookkeeping system category and never participates in either
  // the list view or reorder.
  const active = categories
    .filter((c) => !c.archived && c.id !== 'adjustment')
    .sort((a, b) => {
      if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
      return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
    });
  const archived = categories.filter((c) => c.archived);

  const hintFor = (c: CategoryWithMeta) => {
    const budgetLabel = c.monthlyBudget != null
      ? `${c.monthlyBudget.toFixed(0)} ${c.budgetCurrency ?? ''}`.trim()
      : c.type === 'income' ? t('categories.type.income')
        : c.type === 'both' ? t('categories.type.both')
        : t('categories.type.expense');
    return (c.isSystem ? `🔒 ${t('categories.system')} · ` : '') + budgetLabel;
  };

  const ListHeader = (
    <View style={{ marginBottom: spacing.sm }}>
      <SectionHeader
        title=""
        onAdd={() => setEditing(null)}
        addLabel={t('common.add')}
      />
    </View>
  );

  const ListFooter = (
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

      <DraggableFlatList
        data={active}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        contentContainerStyle={styles.scroll}
        activationDistance={20}
        onDragEnd={({ data }) => {
          reorderCategories(data.map((c) => c.id));
        }}
        renderItem={({ item: c, drag, isActive }: RenderItemParams<CategoryWithMeta>) => (
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
        )}
      />

      <CustomCategorySheet
        visible={editing !== undefined}
        category={editing ?? undefined}
        onClose={() => setEditing(undefined)}
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
  title: { color: theme.text1, fontSize: sizes.xl, fontFamily: font.displayBold },
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
