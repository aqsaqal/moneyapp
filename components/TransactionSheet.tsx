// TransactionSheet — edit an existing transaction.
//
// Tap an Activity row → this sheet opens with all fields prefilled. Saving
// calls updateTransaction(), which reconciles account balances if amount /
// type / account changed.
//
// Design echoes RecurringSheet (the v2 pattern): bottom-sheet modal with a
// type pill row, picker rows for category + account, free-text fields for
// amount / note, and a delete affordance.

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
import {
  updateTransaction,
  deleteTransaction,
  useAccounts,
} from '@/hooks/useAppData';
import { allExpenseCategories, allIncomeCategories, catInfo } from '@/constants/categories';
import { useT } from '@/hooks/useT';
import type { Transaction } from '@/utils/db/schema';

type Mode = 'expense' | 'income' | 'transfer';

export interface TransactionSheetProps {
  visible: boolean;
  transaction?: Transaction;
  onClose: () => void;
}

export function TransactionSheet({ visible, transaction, onClose }: TransactionSheetProps) {
  const t = useT();
  const accounts = useAccounts();

  const [type, setType] = useState<Mode>('expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [category, setCategory] = useState<string>('food');
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? 'cash');
  const [toAccountId, setToAccountId] = useState<string>(accounts[1]?.id ?? 'savings');

  const [picker, setPicker] = useState<null | 'type' | 'category' | 'account' | 'toAccount'>(null);

  useEffect(() => {
    if (!visible || !transaction) return;
    setType(transaction.type);
    setAmount(String(transaction.amount));
    setNote(transaction.note ?? '');
    setCategory(transaction.category ?? (transaction.type === 'income' ? 'salary' : 'food'));
    setAccountId(transaction.accountId);
    setToAccountId(transaction.toAccountId ?? accounts[1]?.id ?? 'savings');
  }, [visible, transaction, accounts]);

  if (!transaction) return null;

  const cats = type === 'income' ? allIncomeCategories() : allExpenseCategories();
  const cat = catInfo(category, type === 'income' ? 'income' : 'expense');
  const acct = accounts.find((a) => a.id === accountId);
  const toAcct = accounts.find((a) => a.id === toAccountId);

  const save = () => {
    const amt = parseFloat(amount.replace(',', '.'));
    if (!Number.isFinite(amt) || amt <= 0) {
      Alert.alert(t('common.required'), 'Amount > 0');
      return;
    }
    if (type === 'transfer' && accountId === toAccountId) {
      Alert.alert(t('common.required'), 'From and To accounts must differ.');
      return;
    }
    updateTransaction(transaction.id, {
      type,
      amount: amt,
      note: note.trim() || null,
      category: type === 'transfer' ? null : category,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
    });
    onClose();
  };

  const askDelete = () => {
    Alert.alert(
      t('common.delete') + '?',
      `${transaction.note || cat.name} — this transaction will be removed and account balances adjusted.`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            deleteTransaction(transaction.id);
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
          <Text style={styles.title}>{t('common.edit')}</Text>
          <Pressable onPress={save} hitSlop={10} accessibilityLabel={t('common.save')}>
            <MaterialCommunityIcons name="check" size={22} color={theme.accent} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <SettingRow
            label={t('add.expense').replace(/^./, (c) => c.toUpperCase())}
            hint={t(`add.${type}`)}
            icon={type === 'expense' ? 'arrow-bottom-left' : type === 'income' ? 'arrow-top-right' : 'swap-horizontal'}
            iconColor={type === 'expense' ? theme.expense : type === 'income' ? theme.accent : theme.transfer}
            onPress={() => setPicker('type')}
          />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>AMOUNT</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="numbers-and-punctuation"
              placeholder="0"
              placeholderTextColor={theme.text3}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>NOTE</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder={t('add.notePlaceholder')}
              placeholderTextColor={theme.text3}
              style={styles.input}
            />
          </View>

          {type !== 'transfer' && (
            <SettingRow
              label="Category"
              hint={cat.name}
              icon={cat.icon as never}
              iconColor={cat.color}
              onPress={() => setPicker('category')}
            />
          )}

          <SettingRow
            label={type === 'transfer' ? t('add.transfer.from') : 'Account'}
            hint={acct?.name ?? '—'}
            icon="wallet-outline"
            iconColor={acct?.color ?? theme.text3}
            onPress={() => setPicker('account')}
          />

          {type === 'transfer' && (
            <SettingRow
              label={t('add.transfer.to')}
              hint={toAcct?.name ?? '—'}
              icon="wallet-outline"
              iconColor={toAcct?.color ?? theme.text3}
              onPress={() => setPicker('toAccount')}
            />
          )}

          <Pressable onPress={askDelete} style={styles.deleteRow} accessibilityRole="button">
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.expense} />
            <Text style={styles.deleteText}>{t('common.delete')}</Text>
          </Pressable>

          <PickerSheet
            visible={picker === 'type'}
            title="Type"
            options={[
              { value: 'expense' as const, label: t('add.expense') },
              { value: 'income' as const, label: t('add.income') },
              { value: 'transfer' as const, label: t('add.transfer') },
            ]}
            selected={type}
            onPick={(m) => setType(m as Mode)}
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
            title={type === 'transfer' ? t('add.transfer.from') : 'Account'}
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

          <PickerSheet
            visible={picker === 'toAccount'}
            title={t('add.transfer.to')}
            options={accounts
              .filter((a) => a.id !== accountId)
              .map<PickerOption<string>>((a) => ({
                value: a.id,
                label: a.name,
                iconColor: a.color,
                icon: 'wallet-outline',
              }))}
            selected={toAccountId}
            onPick={setToAccountId}
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
