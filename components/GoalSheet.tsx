// GoalSheet — create / edit / delete a savings goal.
//
// Each goal anchors to an account; progress is the account's current
// balance against `targetAmount`. Anchoring (vs. a separate counter)
// means every transfer/income to the linked account automatically
// advances the goal — no extra "log a contribution" step.

import React, { useEffect, useState } from 'react';

// Lazy-loaded datetimepicker — same trick app/add.tsx uses so the
// native module is only required on platforms that bundle it. Kept at
// module scope so re-renders don't re-import.
type DateTimePickerModule = typeof import('@react-native-community/datetimepicker').default;
let _datePicker: DateTimePickerModule | null = null;
function getDatePicker(): DateTimePickerModule | null {
  if (_datePicker) return _datePicker;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _datePicker = require('@react-native-community/datetimepicker').default as DateTimePickerModule;
  } catch {
    _datePicker = null;
  }
  return _datePicker;
}
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
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
import { SettingRow } from '@/components/Sections';
import { NumpadInputSheet } from '@/components/NumpadInputSheet';
import { PickerSheet, type PickerOption } from '@/components/PickerSheet';
import { upsertGoal, deleteGoal, useAccounts } from '@/hooks/useAppData';
import { useT } from '@/hooks/useT';
import { CurrencyPickerSheet } from '@/components/CurrencyPickerSheet';
import { kv } from '@/utils/kv';
import type { CurrencyCode } from '@/constants/currency';
import type { Goal } from '@/utils/db/schema';

const PALETTE = [
  '#10B981', '#6366F1', '#F59E0B', '#EC4899',
  '#8B5CF6', '#06B6D4', '#EF4444', '#F97316',
];

const ICONS: Array<React.ComponentProps<typeof MaterialCommunityIcons>['name']> = [
  'flag-checkered',
  'airplane-takeoff',
  'home-outline',
  'school-outline',
  'gift-outline',
  'wallet-outline',
  'rocket-launch-outline',
  'shield-check-outline',
];

export interface GoalSheetProps {
  visible: boolean;
  goal?: Goal;
  onClose: () => void;
}

