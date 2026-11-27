// Split — "I spent this much this week, roughly here and there."
//
// Type one total, then distribute it across categories by dragging bars
// (snapped to round numbers) or tapping an amount for an exact figure.
// "Put the rest here" dumps whatever is left into one category, and
// "Same as last time" replays the previous split's proportions so the
// weekly ritual is: total, one tap, save.
//
// Saving creates ONE ORDINARY EXPENSE PER CATEGORY, all on the same date
// and account with a shared note, so budgets, Home, events and Activity
// see nothing special and any row can be edited or deleted as usual.
//
// Reached from Smart Add ("Split across categories" under the amount)
// and from the category grid's Split tile. Prefill: ?prefill=<base64
// JSON { amount?, accountId? }>.

import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { useT } from '@/hooks/useT';
import { useHaptics } from '@/hooks/useHaptics';
import { kv } from '@/utils/kv';
import { canUse } from '@/utils/pro';
import { formatMoney, relativeDayLabel } from '@/utils/format';
import { decodePrefill } from '@/utils/prefill';
import { CURRENCIES, type CurrencyCode } from '@/constants/currency';
import {
  useAccounts,
  useCategoriesWithMeta,
  useCategorySpendSince,
  addTransaction,
  type CategoryWithMeta,
} from '@/hooks/useAppData';
import { NumpadInputSheet } from '@/components/NumpadInputSheet';
import { AccountPicker } from '@/components/AccountPicker';
import { NativeDatePicker } from '@/components/NativeDatePicker';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';

const SHARES_KEY = 'splitLastShares';
const EPS = 0.005;

/** A "nice" drag increment: about a twentieth of the total, rounded to
 *  1 / 2 / 5 × 10^n in the currency's whole units (KZT 120,000 → 5,000;
 *  $120 → 5; $18 → 1). Exact entry via the numpad ignores it. */
function niceStep(total: number, decimals: number): number {
  if (total <= 0) return 1;
  const raw = total / 20;
  const floor = Math.min(raw, 1);
  const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, floor))));
  const candidates = [1, 2, 5, 10].map((m) => m * mag);
  const step = candidates.find((c) => c >= raw) ?? candidates[candidates.length - 1];
  const minUnit = decimals === 0 ? 1 : Math.pow(10, -decimals);
  return Math.max(step, minUnit);
}

function roundTo(v: number, step: number): number {
  return Math.round(v / step) * step;
}

