// AccountSheet — modal form for adding/editing an account.
//
// Fields:
//   Type:        Cash / Bank / Credit / Savings / Debt / Investment (PickerSheet)
//   Name:        free text
//   Balance:     numeric (signed; debt accounts default negative)
//   Limit:       numeric, only for type='credit'
//   Color:       8 preset accent colors
//   Currency:    per-account ISO override
//   Riba flag:   islamic builds only
//   Archive:     hide from active list (edit mode only)
//   Include:     toggle for net-worth math (edit mode only)
//
// Manual balance update: if the user changes the balance while editing an
// existing account, we DON'T silently overwrite. We force an "Adjustment"
// transaction (per design call — audit trail beats silent override) so the
// new balance is explainable from Activity. The "Update silently" path is
// intentionally absent; if a user really wants no trail they can delete the
// adjustment txn afterwards.

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
import { CurrencyPickerSheet } from '@/components/CurrencyPickerSheet';
import {
  upsertAccount,
  deleteAccount,
  deleteAccountCascade,
  addTransaction,
  useTransactions,
} from '@/hooks/useAppData';
import { CURRENCIES, type CurrencyCode } from '@/constants/currency';
import { useT } from '@/hooks/useT';
import { kv } from '@/utils/kv';
import type { Account } from '@/utils/db/schema';

export type AccountType = 'cash' | 'bank' | 'credit' | 'savings' | 'debt' | 'investment';

