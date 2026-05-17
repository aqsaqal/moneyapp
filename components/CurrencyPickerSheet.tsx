// CurrencyPickerSheet — bottom sheet with Main/Other tabs.
// Mirrors the 1money pattern: main currencies up top, full ISO list
// under the second tab. Replaces the long flat list that used to show
// in PickerSheet for currency selection.

import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { useT } from '@/hooks/useT';
import {
  CURRENCIES,
  MAIN_CURRENCIES,
  OTHER_CURRENCIES,
  CRYPTO_CURRENCIES,
  METAL_CURRENCIES,
  type CurrencyCode,
} from '@/constants/currency';

export interface CurrencyPickerSheetProps {
  visible: boolean;
  title?: string;
  selected: CurrencyCode;
  onPick: (code: CurrencyCode) => void;
  onClose: () => void;
}

type Tab = 'main' | 'other' | 'crypto' | 'metals';

export function CurrencyPickerSheet({
  visible,
  title,
  selected,
  onPick,
  onClose,
}: CurrencyPickerSheetProps) {
  const t = useT();
  const [tab, setTab] = useState<Tab>(
    (CURRENCIES[selected]?.tier as Tab) ?? 'main',
  );
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const base =
      tab === 'main' ? MAIN_CURRENCIES
      : tab === 'other' ? OTHER_CURRENCIES
      : tab === 'crypto' ? CRYPTO_CURRENCIES
      : METAL_CURRENCIES;
    if (!query.trim()) return base;
    const q = query.trim().toLowerCase();
    return base.filter((c) => {
      const d = CURRENCIES[c];
      return c.toLowerCase().includes(q) || d.name.toLowerCase().includes(q);
    });
  }, [tab, query]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
            <MaterialCommunityIcons name="close" size={22} color={theme.text2} />
          </Pressable>
          <Text style={styles.title}>{title ?? t('me.currency')}</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.tabsRow}>
          {(['main', 'other', 'crypto', 'metals'] as Tab[]).map((id) => {
            const label =
              id === 'main' ? t('currencyPicker.main')
              : id === 'other' ? t('currencyPicker.other')
              : id === 'crypto' ? t('currencyPicker.crypto')
              : t('currencyPicker.metals');
            return (
              <Pressable
                key={id}
                onPress={() => setTab(id)}
                style={[styles.tab, tab === id && styles.tabActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: tab === id }}
              >
                <Text style={[styles.tabText, tab === id && styles.tabTextActive]} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.searchWrap}>
          <MaterialCommunityIcons name="magnify" size={16} color={theme.text3} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('currencyPicker.search')}
            placeholderTextColor={theme.text3}
            style={styles.search}
            autoCapitalize="characters"
            autoCorrect={false}
          />
        </View>

        <FlatList
          data={list}
          keyExtractor={(c) => c}
          renderItem={({ item }) => {
            const def = CURRENCIES[item];
            const picked = item === selected;
            return (
              <Pressable
                onPress={() => {
                  onPick(item);
                  onClose();
                }}
                style={styles.row}
                accessibilityRole="button"
                accessibilityState={{ selected: picked }}
              >
                <Text style={[styles.rowName, picked && { color: theme.accent }]}>
                  {def.name}
                </Text>
                <Text style={[styles.rowSymbol, picked && { color: theme.accent }]}>
                  {def.symbolNative}
                </Text>
                {picked && (
                  <MaterialCommunityIcons name="check" size={18} color={theme.accent} style={{ marginLeft: 6 }} />
                )}
              </Pressable>
            );
          }}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
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
    top: '15%',
    backgroundColor: theme.bg1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  title: { color: theme.text1, fontSize: sizes.lg, fontFamily: font.displayBold },
  tabsRow: { flexDirection: 'row', paddingHorizontal: spacing.md, gap: 6, marginBottom: spacing.md },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    backgroundColor: theme.bg2,
  },
  tabActive: { backgroundColor: theme.accent, borderColor: 'transparent' },
  tabText: { color: theme.text2, fontSize: sizes.xs },
  tabTextActive: { color: theme.bg, fontFamily: font.bodySemi },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    paddingVertical: 8,
    backgroundColor: theme.bg2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
    marginHorizontal: spacing.md,
  },
  search: {
    flex: 1,
    color: theme.text1,
    fontSize: sizes.sm,
    fontFamily: font.body,
    paddingVertical: 0,
  },
  listContent: { paddingBottom: spacing.xl },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border,
  },
  rowName: { color: theme.text1, fontSize: sizes.md, flex: 1 },
  rowSymbol: { color: theme.text3, fontSize: sizes.md, width: 48, textAlign: 'right' },
});