export default function SplitScreen() {
  const t = useT();
  const router = useRouter();
  // Deep links and stale shortcuts: Split is Pro.
  useEffect(() => { if (!canUse('split')) router.replace('/paywall?feature=split' as never); }, [router]);
  const haptics = useHaptics();
  const params = useLocalSearchParams<{ prefill?: string }>();
  const prefill = useMemo(() => {
    if (typeof params.prefill !== 'string') return null;
    return decodePrefill(params.prefill) as { amount?: number; accountId?: string } | null;
  }, [params.prefill]);

  const mainCurrency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const accounts = useAccounts();
  const [accountId, setAccountId] = useState<string>(
    () => prefill?.accountId ?? kv.get('defaultAccountId') ?? accounts[0]?.id ?? '',
  );
  const account = accounts.find((a) => a.id === accountId) ?? accounts[0];
  const currency = ((account?.currency ?? mainCurrency) as CurrencyCode);
  const decimals = CURRENCIES[currency]?.decimalDigits ?? 2;
  const locale = kv.get('locale') ?? 'en-US';

  const [total, setTotal] = useState<number>(prefill?.amount && prefill.amount > 0 ? prefill.amount : 0);
  const [totalOpen, setTotalOpen] = useState(!(prefill?.amount && prefill.amount > 0));
  const [accountOpen, setAccountOpen] = useState(false);
  const [date, setDate] = useState<Date>(() => new Date());
  const [dateOpen, setDateOpen] = useState(false);
  const [note, setNote] = useState('');
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const [exactFor, setExactFor] = useState<CategoryWithMeta | null>(null);

  // Categories ordered by what you actually spend on — last 90 days —
  // so the weekly regulars sit at the top.
  const allCategories = useCategoriesWithMeta();
  const spend90 = useCategorySpendSince(90);
  const categories = useMemo(
    () =>
      allCategories
        .filter((c) => (c.type === 'expense' || c.type === 'both') && !c.archived && c.id !== 'adjustment')
        .sort((a, b) => (spend90.get(b.id) ?? 0) - (spend90.get(a.id) ?? 0) || a.name.localeCompare(b.name)),
    [allCategories, spend90],
  );

  const step = niceStep(total, decimals);
  const allocated = Object.values(alloc).reduce((s, v) => s + v, 0);
  const remaining = total - allocated;
  const done = total > 0 && Math.abs(remaining) < EPS;
  const count = Object.values(alloc).filter((v) => v > 0).length;
  const lastShares = kv.getJSON<Record<string, number>>(SHARES_KEY);
  const hasLast = !!lastShares && Object.keys(lastShares).length > 0;

  const setAmount = (id: string, value: number) => {
    const others = allocated - (alloc[id] ?? 0);
    const max = Math.max(0, total - others);
    const v = Math.min(Math.max(0, value), max);
    setAlloc((a) => ({ ...a, [id]: Number(v.toFixed(decimals)) }));
  };

  const putRest = (id: string) => {
    if (remaining <= EPS) return;
    haptics.tap();
    setAmount(id, (alloc[id] ?? 0) + remaining);
  };

  const applyLast = () => {
    if (!lastShares || total <= 0) return;
    const next: Record<string, number> = {};
    let used = 0;
    let biggest: string | null = null;
    for (const [id, share] of Object.entries(lastShares)) {
      if (!categories.some((c) => c.id === id)) continue;
      const v = roundTo(share * total, step);
      next[id] = v;
      used += v;
      if (biggest == null || share > (lastShares[biggest] ?? 0)) biggest = id;
    }
    // Rounding residue lands on the largest share so the sum is exact.
    if (biggest) next[biggest] = Number(Math.max(0, (next[biggest] ?? 0) + (total - used)).toFixed(decimals));
    haptics.tap();
    setAlloc(next);
  };

  const save = () => {
    if (!done || !account) return;
    const text = note.trim() || t('split.defaultNote');
    try {
      for (const c of categories) {
        const v = alloc[c.id] ?? 0;
        if (v <= 0) continue;
        addTransaction({ type: 'expense', amount: v, category: c.id, accountId: account.id, note: text, date: date.getTime() });
      }
    } catch (e) {
      Alert.alert(t('errorBoundary.title'), e instanceof Error ? e.message : String(e));
      return;
    }
    const shares: Record<string, number> = {};
    for (const [id, v] of Object.entries(alloc)) if (v > 0) shares[id] = v / total;
    kv.setJSON(SHARES_KEY, shares);
    haptics.success();
    showToast(t('toast.saved.split', { n: count }));
    router.back();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
          <MaterialCommunityIcons name="close" size={24} color={theme.text1} />
        </Pressable>
        <Text style={styles.title}>{t('split.title')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* Total */}
        <Pressable onPress={() => setTotalOpen(true)} style={styles.totalCard} accessibilityRole="button" accessibilityLabel={t('split.total')}>
          <Text style={styles.totalLabel}>{t('split.total')}</Text>
          <Text style={[styles.totalValue, total <= 0 && { color: theme.text3 }]} adjustsFontSizeToFit numberOfLines={1}>
            {total > 0 ? formatMoney(total, currency) : t('split.empty')}
          </Text>
          <View style={styles.metaRow}>
            <Pressable onPress={() => setAccountOpen(true)} style={styles.metaChip} accessibilityRole="button" accessibilityLabel={t('recurring.account')}>
              <Icon name={account?.icon ?? 'Wallet'} size={14} color={account?.color ?? theme.text2} />
              <Text style={styles.metaText} numberOfLines={1}>{account?.name ?? '—'}</Text>
            </Pressable>
            <Pressable onPress={() => setDateOpen((v) => !v)} style={styles.metaChip} accessibilityRole="button">
              <MaterialCommunityIcons name="calendar-outline" size={14} color={theme.text2} />
              <Text style={styles.metaText}>{relativeDayLabel(date, locale)}</Text>
            </Pressable>
          </View>
        </Pressable>
        {dateOpen && (
          <NativeDatePicker
            value={date}
            maximumDate={new Date()}
            onChange={setDate}
            onClose={() => setDateOpen(false)}
          />
        )}

        {/* Remaining + quick actions */}
        {total > 0 && (
          <View style={styles.remainRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.remainLabel}>{done ? t('split.allAllocated') : t('split.remaining')}</Text>
              {!done && (
                <Text style={[styles.remainValue, { color: remaining < -EPS ? theme.expense : theme.warning }]}>
                  {remaining < -EPS ? t('split.over', { amount: formatMoney(-remaining, currency) }) : formatMoney(remaining, currency)}
                </Text>
              )}
              {done && <MaterialCommunityIcons name="check-circle" size={22} color={theme.accent} />}
            </View>
            {hasLast && (
              <Pressable onPress={applyLast} style={styles.actionChip} accessibilityRole="button">
                <MaterialCommunityIcons name="history" size={14} color={theme.accent} />
                <Text style={styles.actionChipText}>{t('split.sameAsLast')}</Text>
              </Pressable>
            )}
            {allocated > 0 && (
              <Pressable onPress={() => setAlloc({})} style={styles.actionChip} accessibilityRole="button">
                <Text style={[styles.actionChipText, { color: theme.text2 }]}>{t('split.clear')}</Text>
              </Pressable>
            )}
          </View>
        )}
        {total > 0 && (
          <Text style={styles.hint}>{t('split.hint', { step: formatMoney(step, currency, undefined, decimals === 0 ? 0 : undefined) })}</Text>
        )}

        {/* Category rows */}
        {total > 0 && categories.map((c) => (
          <SplitRow
            key={c.id}
            category={c}
            amount={alloc[c.id] ?? 0}
            total={total}
            step={step}
            currency={currency}
            remaining={remaining}
            restLabel={t('split.rest')}
            onChange={(v) => setAmount(c.id, v)}
            onExact={() => setExactFor(c)}
            onRest={() => putRest(c.id)}
          />
        ))}
        <View style={{ height: 96 }} />
      </ScrollView>

      {/* Save bar */}
      <View style={styles.saveBar}>
        <Text style={styles.saveSummary} numberOfLines={1}>
          {count > 0 ? `${count} · ${formatMoney(allocated, currency)}` : ''}
        </Text>
        <Pressable
          onPress={save}
          disabled={!done}
          style={[styles.saveBtn, !done && { opacity: 0.4 }]}
          accessibilityRole="button"
        >
          <Text style={styles.saveBtnText}>
            {count === 0 ? t('common.save') : count === 1 ? t('split.saveOne') : t('split.save', { n: count })}
          </Text>
        </Pressable>
      </View>

      <NumpadInputSheet
        visible={totalOpen}
        title={t('split.total')}
        initial={total > 0 ? total : null}
        currency={currency}
        onSubmit={(v) => { setTotal(v); setTotalOpen(false); }}
        onClose={() => setTotalOpen(false)}
      />
      <NumpadInputSheet
        visible={exactFor != null}
        title={exactFor ? t('split.exact', { name: exactFor.name }) : ''}
        initial={exactFor ? (alloc[exactFor.id] ?? null) : null}
        currency={currency}
        allowZero
        onSubmit={(v) => { if (exactFor) setAmount(exactFor.id, v); setExactFor(null); }}
        onClose={() => setExactFor(null)}
      />
      <AccountPicker
        visible={accountOpen}
        accounts={accounts.filter((a) => a.archived !== 1)}
        value={accountId}
        headerText={t('recurring.account')}
        onSelect={(id) => { setAccountId(id); setAccountOpen(false); }}
        onClose={() => setAccountOpen(false)}
      />
    </SafeAreaView>
  );
}