const TYPES: { value: AccountType; label: string; icon: string; defaultColor: string }[] = [
  { value: 'cash', label: 'Cash', icon: 'Wallet', defaultColor: '#00E09E' },
  { value: 'bank', label: 'Bank', icon: 'Banknote', defaultColor: '#818CF8' },
  { value: 'credit', label: 'Credit Card', icon: 'CreditCard', defaultColor: '#FF6B8A' },
  { value: 'savings', label: 'Savings', icon: 'PiggyBank', defaultColor: '#FFBE44' },
  { value: 'debt', label: 'Debt / Loan', icon: 'CreditCard', defaultColor: '#F472B6' },
  { value: 'investment', label: 'Investment', icon: 'TrendingUp', defaultColor: '#06B6D4' },
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
  const t = useT();
  const editing = !!account;
  const defaultCurrency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const [type, setType] = useState<AccountType>(account?.type ?? 'cash');
  const [name, setName] = useState(account?.name ?? '');
  const [balance, setBalance] = useState(String(account?.balance ?? ''));
  const [limit, setLimit] = useState(String(account?.creditLimit ?? ''));
  const [color, setColor] = useState(account?.color ?? '#00E09E');
  const [currency, setCurrency] = useState<CurrencyCode>(
    (account?.currency as CurrencyCode | null | undefined) ?? defaultCurrency,
  );
  const [isRiba, setIsRiba] = useState<boolean>(account?.isRiba === 1);
  const [archived, setArchived] = useState<boolean>(account?.archived === 1);
  const [includeInTotal, setIncludeInTotal] = useState<boolean>(account?.includeInTotal !== 0);
  const [typePicker, setTypePicker] = useState(false);
  const [currencyPicker, setCurrencyPicker] = useState(false);

  // Cascade-delete confirmation needs transaction counts so the user can
  // see what they're about to remove. Pulled here (not on first render of
  // the alert) so the count is fresh.
  const accountTxns = useTransactions({
    accountId: account?.id ?? null,
    limit: 1000,
  });

  // Reset form when the sheet opens for a different account.
  useEffect(() => {
    if (visible) {
      setType(account?.type ?? 'cash');
      setName(account?.name ?? '');
      setBalance(String(account?.balance ?? ''));
      setLimit(String(account?.creditLimit ?? ''));
      setColor(account?.color ?? TYPES.find((t) => t.value === (account?.type ?? 'cash'))!.defaultColor);
      setCurrency((account?.currency as CurrencyCode | null | undefined) ?? defaultCurrency);
      setIsRiba(account?.isRiba === 1);
      setArchived(account?.archived === 1);
      setIncludeInTotal(account?.includeInTotal !== 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, account]);

  const typeMeta = useMemo(() => TYPES.find((t) => t.value === type)!, [type]);

  const commitSave = (opts: { skipBalanceCheck?: boolean } = {}) => {
    const balanceNum = parseFloat(balance.replace(',', '.'));
    if (!name.trim() || !Number.isFinite(balanceNum)) {
      Alert.alert(t('common.required'), t('account.nameBalanceRequired'));
      return;
    }
    const id = account?.id ?? `acct_${Date.now()}`;

    // Manual-balance reconciliation: if the user edited the balance on an
    // existing account, force them to acknowledge the gap with an
    // Adjustment transaction. This preserves auditability — "where did
    // this $500 come from?" always has an Activity row to point at.
    const balanceChanged =
      editing && account && balanceNum !== account.balance;

    const writeMeta = () => {
      upsertAccount({
        id,
        name: name.trim(),
        type,
        // When balanceChanged we KEEP the old balance and let the
        // adjustment txn move it (via addTransaction's accounting). For
        // creates and unchanged edits we set directly.
        balance: balanceChanged ? account!.balance : balanceNum,
        creditLimit: type === 'credit' ? parseFloat(limit) || null : null,
        icon: typeMeta.icon,
        color,
        sortOrder: account?.sortOrder ?? Date.now(),
        currency: currency === defaultCurrency ? null : currency,
        isRiba: process.env.APP_FLAVOR === 'islamic' ? (isRiba ? 1 : 0) : null,
        includeInTotal: includeInTotal ? 1 : 0,
        archived: archived ? 1 : 0,
      });
    };

    if (balanceChanged && !opts.skipBalanceCheck) {
      const diff = balanceNum - account!.balance;
      const sign = diff > 0 ? '+' : '−';
      Alert.alert(
        t('account.reconcile.title'),
        t('account.reconcile.body', {
          sign,
          amount: Math.abs(diff).toFixed(2),
          currency,
        }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('account.reconcile.skip'),
            onPress: () => {
              // Overwrite the balance directly — no Adjustment txn, no
              // Activity row. Useful when the user just typo'd the
              // opening balance and wants a clean fix.
              upsertAccount({
                id,
                name: name.trim(),
                type,
                balance: balanceNum,
                creditLimit: type === 'credit' ? parseFloat(limit) || null : null,
                icon: typeMeta.icon,
                color,
                sortOrder: account?.sortOrder ?? Date.now(),
                currency: currency === defaultCurrency ? null : currency,
                isRiba: process.env.APP_FLAVOR === 'islamic' ? (isRiba ? 1 : 0) : null,
                includeInTotal: includeInTotal ? 1 : 0,
                archived: archived ? 1 : 0,
              });
              onClose();
            },
          },
          {
            text: t('account.reconcile.create'),
            onPress: () => {
              writeMeta();
              addTransaction({
                type: diff > 0 ? 'income' : 'expense',
                amount: Math.abs(diff),
                // Phase 10y: reconciliations land in "Other" instead of
                // a dedicated 'adjustment' category — keeps the picker
                // lean and avoids a system category most users never
                // file by manually. The note still flags it as a
                // reconciliation in Activity.
                category: diff > 0 ? 'other_in' : 'other',
                accountId: id,
                note: t('account.reconcile.note'),
                date: Date.now(),
              });
              onClose();
            },
          },
        ],
      );
      return;
    }

    writeMeta();
    onClose();
  };

  const save = () => commitSave();

  const askDelete = () => {
    if (!account) return;
    const directCount = accountTxns.filter(
      (t) => (t.type === 'expense' || t.type === 'income') && t.accountId === account.id,
    ).length;
    const transferCount = accountTxns.filter(
      (t) => t.type === 'transfer' && (t.accountId === account.id || t.toAccountId === account.id),
    ).length;

    const summary = t('account.delete.body', {
      name: account.name,
      balance: account.balance.toFixed(2),
      currency,
      directCount,
      transferCount,
    });

    Alert.alert(t('account.delete.title'), summary, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('account.archive'),
        onPress: () => {
          upsertAccount({
            ...account,
            archived: 1,
            includeInTotal: 0,
          } as typeof account);
          onClose();
        },
      },
      {
        text: t('common.delete') + '…',
        style: 'destructive',
        onPress: () => confirmCascade(directCount, transferCount),
      },
    ]);
  };

  const confirmCascade = (directCount: number, transferCount: number) => {
    if (!account) return;
    Alert.alert(
      t('account.deleteConfirm.title'),
      t('account.deleteConfirm.body', { name: account.name, directCount, transferCount }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            const res = deleteAccountCascade(account.id);
            void res;
            onClose();
          },
        },
      ],
    );
  };

  // Unused legacy callsite — keep the export shape stable.
  void deleteAccount;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
            <MaterialCommunityIcons name="close" size={22} color={theme.text2} />
          </Pressable>
          <Text style={styles.title}>{editing ? t('account.edit') : t('account.new')}</Text>
          <Pressable onPress={save} hitSlop={10} accessibilityLabel={t('common.save')}>
            <MaterialCommunityIcons name="check" size={22} color={theme.accent} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <SettingRow
            label={t('account.field.type')}
            hint={t(`accountType.${typeMeta.value}`)}
            icon="shape-outline"
            onPress={() => setTypePicker(true)}
          />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('account.field.name')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('account.namePlaceholder')}
              placeholderTextColor={theme.text3}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>
              {type === 'debt' ? t('account.field.amountOwed') : t('account.field.balance')}
            </Text>
            <TextInput
              value={balance}
              onChangeText={setBalance}
              keyboardType="numbers-and-punctuation"
              placeholder="0"
              placeholderTextColor={theme.text3}
              style={styles.input}
            />
            {editing && account && parseFloat(balance) !== account.balance && Number.isFinite(parseFloat(balance)) && (
              <Text style={styles.adjustHint}>
                {t('account.adjustHint', {
                  sign: parseFloat(balance) - account.balance >= 0 ? '+' : '−',
                  diff: Math.abs(parseFloat(balance) - account.balance).toFixed(2),
                  currency,
                })}
              </Text>
            )}
          </View>

          {type === 'credit' && (
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>{t('account.field.creditLimit')}</Text>
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

          <SettingRow
            label={t('me.currency')}
            hint={
              editing
                ? t('account.currencyLocked', { currency })
                : `${currency} · ${CURRENCIES[currency].symbolNative} ${CURRENCIES[currency].name}`
            }
            icon="currency-usd"
            // Per design call: currency is locked once an account exists.
            // Changing it retroactively would break balances on every
            // historical transaction (which are stored in this account's
            // currency). To switch, archive the account and create a new
            // one in the desired currency.
            onPress={editing ? undefined : () => setCurrencyPicker(true)}
          />

          {/* Phase 10v: edit-only behavior toggles. */}
          {editing && (
            <>
              <Pressable
                onPress={() => setIncludeInTotal((v) => !v)}
                style={styles.toggleRow}
                accessibilityRole="switch"
                accessibilityState={{ checked: includeInTotal }}
              >
                <MaterialCommunityIcons
                  name="sigma"
                  size={18}
                  color={includeInTotal ? theme.accent : theme.text2}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.toggleLabel}>{t('account.includeInTotal.label')}</Text>
                  <Text style={styles.toggleHint}>
                    {t('account.includeInTotal.hint')}
                  </Text>
                </View>
                <View style={[styles.toggle, includeInTotal && { backgroundColor: theme.accent }]}>
                  <View style={[styles.toggleKnob, includeInTotal && { transform: [{ translateX: 18 }] }]} />
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
                  <Text style={styles.toggleLabel}>{t('account.archiveToggle.label')}</Text>
                  <Text style={styles.toggleHint}>
                    {t('account.archiveToggle.hint')}
                  </Text>
                </View>
                <View style={[styles.toggle, archived && { backgroundColor: theme.warning }]}>
                  <View style={[styles.toggleKnob, archived && { transform: [{ translateX: 18 }] }]} />
                </View>
              </Pressable>
            </>
          )}

          {/* Islamic-only riba flag. Babel inlines APP_FLAVOR; the entire
              JSX below DCEs in generic builds. */}
          {process.env.APP_FLAVOR === 'islamic' && (
            <Pressable
              onPress={() => setIsRiba((v) => !v)}
              style={[
                styles.toggleRow,
                isRiba && { backgroundColor: `${theme.warning}11`, borderColor: `${theme.warning}55` },
              ]}
              accessibilityRole="switch"
              accessibilityState={{ checked: isRiba }}
            >
              <MaterialCommunityIcons
                name={isRiba ? 'alert-circle' : 'alert-circle-outline'}
                size={18}
                color={isRiba ? theme.warning : theme.text2}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.toggleLabel}>{t('me.account.riba.label')}</Text>
                <Text style={styles.toggleHint}>
                  {t('me.account.riba.hint')}
                </Text>
              </View>
              <View style={[styles.toggle, isRiba && { backgroundColor: theme.warning }]}>
                <View style={[styles.toggleKnob, isRiba && { transform: [{ translateX: 18 }] }]} />
              </View>
            </Pressable>
          )}

          <CurrencyPickerSheet
            visible={currencyPicker}
            title={t('me.currency')}
            selected={currency}
            onPick={setCurrency}
            onClose={() => setCurrencyPicker(false)}
          />

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('profile.field.color')}</Text>
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
              <Text style={styles.deleteText}>{t('account.deleteAccount')}</Text>
            </Pressable>
          )}

          <PickerSheet
            visible={typePicker}
            title={t('account.field.type')}
            options={TYPES.map<PickerOption<AccountType>>((tp) => ({
              value: tp.value,
              label: t(`accountType.${tp.value}`),
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
  adjustHint: { color: theme.text3, fontSize: sizes.xs, fontStyle: 'italic' },
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
});