export function GoalSheet({ visible, goal, onClose }: GoalSheetProps) {
  const t = useT();
  const editing = !!goal;
  const accounts = useAccounts();

  const [name, setName] = useState(goal?.name ?? '');
  const [target, setTarget] = useState(String(goal?.targetAmount ?? ''));
  const [numpadOpen, setNumpadOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [accountId, setAccountId] = useState<string>(
    goal?.accountId ?? accounts.find((a) => a.type === 'savings')?.id ?? accounts[0]?.id ?? '',
  );
  const [color, setColor] = useState(goal?.color ?? PALETTE[0]);
  const [icon, setIcon] = useState<string>(goal?.icon ?? ICONS[0]);
  const [targetDate, setTargetDate] = useState(
    goal?.targetDate ? new Date(goal.targetDate).toISOString().slice(0, 10) : '',
  );
  const defaultCurrency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const [currency, setCurrency] = useState<CurrencyCode>(
    (goal?.currency as CurrencyCode | undefined) ?? defaultCurrency,
  );

  const [picker, setPicker] = useState<null | 'account'>(null);
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(goal?.name ?? '');
    setTarget(String(goal?.targetAmount ?? ''));
    setAccountId(
      goal?.accountId ?? accounts.find((a) => a.type === 'savings')?.id ?? accounts[0]?.id ?? '',
    );
    setColor(goal?.color ?? PALETTE[0]);
    setIcon(goal?.icon ?? ICONS[0]);
    setTargetDate(
      goal?.targetDate ? new Date(goal.targetDate).toISOString().slice(0, 10) : '',
    );
    setCurrency((goal?.currency as CurrencyCode | undefined) ?? defaultCurrency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, goal]);

  const acct = accounts.find((a) => a.id === accountId);

  const save = () => {
    const t2 = parseFloat(target.replace(',', '.'));
    if (!name.trim() || !Number.isFinite(t2) || t2 <= 0) {
      Alert.alert(t('common.required'), 'Name + target amount > 0');
      return;
    }
    if (!accountId) {
      Alert.alert(t('common.required'), 'Pick an account to track this goal against.');
      return;
    }
    let parsedDate: number | null = null;
    if (targetDate.trim()) {
      const d = new Date(targetDate);
      if (Number.isNaN(d.getTime())) {
        Alert.alert(t('common.required'), 'Target date must be YYYY-MM-DD or empty.');
        return;
      }
      parsedDate = d.getTime();
    }
    upsertGoal({
      id: goal?.id ?? `g${Date.now()}${Math.floor(Math.random() * 1000)}`,
      name: name.trim(),
      targetAmount: t2,
      targetDate: parsedDate,
      accountId,
      currency,
      color,
      icon,
      createdAt: goal?.createdAt ?? Date.now(),
    });
    onClose();
  };

  const askDelete = () => {
    if (!goal) return;
    Alert.alert(
      t('common.delete') + '?',
      `"${goal.name}" — the goal will be removed. The linked account and its balance are not affected.`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            deleteGoal(goal.id);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
        pointerEvents="box-none"
      >
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
            <MaterialCommunityIcons name="close" size={22} color={theme.text2} />
          </Pressable>
          <Text style={styles.title}>{editing ? t('common.edit') : t('plan.goals.add')}</Text>
          <Pressable onPress={save} hitSlop={10} accessibilityLabel={t('common.save')}>
            <MaterialCommunityIcons name="check" size={22} color={theme.accent} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('profile.field.name')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('plan.goals.namePlaceholder')}
              placeholderTextColor={theme.text3}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('goal.targetAmount')}</Text>
            <Pressable
              onPress={() => setNumpadOpen(true)}
              style={styles.input}
              accessibilityRole="button"
              accessibilityLabel={t('goal.targetAmount')}
            >
              <Text style={[styles.inputText, !target && styles.inputPlaceholder]} numberOfLines={1}>
                {target || '0'}
              </Text>
            </Pressable>
          </View>

          <SettingRow
            label={t('plan.goals.account')}
            hint={acct?.name ?? '—'}
            icon="wallet-outline"
            iconColor={acct?.color ?? theme.text3}
            onPress={() => setPicker('account')}
          />

          <SettingRow
            label={t('recurring.currency')}
            hint={currency}
            icon="currency-usd"
            iconColor={theme.accent}
            onPress={() => setCurrencyPickerOpen(true)}
          />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('plan.goals.targetDate')}</Text>
            <Pressable
              onPress={() => setDatePickerOpen(true)}
              style={styles.input}
              accessibilityRole="button"
              accessibilityLabel={t('plan.goals.targetDate')}
            >
              <Text style={[styles.inputText, !targetDate && styles.inputPlaceholder]} numberOfLines={1}>
                {targetDate
                  ? new Date(targetDate).toLocaleDateString()
                  : t('plan.goals.targetDate.optional')}
              </Text>
            </Pressable>
            {targetDate && (
              <Pressable onPress={() => setTargetDate('')} style={styles.clearDate}>
                <Text style={styles.clearDateText}>{t('common.cancel')}</Text>
              </Pressable>
            )}
          </View>

          {datePickerOpen && (() => {
            const DateTimePicker = getDatePicker();
            if (!DateTimePicker) {
              setDatePickerOpen(false);
              return null;
            }
            const seed = targetDate ? new Date(targetDate) : new Date();
            return (
              <DateTimePicker
                value={seed}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                minimumDate={new Date()}
                locale={(kv.get('locale') ?? 'en-US') as never}
                onChange={(event, selected) => {
                  setDatePickerOpen(false);
                  if (event.type === 'set' && selected) {
                    setTargetDate(selected.toISOString().slice(0, 10));
                  }
                }}
              />
            );
          })()}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('profile.field.color')}</Text>
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
            <Text style={styles.fieldLabel}>{t('profile.field.icon')}</Text>
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

          <PickerSheet
            visible={picker === 'account'}
            title={t('plan.goals.account')}
            options={accounts.map<PickerOption<string>>((a) => ({
              value: a.id,
              label: a.name,
              iconColor: a.color,
              icon: 'wallet-outline',
              hint: a.type,
            }))}
            selected={accountId}
            onPick={setAccountId}
            onClose={() => setPicker(null)}
          />

          <CurrencyPickerSheet
            visible={currencyPickerOpen}
            selected={currency}
            onPick={(c) => setCurrency(c)}
            onClose={() => setCurrencyPickerOpen(false)}
          />
        </ScrollView>

        <NumpadInputSheet
          visible={numpadOpen}
          title={t('goal.targetAmount')}
          initial={parseFloat(target) || null}
          currency={currency as CurrencyCode}
          onSubmit={(v) => { setTarget(String(v)); setNumpadOpen(false); }}
          onClose={() => setNumpadOpen(false)}
        />
      </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  kav: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheet: {
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
  inputText: { color: theme.text1, fontFamily: font.body, fontSize: sizes.md },
  inputPlaceholder: { color: theme.text3 },
  clearDate: { alignSelf: 'flex-end', paddingVertical: 4, paddingHorizontal: 8 },
  clearDateText: { color: theme.text3, fontSize: sizes.xs },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: { borderColor: theme.text1 },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg2,
    alignItems: 'center',
    justifyContent: 'center',
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
