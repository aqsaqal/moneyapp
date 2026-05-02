// AccountSheet — modal form for adding/editing an account.
//
// Fields:
//   Type:      Cash / Bank / Credit / Savings / Debt   (PickerSheet)
//   Name:      free text
//   Balance:   numeric (signed; debt accounts default negative)
//   Limit:     numeric, only for type='credit'
//   Color:     8 preset accent colors

import React, { useEffect, useMemo, useState } from 'react';
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
import { upsertAccount, deleteAccount } from '@/hooks/useAppData';
import type { Account } from '@/utils/db/schema';

export type AccountType = 'cash' | 'bank' | 'credit' | 'savings' | 'debt';

const TYPES: { value: AccountType; label: string; icon: string; defaultColor: string }[] = [
  { value: 'cash', label: 'Cash', icon: 'Wallet', defaultColor: '#00E09E' },
  { value: 'bank', label: 'Bank', icon: 'Banknote', defaultColor: '#818CF8' },
  { value: 'credit', label: 'Credit Card', icon: 'CreditCard', defaultColor: '#FF6B8A' },
  { value: 'savings', label: 'Savings', icon: 'PiggyBank', defaultColor: '#FFBE44' },
  { value: 'debt', label: 'Debt / Loan', icon: 'CreditCard', defaultColor: '#F472B6' },
];

const PALETTE = [
  '#00E09E', '#818CF8', '#FF6B8A', '#FFBE44',
  '#F472B6', '#34D399', '#60A5FA', '#A78BFA',
];

export interface AccountSheetProps {
  visible: boolean;
  /** When editing, pass the existing Account; when creating, omit. */
  account?: Account;
  onClose: () => void;
}

export function AccountSheet({ visible, account, onClose }: AccountSheetProps) {
  const editing = !!account;
  const [type, setType] = useState<AccountType>(account?.type ?? 'cash');
  const [name, setName] = useState(account?.name ?? '');
  const [balance, setBalance] = useState(String(account?.balance ?? ''));
  const [limit, setLimit] = useState(String(account?.creditLimit ?? ''));
  const [color, setColor] = useState(account?.color ?? '#00E09E');
  const [typePicker, setTypePicker] = useState(false);

  // Reset form when the sheet opens for a different account.
  useEffect(() => {
    if (visible) {
      setType(account?.type ?? 'cash');
      setName(account?.name ?? '');
      setBalance(String(account?.balance ?? ''));
      setLimit(String(account?.creditLimit ?? ''));
      setColor(account?.color ?? TYPES.find((t) => t.value === (account?.type ?? 'cash'))!.defaultColor);
    }
  }, [visible, account]);

  const typeMeta = useMemo(() => TYPES.find((t) => t.value === type)!, [type]);

  const save = () => {
    const balanceNum = parseFloat(balance.replace(',', '.'));
    if (!name.trim() || !Number.isFinite(balanceNum)) {
      Alert.alert('Required', 'Name and a valid balance are required.');
      return;
    }
    const id = account?.id ?? `acct_${Date.now()}`;
    upsertAccount({
      id,
      name: name.trim(),
      type,
      balance: balanceNum,
      creditLimit: type === 'credit' ? parseFloat(limit) || null : null,
      icon: typeMeta.icon,
      color,
      sortOrder: account?.sortOrder ?? Date.now(),
    });
    onClose();
  };

  const askDelete = () => {
    if (!account) return;
    Alert.alert(
      'Delete account?',
      `Existing transactions on "${account.name}" will keep their reference but the account row will be removed. You can re-create it later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteAccount(account.id);
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
          <Text style={styles.title}>{editing ? 'Edit account' : 'New account'}</Text>
          <Pressable onPress={save} hitSlop={10} accessibilityLabel="Save">
            <MaterialCommunityIcons name="check" size={22} color={theme.accent} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <SettingRow
            label="Type"
            hint={typeMeta.label}
            icon="shape-outline"
            onPress={() => setTypePicker(true)}
          />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Main Bank"
              placeholderTextColor={theme.text3}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              {type === 'debt' ? 'Amount owed (will be stored as negative)' : 'Current balance'}
            </Text>
            <TextInput
              value={balance}
              onChangeText={setBalance}
              keyboardType="numbers-and-punctuation"
              placeholder="0"
              placeholderTextColor={theme.text3}
              style={styles.input}
            />
          </View>

          {type === 'credit' && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Credit limit</Text>
              <TextInput
                value={limit}
                onChangeText={setLimit}
                keyboardType="numbers-and-punctuation"
                placeholder="0"
                placeholderTextColor={theme.text3}
                style={styles.input}
              />
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Color</Text>
            <View style={styles.palette}>
              {PALETTE.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setColor(c)}
                  style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchSel]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: color === c }}
                  accessibilityLabel={`Color ${c}`}
                />
              ))}
            </View>
          </View>

          {editing && (
            <Pressable onPress={askDelete} style={styles.deleteRow} accessibilityRole="button">
              <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.expense} />
              <Text style={styles.deleteText}>Delete account</Text>
            </Pressable>
          )}

          <PickerSheet
            visible={typePicker}
            title="Account type"
            options={TYPES.map<PickerOption<AccountType>>((t) => ({
              value: t.value,
              label: t.label,
            }))}
            selected={type}
            onPick={(t) => {
              setType(t);
              // Update the color to the type's default if user hasn't customized.
              const oldDefault = TYPES.find((x) => x.value === type)?.defaultColor;
              if (color === oldDefault) {
                setColor(TYPES.find((x) => x.value === t)!.defaultColor);
              }
            }}
            onClose={() => setTypePicker(false)}
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
  palette: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
  swatchSel: { borderColor: theme.text1 },
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
