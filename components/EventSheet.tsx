// EventSheet — create / edit / delete an event or trip.
//
// An event is a named date range ("Almaty trip, Nov 3–9"). Expenses join
// it through transactions.event_id: Smart Add preselects a running event,
// and the event screen offers to pull in untagged expenses from the
// dates. Deleting an event leaves its transactions alone.

import React, { useEffect, useState } from 'react';
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
import { NumpadInputSheet } from '@/components/NumpadInputSheet';
import { NativeDatePicker } from '@/components/NativeDatePicker';
import { upsertEvent, deleteEvent } from '@/hooks/useAppData';
import { useT } from '@/hooks/useT';
import { useHaptics } from '@/hooks/useHaptics';
import { showToast } from '@/components/Toast';
import { kv } from '@/utils/kv';
import { formatMoney } from '@/utils/format';
import type { CurrencyCode } from '@/constants/currency';
import type { SpendEvent } from '@/utils/db/schema';

const PALETTE = [
  '#F59E0B', '#10B981', '#6366F1', '#EC4899',
  '#06B6D4', '#8B5CF6', '#EF4444', '#F97316',
];

export const EVENT_ICONS: Array<React.ComponentProps<typeof MaterialCommunityIcons>['name']> = [
  'airplane', 'beach', 'tent', 'ski', 'map-marker-outline', 'camera-outline',
  'party-popper', 'cake-variant', 'ring', 'glass-cocktail', 'silverware-fork-knife', 'music',
  'home-city', 'hammer', 'car', 'bike', 'run',
  'gift-outline', 'baby-carriage', 'school-outline', 'hospital-box-outline', 'briefcase-outline',
  'heart-outline', 'star-outline', 'calendar-star',
];

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}
export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

export function formatDay(ms: number, withYear = true): string {
  const locale = kv.get('locale') ?? undefined;
  const d = new Date(ms);
  try {
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) });
  } catch {
    return d.toLocaleDateString();
  }
}

/** "3–9 Nov 2026" style range; falls back to two full dates across years. */
export function formatEventRange(startMs: number, endMs: number): string {
  const a = new Date(startMs);
  const b = new Date(endMs);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()) {
    return formatDay(startMs);
  }
  if (a.getFullYear() === b.getFullYear()) {
    return `${formatDay(startMs, false)} – ${formatDay(endMs)}`;
  }
  return `${formatDay(startMs)} – ${formatDay(endMs)}`;
}

export interface EventSheetProps {
  visible: boolean;
  event?: SpendEvent;
  onClose: () => void;
  /** Fires after a save with the event id and whether it was newly created. */
  onSaved?: (id: string, created: boolean) => void;
}