function SplitRow({
  category: c,
  amount,
  total,
  step,
  currency,
  remaining,
  restLabel,
  onChange,
  onExact,
  onRest,
}: {
  category: CategoryWithMeta;
  amount: number;
  total: number;
  step: number;
  currency: CurrencyCode;
  remaining: number;
  restLabel: string;
  onChange: (v: number) => void;
  onExact: () => void;
  onRest: () => void;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const fromX = (x: number) => {
    if (width <= 0) return;
    const frac = Math.min(1, Math.max(0, x / width));
    onChange(roundTo(frac * total, step));
  };
  // Touch anywhere on the track sets the amount; drag refines it. The
  // vertical fail offset keeps page scrolling working.
  const pan = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .activeOffsetX([-4, 4])
    .failOffsetY([-10, 10])
    .onBegin((e) => fromX(e.x))
    .onUpdate((e) => fromX(e.x));
  const pct = total > 0 ? Math.min(1, amount / total) : 0;
  const active = amount > 0;

  return (
    <View style={[styles.row, active && { borderColor: `${c.color}66` }]}>
      <View style={styles.rowHead}>
        <View style={[styles.rowIcon, { backgroundColor: `${c.color}22` }]}>
          <MaterialCommunityIcons name={(c.icon as never) || 'tag-outline'} size={16} color={c.color} />
        </View>
        <Text style={styles.rowName} numberOfLines={1}>{c.name}</Text>
        {remaining > EPS && (
          <Pressable onPress={onRest} hitSlop={6} style={styles.restChip} accessibilityRole="button" accessibilityLabel={`${restLabel} ${c.name}`}>
            <Text style={styles.restChipText}>{restLabel}</Text>
          </Pressable>
        )}
        <Pressable onPress={onExact} hitSlop={8} accessibilityRole="button" accessibilityLabel={`${c.name} ${formatMoney(amount, currency)}`}>
          <Text style={[styles.rowAmount, active && { color: theme.text1 }]}>{formatMoney(amount, currency)}</Text>
        </Pressable>
      </View>
      <GestureDetector gesture={pan}>
        <View style={styles.track} onLayout={onLayout} collapsable={false}>
          <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: c.color }]} />
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { color: theme.text1, fontSize: sizes.xl, fontFamily: font.displayBold },
  scroll: { paddingHorizontal: spacing.lg, gap: spacing.md },
  totalCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 6,
    alignItems: 'center',
  },
  totalLabel: { color: theme.text2, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  totalValue: { color: theme.text1, fontSize: sizes.display, fontFamily: font.displayBold },
  metaRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 4 },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.pill,
    backgroundColor: theme.bg3,
    maxWidth: 180,
  },
  metaText: { color: theme.text2, fontSize: sizes.xs, fontFamily: font.bodySemi },
  remainRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  remainLabel: { color: theme.text2, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  remainValue: { fontSize: sizes.xl, fontFamily: font.displayBold, marginTop: 2 },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg2,
  },
  actionChipText: { color: theme.accent, fontSize: sizes.sm, fontFamily: font.bodySemi },
  hint: { color: theme.text3, fontSize: sizes.xs, marginTop: -4 },
  row: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
    gap: spacing.sm,
  },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowName: { flex: 1, color: theme.text1, fontSize: sizes.md, fontFamily: font.body, minWidth: 0 },
  rowAmount: { color: theme.text3, fontSize: sizes.md, fontFamily: font.displayBold, minWidth: 60, textAlign: 'right' },
  restChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radii.pill, backgroundColor: theme.bg3 },
  restChipText: { color: theme.text2, fontSize: 10, fontFamily: font.bodySemi },
  track: { height: 28, borderRadius: 8, backgroundColor: theme.bg3, overflow: 'hidden', justifyContent: 'center' },
  fill: { height: '100%', borderRadius: 8, opacity: 0.85 },
  saveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.border,
    backgroundColor: theme.bg,
  },
  saveSummary: { flex: 1, color: theme.text2, fontSize: sizes.sm, fontFamily: font.bodySemi },
  saveBtn: { paddingHorizontal: spacing.lg, paddingVertical: 12, borderRadius: radii.pill, backgroundColor: theme.accent },
  saveBtnText: { color: theme.bg, fontSize: sizes.md, fontFamily: font.bodySemi },
});
