// Phase 10w: dedicated full-screen Categories management surface. The
// inline Settings → Categories list got crowded once budgets/pinned/
// archived rows were added, so we link out here from a single row.

import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { SectionHeader, SettingRow } from '@/components/Sections';
import {
  useCategoriesWithMeta,
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

  const visible = categories.filter((c) => (showArchived ? true : !c.archived) && c.id !== 'adjustment');
  const pinned = visible
    .filter((c) => c.isPinned)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const unpinned = visible
    .filter((c) => !c.isPinned)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const archivedCount = categories.filter((c) => c.archived).length;

  const renderRow = (c: CategoryWithMeta) => {
    const budgetLabel = c.monthlyBudget != null
      ? `${c.monthlyBudget.toFixed(0)} ${c.budgetCurrency ?? ''}`.trim()
      : c.type === 'income' ? t('categories.type.income')
        : c.type === 'both' ? t('categories.type.both')
        : t('categories.type.expense');
    const hint =
      (c.isSystem ? `🔒 ${t('categories.system')} · ` : '') +
      (c.archived ? `${t('categories.archived')} · ` : '') +
      budgetLabel;
    return (
      <SettingRow
        key={c.id}
        label={c.name}
        hint={hint}
        icon={c.icon as never}
        iconColor={c.color}
        onPress={() => setEditing(c)}
      />
    );
  };

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
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SectionHeader
          title=""
          onAdd={() => setEditing(null)}
          addLabel={t('common.add')}
        />
        {pinned.length > 0 && (
          <>
            <Text style={styles.subHeading}>{t('categories.pinned')}</Text>
            {pinned.map(renderRow)}
          </>
        )}
        {unpinned.length > 0 && (
          <>
            {pinned.length > 0 && <Text style={styles.subHeading}>{t('categories.all')}</Text>}
            {unpinned.map(renderRow)}
          </>
        )}
        {archivedCount > 0 && (
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
                : t('categories.showArchived', { n: archivedCount })}
            </Text>
          </Pressable>
        )}
        <View style={{ height: 60 }} />
      </ScrollView>
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
  subHeading: {
    color: theme.text3,
    fontSize: 10,
    fontFamily: font.bodySemi,
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    marginBottom: -4,
  },
  archiveToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: spacing.md,
  },
  archiveText: { color: theme.text3, fontSize: sizes.sm },
});
