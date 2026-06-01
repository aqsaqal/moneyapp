// CustomCategorySheet — Phase 10s. Phase 10w extends this into the
// canonical edit modal for ANY category — seeded ('food', 'transport',
// …) or user-created. Fields: name, type, color, icon, monthly budget +
// currency, rollover, pin, archive. Seeded categories that the user
// edits get an override row in custom_categories; their displayed
// metadata then comes from that row.

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
import {
  setCategoryMeta,
  categoryTxnCount,
  type CategoryWithMeta,
} from '@/hooks/useAppData';
import { useT } from '@/hooks/useT';
import { CurrencyPickerSheet } from '@/components/CurrencyPickerSheet';
import { kv } from '@/utils/kv';
import type { CurrencyCode } from '@/constants/currency';

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
  /** Pass a CategoryWithMeta to edit any category (seeded or custom),
   *  or omit to create a brand new one. */
  category?: CategoryWithMeta;
  onClose: () => void;
}

export function CustomCategorySheet({ visible, category, onClose }: CustomCategorySheetProps) {
  const t = useT();
  const editing = !!category;
  const defaultCurrency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const [name, setName] = useState(category?.name ?? '');
  const [color, setColor] = useState(category?.color ?? PALETTE[0]);
  const [icon, setIcon] = useState<string>(category?.icon ?? ICONS[0]);
  const [type, setType] = useState<'expense' | 'income' | 'both'>(category?.type ?? 'expense');
  const [budget, setBudget] = useState<string>(
    category?.monthlyBudget != null ? String(category.monthlyBudget) : '',
  );
  const [budgetCurrency, setBudgetCurrency] = useState<CurrencyCode>(
    (category?.budgetCurrency as CurrencyCode | undefined) ?? defaultCurrency,
  );
  const [rollover, setRollover] = useState<boolean>(category?.rolloverEnabled ?? false);
  const [pinned, setPinned] = useState<boolean>(category?.isPinned ?? false);
  const [archived, setArchived] = useState<boolean>(category?.archived ?? false);
  const [currencyPicker, setCurrencyPicker] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(category?.name ?? '');
    setColor(category?.color ?? PALETTE[0]);
    setIcon(category?.icon ?? ICONS[0]);
    setType(category?.type ?? 'expense');
    setBudget(category?.monthlyBudget != null ? String(category.monthlyBudget) : '');
    setBudgetCurrency((category?.budgetCurrency as CurrencyCode | undefined) ?? defaultCurrency);
    setRollover(category?.rolloverEnabled ?? false);
    setPinned(category?.isPinned ?? false);
    setArchived(category?.archived ?? false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, category]);

  const save = () => {
    if (!name.trim()) {
      Alert.alert(t('common.required'), t('category.nameRequired'));
      return;
    }
    const id = category?.id ?? `cc${Date.now()}${Math.floor(Math.random() * 1000)}`;
    const budgetNum = budget.trim() ? parseFloat(budget.replace(',', '.')) : null;
    setCategoryMeta(id, {
      name: name.trim(),
      icon,
      color,
      type,
      monthlyBudget: budgetNum != null && Number.isFinite(budgetNum) && budgetNum > 0 ? budgetNum : null,
      budgetCurrency:
        budgetNum != null && Number.isFinite(budgetNum) && budgetNum > 0 ? budgetCurrency : null,
      rolloverEnabled: rollover,
      isPinned: pinned,
      archived,
    });
    onClose();
  };

  const askDelete = () => {
    if (!category) return;
    if (category.isSystem) {
      Alert.alert(t('category.system.title'), t('category.system.body', { name: category.name }));
      return;
    }
    const count = categoryTxnCount(category.id);
    if (count > 0) {
      Alert.alert(
        t('category.archiveInstead.title'),
        t('category.archiveInstead.body', { name: category.name, count }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('category.archive.cta'),
            onPress: () => {
              setCategoryMeta(category.id, { archived: true });
              onClose();
            },
          },
        ],
      );
      return;
    }
    Alert.alert(
      t('common.delete') + '?',
      t('category.deleteBody', { name: category.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            // Hard-delete the override row; seeded fallback (if any)
            // continues to live in code.
            setCategoryMeta(category.id, { archived: true });
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
          <Text style={styles.title}>{editing ? t('category.edit') : t('category.new')}</Text>
          <Pressable onPress={save} hitSlop={10} accessibilityLabel={t('common.save')}>
            <MaterialCommunityIcons name="check" size={22} color={theme.accent} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('category.field.name')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('category.namePlaceholder')}
              placeholderTextColor={theme.text3}
              style={styles.input}
              editable={!category?.isSystem}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('category.field.type')}</Text>
            <View style={styles.typeRow}>
              {(['expense', 'income', 'both'] as const).map((t2) => (
                <Pressable
                  key={t2}
                  onPress={() => setType(t2)}
                  style={[styles.typeChip, type === t2 && styles.typeChipActive]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: type === t2 }}
                >
                  <Text style={[styles.typeText, type === t2 && styles.typeTextActive]}>
                    {t2 === 'expense' ? t('categories.type.expense') : t2 === 'income' ? t('categories.type.income') : t('categories.type.both')}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('category.field.budget')}</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                value={budget}
                onChangeText={setBudget}
                keyboardType="numbers-and-punctuation"
                placeholder="0"
                placeholderTextColor={theme.text3}
                style={[styles.input, { flex: 1 }]}
              />
              <Pressable
                onPress={() => setCurrencyPicker(true)}
                style={styles.currencyChip}
                accessibilityRole="button"
                accessibilityLabel={`Budget currency ${budgetCurrency}, tap to change`}
              >
                <Text style={styles.currencyChipText}>{budgetCurrency}</Text>
                <MaterialCommunityIcons name="chevron-down" size={14} color={theme.text2} />
              </Pressable>
            </View>
            {budget.trim() && Number.isFinite(parseFloat(budget)) && parseFloat(budget) > 0 && (
              <Text style={styles.fieldHint}>
                {t('category.budgetCurrencyLock')}
              </Text>
            )}
          </View>

          {budget.trim() && Number.isFinite(parseFloat(budget)) && parseFloat(budget) > 0 && (
            <Pressable
              onPress={() => setRollover((v) => !v)}
              style={styles.toggleRow}
              accessibilityRole="switch"
              accessibilityState={{ checked: rollover }}
            >
              <MaterialCommunityIcons
                name="rotate-right"
                size={18}
                color={rollover ? theme.accent : theme.text2}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>{t('category.rollover.label')}</Text>
                <Text style={styles.toggleHint}>
                  {t('category.rollover.hint')}
                </Text>
              </View>
              <View style={[styles.toggle, rollover && { backgroundColor: theme.accent }]}>
                <View style={[styles.toggleKnob, rollover && { transform: [{ translateX: 18 }] }]} />
              </View>
            </Pressable>
          )}

          {editing && (
            <>
              <Pressable
                onPress={() => setPinned((v) => !v)}
                style={styles.toggleRow}
                accessibilityRole="switch"
                accessibilityState={{ checked: pinned }}
              >
                <MaterialCommunityIcons
                  name="pin"
                  size={18}
                  color={pinned ? theme.accent : theme.text2}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>{t('category.pin.label')}</Text>
                  <Text style={styles.toggleHint}>
                    {t('category.pin.hint')}
                  </Text>
                </View>
                <View style={[styles.toggle, pinned && { backgroundColor: theme.accent }]}>
                  <View style={[styles.toggleKnob, pinned && { transform: [{ translateX: 18 }] }]} />
                </View>
              </Pressable>

              <Pressable
                onPress={() => setArchived((v) => !v)}
                style={styles.toggleRow}
                accessibilityRole="switch"
                accessibilityState={{ checked: archived }}
              >
                <MaterialCommunityIcons
                  name="archive-outline"
                  size={18}
                  color={archived ? theme.warning : theme.text2}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>{t('category.archive.label')}</Text>
                  <Text style={styles.toggleHint}>
                    {t('category.archive.hint')}
                  </Text>
                </View>
                <View style={[styles.toggle, archived && { backgroundColor: theme.warning }]}>
                  <View style={[styles.toggleKnob, archived && { transform: [{ translateX: 18 }] }]} />
                </View>
              </Pressable>
            </>
          )}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('category.field.color')}</Text>
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
            <Text style={styles.fieldLabel}>{t('category.field.icon')}</Text>
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

          {editing && !category?.isSystem && (
            <Pressable onPress={askDelete} style={styles.deleteRow} accessibilityRole="button">
              <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.expense} />
              <Text style={styles.deleteText}>{t('common.delete')}</Text>
            </Pressable>
          )}

          <CurrencyPickerSheet
            visible={currencyPicker}
            title={t('category.budgetCurrencyPicker')}
            selected={budgetCurrency}
            onPick={setBudgetCurrency}
            onClose={() => setCurrencyPicker(false)}
          />
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
  fieldHint: { color: theme.text3, fontSize: sizes.xs, fontStyle: 'italic' },
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
  currencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg2,
  },
  currencyChipText: { color: theme.text1, fontSize: 13, fontFamily: font.bodySemi },
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
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  toggleLabel: { color: theme.text1, fontSize: sizes.md },
  toggleHint: { color: theme.text3, fontSize: sizes.xs, marginTop: 2 },
  toggle: { width: 40, height: 22, borderRadius: 11, padding: 2, backgroundColor: theme.bg3, justifyContent: 'center' },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: theme.text1 },
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
