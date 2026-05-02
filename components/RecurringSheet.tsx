// RecurringSheet — modal form for adding/editing a recurring bill or income.
//
// Fields:
//   Type:       Expense / Income (PickerSheet)
//   Name:       free text
//   Amount:     numeric
//   Category:   PickerSheet from allExpenseCategories / allIncomeCategories
//   Account:    PickerSheet from useAccounts()
//   Day of mo:  numeric 1-31

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
import { SettingRow } from '@/components/Sections';
import { PickerSheet, type PickerOption } from '@/components/PickerSheet';
import { upsertRecurring, deleteRecurring, useAccounts } from '@/hooks/useAppData';
import { allExpenseCategories, allIncomeCategories, catInfo } from '@/constants/categories';
import type { Recurring } from '@/utils/db/schema';

type Mode = 'expense' | 'income';

export interface RecurringSheetProps {
  visible: boolean;
  recurring?: Recurring;
  /** Pre-selected type when creating a new recurring (no `recurring` passed). */
  defaultType?: Mode;
  onClose: () => void;
}

export function RecurringSheet({ visible, recurring, defaultType, onClose }: RecurringSheetProps) {
  const editing = !!recurring;
  const accounts = useAccounts();
  const [type, setType] = useState<Mode>(recurring?.type ?? defaultType ?? 'expense');
  const [name, setName] = useState(recurring?.name ?? '');
  const [amount, setAmount] = useState(String(recurring?.amount ?? ''));
  const [category, setCategory] = useState<string>(recurring?.category ?? 'subs');
  const [accountId, setAccountId] = useState<string>(
    recurring?.accountId ?? accounts[0]?.id ?? 'cash',
  );
  const [day, setDay] = useState(String(recurring?.dayOfMonth ?? 1));

  const [picker, setPicker] = useState<null | 'type' | 'category' | 'account'>(null);

  useEffect(() => {
    if (visible) {
      setType(recurring?.type ?? defaultType ?? 'expense');
      setName(recurring?.name ?? '');
      setAmount(String(recurring?.amount ?? ''));
      setCategory(recurring?.category ?? (defaultType === 'income' ? 'salary' : 'subs'));
      setAccountId(recurring?.accountId ?? accounts[0]?.id ?? 'cash');
      setDay(String(recurring?.dayOfMonth ?? 1));
    }
  }, [visible, recurring, defaultType, accounts]);

  const cats = type === 'expense' ? allExpenseCategories() : allIncomeCategories();
  const cat = catInfo(category, type);
  const acct = accounts.find((a) => a.id === accountId);

  const save = () => {
    const amt = parseFloat(amount.replace(',', '.'));
    const dayNum = parseInt(day, 10);
    if (!name.trim() || !Number.isFinite(amt) || amt <= 0 || !Number.isFinite(dayNum) || dayNum < 1 || dayNum > 31) {
      Alert.alert('Required', 'Name, amount > 0, and a day-of-month between 1 and 31 are required.');
      return;
    }
    upsertRecurring({
      id: recurring?.id ?? `r${Date.now()}`,
      type,
      name: name.trim(),
      amount: amt,
      category,
      accountId,
      dayOfMonth: dayNum,
      icon: cat.icon,
      color: cat.color,
    });
    onClose();
  };

  const askDelete = () => {
    if (!recurring) return;
    Alert.alert(
      'Delete recurring item?',
      `"${recurring.name}" will no longer remind you each month. Past payments stay in your history.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteRecurring(recurring.id);
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
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <MaterialCommunityIcons name="close" size={22} color={theme.text2} />
          </Pressable>
          <Text style={styles.title}>{editing ? 'Edit recurring' : 'New recurring'}</Text>
          <Pressable onPress={save} hitSlop={10} accessibilityLabel="Save">
            <MaterialCommunityIcons name="check" size={22} color={theme.accent} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <SettingRow
            label="Type"
            hint={type === 'expense' ? 'Expense (bill / subscription)' : 'Income (salary / payout)'}
            icon={type === 'expense' ? 'arrow-bottom-left' : 'arrow-top-right'}
            iconColor={type === 'expense' ? theme.expense : theme.accent}
            onPress={() => setPicker('type')}
          />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Netflix, Rent, Salary"
              placeholderTextColor={theme.text3}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Amount</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numbers-and-punctuation"
              placeholder="0"
              placeholderTextColor={theme.text3}
              style={styles.input}
            />
          </View>

          <SettingRow
            label="Category"
            hint={cat.name}
            icon={cat.icon as never}
            iconColor={cat.color}
            onPress={() => setPicker('category')}
          />

          <SettingRow
            label="Account"
            hint={acct?.name ?? 'pick'}
            icon="wallet-outline"
            iconColor={acct?.color ?? theme.text3}
            onPress={() => setPicker('account')}
          />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Day of month</Text>
            <TextInput
              value={day}
              onChangeText={setDay}
              keyboardType="number-pad"
              placeholder="1"
              placeholderTextColor={theme.text3}
              style={styles.input}
            />
          </View>

          {editing && (
            <Pressable onPress={askDelete} style={styles.deleteRow} accessibilityRole="button">
              <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.expense} />
              <Text style={styles.deleteText}>Delete recurring</Text>
            </Pressable>
          )}

          <PickerSheet
            visible={picker === 'type'}
            title="Type"
            options={[
              { value: 'expense' as const, label: 'Expense (bill / subscription)' },
              { value: 'income' as const, label: 'Income (salary / payout)' },
            ]}
            selected={type}
            onPick={setType}
            onClose={() => setPicker(null)}
          />

          <PickerSheet
            visible={picker === 'category'}
            title="Category"
            options={cats.map<PickerOption<string>>((c) => ({
              value: c.id,
              label: c.name,
              iconColor: c.color,
            }))}
            selected={category}
            onPick={setCategory}
            onClose={() => setPicker(null)}
          />

          <PickerSheet
            visible={picker === 'account'}
            title="Account"
            options={accounts.map<PickerOption<string>>((a) => ({
              value: a.id,
              label: a.name,
              iconColor: a.color,
              icon: 'wallet-outline',
            }))}
            selected={accountId}
            onPick={setAccountId}
            onClose={() => setPicker(null)}
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