export function EventSheet({ visible, event, onClose, onSaved }: EventSheetProps) {
  const t = useT();
  const haptics = useHaptics();
  const editing = !!event;
  const mainCurrency = (kv.get('currency') ?? 'USD') as CurrencyCode;

  const [name, setName] = useState(event?.name ?? '');
  const [start, setStart] = useState<Date>(() => (event ? new Date(event.startDate) : startOfDay(new Date())));
  const [end, setEnd] = useState<Date>(() => (event ? new Date(event.endDate) : startOfDay(new Date())));
  const [color, setColor] = useState(event?.color ?? PALETTE[0]);
  const [icon, setIcon] = useState<string>(event?.icon ?? EVENT_ICONS[0]);
  const [budget, setBudget] = useState<number | null>(event?.budget ?? null);
  const [picker, setPicker] = useState<null | 'start' | 'end'>(null);
  const [numpadOpen, setNumpadOpen] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(event?.name ?? '');
    setStart(event ? new Date(event.startDate) : startOfDay(new Date()));
    setEnd(event ? new Date(event.endDate) : startOfDay(new Date()));
    setColor(event?.color ?? PALETTE[0]);
    setIcon(event?.icon ?? EVENT_ICONS[0]);
    setBudget(event?.budget ?? null);
    setPicker(null);
  }, [visible, event]);

  const save = () => {
    if (!name.trim()) {
      Alert.alert(t('common.required'), t('event.required.name'));
      return;
    }
    const s = startOfDay(start);
    const e = endOfDay(end);
    if (e.getTime() < s.getTime()) {
      Alert.alert(t('common.required'), t('event.required.dates'));
      return;
    }
    const id = event?.id ?? `ev${Date.now()}${Math.floor(Math.random() * 1000)}`;
    upsertEvent({
      id,
      name: name.trim(),
      icon,
      color,
      startDate: s.getTime(),
      endDate: e.getTime(),
      budget: budget != null && budget > 0 ? budget : null,
      budgetCurrency: budget != null && budget > 0 ? (event?.budgetCurrency ?? mainCurrency) : null,
      note: event?.note ?? null,
      archived: event?.archived ?? 0,
      createdAt: event?.createdAt ?? Date.now(),
    });
    haptics.success();
    showToast(t('toast.saved.event'));
    onClose();
    onSaved?.(id, !editing);
  };

  const askDelete = () => {
    if (!event) return;
    Alert.alert(
      t('event.deleteConfirm.title'),
      t('event.deleteConfirm.body', { name: event.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            deleteEvent(event.id);
            onClose();
          },
        },
      ],
    );
  };

  const DateField = ({ label, value, which }: { label: string; value: Date; which: 'start' | 'end' }) => (
    <View style={[styles.field, { flex: 1 }]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable
        onPress={() => setPicker((p) => (p === which ? null : which))}
        style={[styles.input, picker === which && { borderColor: color }]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Text style={styles.inputText} numberOfLines={1}>{formatDay(value.getTime())}</Text>
      </Pressable>
    </View>
  );

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
          <Text style={styles.title}>{editing ? t('common.edit') : t('events.add')}</Text>
          <Pressable onPress={save} hitSlop={10} accessibilityLabel={t('common.save')}>
            <MaterialCommunityIcons name="check" size={22} color={theme.accent} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('event.field.name')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('event.field.namePlaceholder')}
              placeholderTextColor={theme.text3}
              style={styles.input}
              returnKeyType="done"
            />
          </View>

          <View style={styles.dateRow}>
            <DateField label={t('event.field.start')} value={start} which="start" />
            <DateField label={t('event.field.end')} value={end} which="end" />
          </View>
          {picker && (
            <NativeDatePicker
              value={picker === 'start' ? start : end}
              minimumDate={picker === 'end' ? start : undefined}
              onChange={(d) => {
                if (picker === 'start') {
                  setStart(d);
                  if (end.getTime() < d.getTime()) setEnd(d);
                } else {
                  setEnd(d);
                }
              }}
              onClose={() => setPicker(null)}
            />
          )}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>{t('event.field.budget')}</Text>
            <Pressable
              onPress={() => setNumpadOpen(true)}
              style={styles.input}
              accessibilityRole="button"
              accessibilityLabel={t('event.field.budget')}
            >
              <Text style={[styles.inputText, budget == null && styles.inputPlaceholder]} numberOfLines={1}>
                {budget != null && budget > 0
                  ? formatMoney(budget, (event?.budgetCurrency as CurrencyCode | null) ?? mainCurrency)
                  : t('event.field.budget.none')}
              </Text>
            </Pressable>
            {budget != null && budget > 0 && (
              <Pressable onPress={() => setBudget(null)} style={styles.clearDate}>
                <Text style={styles.clearDateText}>{t('common.remove')}</Text>
              </Pressable>
            )}
          </View>

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
              {EVENT_ICONS.map((i) => (
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

        <NumpadInputSheet
          visible={numpadOpen}
          title={t('event.field.budget')}
          initial={budget}
          currency={(event?.budgetCurrency as CurrencyCode | null) ?? mainCurrency}
          onSubmit={(v) => { setBudget(v > 0 ? v : null); setNumpadOpen(false); }}
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
  dateRow: { flexDirection: 'row', gap: spacing.sm },
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
  swatch: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: 'transparent' },
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
