// DebtSheet — create / edit / delete a tracked liability.

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
import { upsertDebt, deleteDebt, useAccounts } from '@/hooks/useAppData';
import { SettingRow } from '@/components/Sections';
import { PickerSheet, type PickerOption } from '@/components/PickerSheet';
import { CurrencyPickerSheet } from '@/components/CurrencyPickerSheet';
import { kv } from '@/utils/kv';
import { useT } from '@/hooks/useT';
import type { CurrencyCode } from '@/constants/currency';
import type { Debt } from '@/utils/db/schema';

const PALETTE = [
  '#EF4444', '#F97316', '#EAB308', '#10B981',
  '#06B6D4', '#6366F1', '#8B5CF6', '#EC4899',
];

const ICONS: Array<React.ComponentProps<typeof MaterialCommunityIcons>['name']> = [
  'credit-card-outline',
  'home-outline',
  'school-outline',
  'car-outline',
  'medical-bag',
  'cash-multiple',
  'currency-usd',
  'alert-octagon-outline',
];

export interface DebtSheetProps {
  visible: boolean;
  debt?: Debt;
  onClose: () => void;
}

export function DebtSheet({ visible, debt, onClose }: DebtSheetProps) {
  const t = useT();
  const editing = !!debt;
  const accounts = useAccounts();
  const [name, setName] = useState(debt?.name ?? '');
  const [balance, setBalance] = useState(String(debt?.balance ?? ''));
  const [apr, setApr] = useState(String(debt?.apr ?? ''));
  const [minPayment, setMinPayment] = useState(String(debt?.minPayment ?? ''));
  const [color, setColor] = useState(debt?.color ?? PALETTE[0]);
  const [icon, setIcon] = useState<string>(debt?.icon ?? ICONS[0]);
  const [accountId, setAccountId] = useState<string | null>(debt?.accountId ?? null);
  const [accountPicker, setAccountPicker] = useState(false);
  const defaultCurrency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const [currency, setCurrency] = useState<CurrencyCode>(
    (debt?.currency as CurrencyCode | undefined) ?? defaultCurrency,
  );
  const [currencyPickerOpen, setCurrencyPickerOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(debt?.name ?? '');
    setBalance(String(debt?.balance ?? ''));
    setApr(String(debt?.apr ?? ''));
    setMinPayment(String(debt?.minPayment ?? ''));
    setColor(debt?.color ?? PALETTE[0]);
    setIcon(debt?.icon ?? ICONS[0]);
    setAccountId(debt?.accountId ?? null);
    setCurrency((debt?.currency as CurrencyCode | undefined) ?? defaultCurrency);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, debt]);

  const linkedAcct = accountId ? accounts.find((a) => a.id === accountId) : null;

  const save = () => {
    const b = parseFloat(balance.replace(',', '.'));
    const a = parseFloat(apr.replace(',', '.'));
    const m = parseFloat(minPayment.replace(',', '.'));
    if (!name.trim() || !Number.isFinite(b) || b <= 0 || !Number.isFinite(a) || a < 0 || !Number.isFinite(m) || m < 0) {
      Alert.alert(t('common.required'), 'Name + balance + APR + min payment');
      return;
    }
    upsertDebt({
      id: debt?.id ?? `d${Date.now()}${Math.floor(Math.random() * 1000)}`,
      name: name.trim(),
      balance: b,
      apr: a,
      minPayment: m,
      accountId,
      currency,
      color,
      icon,
      createdAt: debt?.createdAt ?? Date.now(),
    });
    onClose();
  };

  const askDelete = () => {
    if (!debt) return;
    Alert.alert(
      t('common.delete') + '?',
      `"${debt.name}" — the debt will stop appearing in your tracker.`,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            deleteDebt(debt.id);
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
          <Text style={styles.title}>{editing ? t('common.edit') : t('plan.debts.add')}</Text>
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
              placeholder={t('plan.debts.namePlaceholder')}
              placeholderTextColor={theme.text3}
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>BALANCE</Text>
            <TextInput
              value={balance}
              onChangeText={setBalance}
              keyboardType="numbers-and-punctuation"
              placeholder="0"
              placeholderTextColor={theme.text3}
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>APR (%)</Text>
            <TextInput
              value={apr}
              onChangeText={setApr}
              keyboardType="numbers-and-punctuation"
              placeholder="e.g. 18.99"
              placeholderTextColor={theme.text3}
              style={styles.input}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>MIN PAYMENT / MONTH</Text>
            <TextInput
              value={minPayment}
              onChangeText={setMinPayment}
              keyboardType="numbers-and-punctuation"
              placeholder="0"
              placeholderTextColor={theme.text3}
              style={styles.input}
            />
          </View>

          <SettingRow
            label="Linked account (optional)"
            hint={linkedAcct ? `${linkedAcct.name} — transfers auto-update balance` : 'Manual balance only'}
            icon="link-variant"
            iconColor={linkedAcct?.color ?? theme.text3}
            onPress={() => setAccountPicker(true)}
          />

          <SettingRow
            label="Currency"
            hint={currency}
            icon="currency-usd"
            iconColor={theme.accent}
            onPress={() => setCurrencyPickerOpen(true)}
          />

          <PickerSheet
            visible={accountPicker}
            title="Linked account"
            options={[
              { value: '', label: 'None — track manually', icon: 'link-variant-off' },
              ...accounts.map<PickerOption<string>>((a) => ({
                value: a.id,
                label: a.name,
                hint: a.type,
                iconColor: a.color,
                icon: 'wallet-outline',
              })),
            ]}
            selected={accountId ?? ''}
            onPick={(id) => setAccountId(id || null)}
            onClose={() => setAccountPicker(false)}
          />
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

          <CurrencyPickerSheet
            visible={currencyPickerOpen}
            selected={currency}
            onPick={(c) => setCurrency(c)}
            onClose={() => setCurrencyPickerOpen(false)}
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
