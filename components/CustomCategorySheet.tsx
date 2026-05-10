// CustomCategorySheet — Phase 10s. Lightweight modal that lets the user
// create / rename / delete a custom expense or income category. Custom
// rows shadow seeded ids in catInfo() and live alongside them in the
// pickers used by Add and the Recurring/Goal sheets.

import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { upsertCustomCategory, deleteCustomCategory } from '@/hooks/useAppData';
import { useT } from '@/hooks/useT';
import type { CustomCategory } from '@/utils/db/schema';

const PALETTE = [
  '#10B981', '#6366F1', '#F59E0B', '#EC4899',
  '#8B5CF6', '#06B6D4', '#EF4444', '#F97316',
  '#34D399', '#FB7185', '#60A5FA', '#A78BFA',
];

const ICONS: Array<React.ComponentProps<typeof MaterialCommunityIcons>['name']> = [
  'tag-outline',
  'food-fork-drink',
  'cart-outline',
  'gas-station',
  'cellphone',
  'gamepad-variant-outline',
  'paw-outline',
  'baby-bottle-outline',
  'briefcase-outline',
  'school-outline',
  'gift-outline',
  'medical-bag',
];

export interface CustomCategorySheetProps {
  visible: boolean;
  category?: CustomCategory;
  onClose: () => void;
}

export function CustomCategorySheet({ visible, category, onClose }: CustomCategorySheetProps) {
  const t = useT();
  const editing = !!category;
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? PALETTE[0]);
  const [icon, setIcon] = useState<string>(category?.icon ?? ICONS[0]);
  const [type, setType] = useState<'expense' | 'income'>(category?.type ?? 'expense');

  useEffect(() => {
    if (!visible) return;
    setName(category?.name ?? '');
    setColor(category?.color ?? PALETTE[0]);
    setIcon(category?.icon ?? ICONS[0]);
    setType(category?.type ?? 'expense');
  }, [visible, category]);

  const save = () => {
    if (!name.trim()) {
      Alert.alert(t('common.required'), 'Name');
      return;
    }
    const id = category?.id ?? `cc${Date.now()}${Math.floor(Math.random() * 1000)}`;
    upsertCustomCategory({
      id,
      name: name.trim(),
      icon,
      color,
      type,
      createdAt: category?.createdAt ?? Date.now(),
    });
    onClose();
  };

  const askDelete = () => {
    if (!category) return;
    Alert.alert(
      t('common.delete') + '?',
      `"${category.name}" will be removed. Past transactions tagged with this category keep their reference.`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            deleteCustomCategory(category.id);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
            <MaterialCommunityIcons name="close" size={22} color={theme.text2} />
          </Pressable>
          <Text style={styles.title}>{editing ? t('common.edit') : 'New category'}</Text>
          <Pressable onPress={save} hitSlop={10} accessibilityLabel={t('common.save')}>
            <MaterialCommunityIcons name="check" size={22} color={theme.accent} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>NAME</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Pets, Side hustle, Charity"
              placeholderTextColor={theme.text3}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>TYPE</Text>
            <View style={styles.typeRow}>
              <Pressable
                onPress={() => setType('expense')}
                style={[styles.typeChip, type === 'expense' && styles.typeChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: type === 'expense' }}
              >
                <Text style={[styles.typeText, type === 'expense' && styles.typeTextActive]}>Expense</Text>
              </Pressable>
              <Pressable
                onPress={() => setType('income')}
                style={[styles.typeChip, type === 'income' && styles.typeChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: type === 'income' }}
              >
                <Text style={[styles.typeText, type === 'income' && styles.typeTextActive]}>Income</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>COLOR</Text>
            <View style={styles.swatchRow}>
              {PALETTE.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
                  accessibilityLabel={c}
                />
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>ICON</Text>
            <View style={styles.iconRow}>
              {ICONS.map((i) => (
                <Pressable
                  key={i}
                  onPress={() => setIcon(i)}
                  style={[
                    styles.iconChip,
                    icon === i && { backgroundColor: `${color}33`, borderColor: color },
                  ]}
                  accessibilityLabel={i}
                >
                  <MaterialCommunityIcons name={i} size={20} color={icon === i ? color : theme.text2} />
                </Pressable>
              ))}
            </View>
          </View>

          {editing && (
            <Pressable onPress={askDelete} style={styles.deleteRow} accessibilityRole="button">
              <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.expense} />
              <Text style={styles.deleteText}>{t('common.delete')}</Text>
            </Pressable>
          )}
        </ScrollView>
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
  scroll: { gap: spacing.md, paddingBottom: spacing.lg },
  field: { gap: 6 },
  fieldLabel: { color: theme.text2, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: theme.bg2,
    color: theme.text1,
    fontFamily: font.body,
    fontSize: sizes.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
    backgroundColor: theme.bg2,
  },
  typeChipActive: { backgroundColor: theme.accent, borderColor: 'transparent' },
  typeText: { color: theme.text2, fontSize: sizes.sm },
  typeTextActive: { color: theme.bg, fontFamily: font.bodySemi },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 2, borderColor: 'transparent',
  },
  swatchActive: { borderColor: theme.text1 },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconChip: {
    width: 44, height: 44, borderRadius: radii.md,
    borderWidth: 1, borderColor: theme.border,
    backgroundColor: theme.bg2,
    alignItems: 'center', justifyContent: 'center',
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  deleteText: { color: theme.expense, fontSize: sizes.sm, fontFamily: font.bodySemi },
});
