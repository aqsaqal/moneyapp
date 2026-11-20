// Event / trip detail — what did this actually cost?
//
//   Hero        icon, dates, status (Day 3 of 7 / In 12 days / Ended),
//               total spent in the main currency, per-day average and the
//               budget bar when a budget is set.
//   Review      expenses inside the dates that aren't tagged with any
//               event (and aren't bills) can be pulled in from a
//               checklist, so an event created after the fact fills up.
//   Breakdown   spend per category.
//   Rows        every tagged transaction; tap edits it in Smart Add.

import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { useT } from '@/hooks/useT';
import { kv } from '@/utils/kv';
import { formatMoney } from '@/utils/format';
import { convert } from '@/utils/fx';
import type { CurrencyCode } from '@/constants/currency';
import {
  useEvents,
  useEventTotals,
  useEventCandidates,
  useTransactions,
  useAccounts,
  attachTransactionsToEvent,
  upsertEvent,
  deleteEvent,
  eventStatus,
  eventDayCount,
} from '@/hooks/useAppData';
import { TransactionRow } from '@/components/TransactionRow';
import { EventSheet, formatEventRange, formatDay } from '@/components/EventSheet';
import { ActionMenu } from '@/components/ActionMenu';
import { Icon } from '@/components/Icon';
import { showToast } from '@/components/Toast';
import { buildEditPrefill } from '@/utils/prefill';
import { catInfo } from '@/constants/categories';
import type { Transaction } from '@/utils/db/schema';
import { Alert } from 'react-native';

export default function EventDetail() {
  const t = useT();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; review?: string }>();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;

  const events = useEvents({ includeArchived: true });
  const event = useMemo(() => events.find((e) => e.id === id), [events, id]);
  const totals = useEventTotals(event?.id);
  const txns = useTransactions({ eventId: event?.id ?? null, limit: 400 });
  const candidates = useEventCandidates(event);
  const accounts = useAccounts({ includeArchived: true });
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const accountCcy = useMemo(
    () => new Map(accounts.map((a) => [a.id, (a.currency ?? currency) as CurrencyCode])),
    [accounts, currency],
  );
  const accountMeta = useMemo(() => new Map(accounts.map((a) => [a.id, { icon: a.icon, color: a.color }])), [accounts]);

  const [menuOpen, setMenuOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(params.review === '1');

  if (!event) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.back')}>
            <MaterialCommunityIcons name="chevron-left" size={26} color={theme.text2} />
          </Pressable>
          <View />
          <View />
        </View>
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{t('events.notFound')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const now = Date.now();
  const status = eventStatus(event, now);
  const days = eventDayCount(event);
  const dayIndex = Math.min(days, Math.max(1, Math.floor((now - event.startDate) / 86_400_000) + 1));
  const elapsedDays = status === 'past' ? days : status === 'upcoming' ? 0 : dayIndex;
  const perDay = elapsedDays > 0 ? totals.spent / elapsedDays : null;
  const budgetMain =
    event.budget != null && event.budget > 0
      ? convert(event.budget, (event.budgetCurrency as CurrencyCode | null) ?? currency, currency)
      : null;
  const statusLine =
    status === 'active'
      ? t('events.status.dayOf', { d: dayIndex, n: days })
      : status === 'upcoming'
        ? (() => {
            const n = Math.ceil((event.startDate - now) / 86_400_000);
            return n <= 0 ? t('events.status.startsToday') : n === 1 ? t('events.status.tomorrow') : t('events.status.inDays', { n });
          })()
        : (() => {
            const n = Math.floor((now - event.endDate) / 86_400_000);
            return n <= 0 ? t('events.status.endedToday') : n === 1 ? t('events.status.endedYesterday') : t('events.status.endedAgo', { n });
          })();

  const edit = (tx: Transaction) =>
    router.push({ pathname: '/add', params: { prefill: buildEditPrefill(tx) } } as never);

  const toggleArchive = () => {
    upsertEvent({ ...event, archived: event.archived === 1 ? 0 : 1 });
    setMenuOpen(false);
  };
  const askDelete = () => {
    setMenuOpen(false);
    Alert.alert(
      t('event.deleteConfirm.title'),
      t('event.deleteConfirm.body', { name: event.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => { deleteEvent(event.id); router.back(); } },
      ],
    );
  };

  const labelFor = (tx: Transaction): string | undefined => accountName.get(tx.accountId ?? '');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.back')}>
          <MaterialCommunityIcons name="chevron-left" size={26} color={theme.text2} />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{event.name}</Text>
        <Pressable onPress={() => setMenuOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.edit')}>
          <MaterialCommunityIcons name="dots-horizontal" size={24} color={theme.text2} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={[styles.hero, { borderColor: `${event.color}66` }]}>
          <View style={styles.heroHead}>
            <View style={[styles.heroIcon, { backgroundColor: `${event.color}22` }]}>
              <MaterialCommunityIcons name={event.icon as never} size={26} color={event.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.heroRange}>{formatEventRange(event.startDate, event.endDate)}</Text>
              <Text style={[styles.heroStatus, status === 'active' && { color: event.color }]}>
                {statusLine} · {days === 1 ? t('events.status.oneDay') : t('events.status.days', { n: days })}
                {event.archived === 1 ? ` · ${t('categories.archived')}` : ''}
              </Text>
            </View>
          </View>
          <Text style={styles.heroLabel}>{t('events.spent')}</Text>
          <Text style={[styles.heroValue, { color: budgetMain && totals.spent > budgetMain ? theme.expense : theme.text1 }]} adjustsFontSizeToFit numberOfLines={1}>
            {formatMoney(totals.spent, currency)}
          </Text>
          <Text style={styles.heroSub}>
            {perDay != null ? t('events.perDay', { amount: formatMoney(perDay, currency) }) : ''}
            {perDay != null && budgetMain ? ' · ' : ''}
            {budgetMain
              ? totals.spent > budgetMain
                ? t('events.overBudget', { amount: formatMoney(totals.spent - budgetMain, currency) })
                : t('events.budgetLeft', { amount: formatMoney(budgetMain - totals.spent, currency) })
              : ''}
          </Text>
          {budgetMain != null && (
            <>
              <View style={styles.barBg}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${Math.min(1, totals.spent / budgetMain) * 100}%`, backgroundColor: totals.spent > budgetMain ? theme.expense : event.color },
                  ]}
                />
              </View>
              <Text style={styles.heroFoot}>
                {t('events.ofBudget', { spent: formatMoney(totals.spent, currency), budget: formatMoney(budgetMain, currency) })}
              </Text>
            </>
          )}
        </View>

        {/* Untagged expenses inside the dates */}
        {candidates.length > 0 && (
          <Pressable onPress={() => setReviewOpen(true)} style={styles.banner} accessibilityRole="button">
            <MaterialCommunityIcons name="playlist-plus" size={18} color={theme.warning} />
            <Text style={styles.bannerText}>{t('events.untagged.banner', { n: candidates.length })}</Text>
            <Text style={styles.bannerCta}>{t('events.untagged.review')}</Text>
          </Pressable>
        )}

        {/* Category breakdown */}
        {totals.byCategory.length > 0 && (
          <View style={{ gap: spacing.sm }}>
            <Text style={styles.section}>{t('analytics.breakdown')}</Text>
            {totals.byCategory.map((c) => {
              const info = catInfo(c.category);
              const pct = totals.spent > 0 ? c.total / totals.spent : 0;
              return (
                <View key={c.category} style={styles.catRow}>
                  <View style={styles.catHead}>
                    <View style={[styles.catIcon, { backgroundColor: `${info.color}22` }]}>
                      <Icon name={info.icon} size={16} color={info.color} />
                    </View>
                    <Text style={styles.catName} numberOfLines={1}>{info.name}</Text>
                    <Text style={styles.catAmt}>{formatMoney(c.total, currency)}</Text>
                    <Text style={styles.catPct}>{Math.round(pct * 100)}%</Text>
                  </View>
                  <View style={styles.barBg}>
                    <View style={[styles.barFill, { width: `${pct * 100}%`, backgroundColor: info.color }]} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Transactions */}
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.section}>{t('events.transactions')}{txns.length > 0 ? ` · ${txns.length}` : ''}</Text>
          {txns.length === 0 && <Text style={styles.emptyHint}>{t('events.noTransactions')}</Text>}
          {txns.map((tx) => (
            <TransactionRow
              key={tx.id}
              t={tx}
              currency={currency}
              accountLabel={labelFor(tx)}
              fromCurrency={accountCcy.get(tx.accountId ?? '')}
              toCurrency={tx.toAccountId ? accountCcy.get(tx.toAccountId) : undefined}
              accountIcon={accountMeta.get(tx.accountId ?? '')?.icon}
              accountColor={accountMeta.get(tx.accountId ?? '')?.color}
              onPressMore={() => edit(tx)}
            />
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <ActionMenu
        visible={menuOpen}
        title={event.name}
        onClose={() => setMenuOpen(false)}
        options={[
          { label: t('common.edit'), icon: 'pencil-outline', onPress: () => { setMenuOpen(false); setEditOpen(true); } },
          ...(candidates.length > 0
            ? [{ label: t('events.menu.addPast'), icon: 'playlist-plus' as const, onPress: () => { setMenuOpen(false); setReviewOpen(true); } }]
            : []),
          {
            label: event.archived === 1 ? t('events.menu.unarchive') : t('events.menu.archive'),
            icon: event.archived === 1 ? 'archive-arrow-up-outline' : 'archive-arrow-down-outline',
            onPress: toggleArchive,
          },
          { label: t('common.delete'), icon: 'trash-can-outline', destructive: true, onPress: askDelete },
        ]}
      />
      <EventSheet visible={editOpen} event={event} onClose={() => setEditOpen(false)} />
      <ReviewSheet
        visible={reviewOpen}
        eventId={event.id}
        eventColor={event.color}
        candidates={candidates}
        currency={currency}
        accountCcy={accountCcy}
        onClose={() => setReviewOpen(false)}
      />
    </SafeAreaView>
  );
}

/** Checklist of untagged expenses inside the event's dates. Everything
 *  starts ticked; the user unticks rent-like rows and taps Add. */
function ReviewSheet({
  visible,
  eventId,
  eventColor,
  candidates,
  currency,
  accountCcy,
  onClose,
}: {
  visible: boolean;
  eventId: string;
  eventColor: string;
  candidates: Transaction[];
  currency: CurrencyCode;
  accountCcy: Map<string, CurrencyCode>;
  onClose: () => void;
}) {
  const t = useT();
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const selected = candidates.filter((c) => !unticked.has(c.id));
  const total = selected.reduce((s, c) => s + (c.amountMain ?? convert(c.amount, accountCcy.get(c.accountId ?? '') ?? currency, currency)), 0);

  const attach = () => {
    attachTransactionsToEvent(selected.map((c) => c.id), eventId);
    showToast(t('toast.attached.event', { n: selected.length }));
    setUnticked(new Set());
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
            <MaterialCommunityIcons name="close" size={24} color={theme.text2} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{t('events.untagged.title')}</Text>
          <View style={{ width: 24 }} />
        </View>
        <Text style={[styles.emptyHint, { paddingHorizontal: spacing.lg }]}>{t('events.untagged.hint')}</Text>
        <FlatList
          data={candidates}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, paddingBottom: 120 }}
          renderItem={({ item: c }) => {
            const info = catInfo(c.category);
            const on = !unticked.has(c.id);
            const ccy = accountCcy.get(c.accountId ?? '') ?? currency;
            return (
              <Pressable
                onPress={() =>
                  setUnticked((prev) => {
                    const next = new Set(prev);
                    if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                    return next;
                  })
                }
                style={[styles.candRow, !on && { opacity: 0.45 }]}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
              >
                <MaterialCommunityIcons
                  name={on ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                  size={22}
                  color={on ? eventColor : theme.text3}
                />
                <View style={[styles.catIcon, { backgroundColor: `${info.color}22` }]}>
                  <Icon name={info.icon} size={16} color={info.color} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.catName} numberOfLines={1}>{c.note || info.name}</Text>
                  <Text style={styles.candSub} numberOfLines={1}>{formatDay(c.date)}{c.note ? ` · ${info.name}` : ''}</Text>
                </View>
                <Text style={styles.catAmt}>{formatMoney(c.amount, ccy)}</Text>
              </Pressable>
            );
          }}
        />
        <View style={styles.attachBar}>
          <Text style={styles.attachTotal}>{formatMoney(total, currency)}</Text>
          <Pressable
            onPress={attach}
            disabled={selected.length === 0}
            style={[styles.attachBtn, { backgroundColor: eventColor }, selected.length === 0 && { opacity: 0.4 }]}
            accessibilityRole="button"
          >
            <Text style={styles.attachBtnText}>{t('events.untagged.attach', { n: selected.length })}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
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
  title: { color: theme.text1, fontSize: sizes.xl, fontFamily: font.displayBold, flex: 1, textAlign: 'center', marginHorizontal: spacing.md },
  scroll: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: theme.text3, fontSize: sizes.md },
  emptyHint: { color: theme.text3, fontSize: sizes.sm, lineHeight: 20, paddingHorizontal: 4 },
  hero: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    gap: 4,
  },
  heroHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm },
  heroIcon: { width: 48, height: 48, borderRadius: radii.lg, alignItems: 'center', justifyContent: 'center' },
  heroRange: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi },
  heroStatus: { color: theme.text3, fontSize: sizes.xs, marginTop: 2 },
  heroLabel: { color: theme.text2, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  heroValue: { fontSize: sizes.xxxl, fontFamily: font.displayBold },
  heroSub: { color: theme.text2, fontSize: sizes.sm },
  heroFoot: { color: theme.text3, fontSize: sizes.xs, marginTop: 2 },
  barBg: { height: 6, backgroundColor: theme.bg3, borderRadius: 3, overflow: 'hidden', marginTop: 6 },
  barFill: { height: '100%', borderRadius: 3 },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: `${theme.warning}66`,
    backgroundColor: `${theme.warning}08`,
  },
  bannerText: { flex: 1, color: theme.text1, fontSize: sizes.sm },
  bannerCta: { color: theme.accent, fontSize: sizes.sm, fontFamily: font.bodySemi },
  section: { color: theme.text2, fontSize: sizes.sm, textTransform: 'uppercase', letterSpacing: 1 },
  catRow: { gap: 6, paddingVertical: 4 },
  catHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  catIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  catName: { flex: 1, color: theme.text1, fontSize: sizes.md, fontFamily: font.body },
  catAmt: { color: theme.text1, fontSize: sizes.sm, fontFamily: font.display },
  catPct: { color: theme.text3, fontSize: sizes.xs, width: 36, textAlign: 'right' },
  candRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  candSub: { color: theme.text3, fontSize: sizes.xs, marginTop: 1 },
  attachBar: {
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
  attachTotal: { color: theme.text1, fontSize: sizes.lg, fontFamily: font.displayBold },
  attachBtn: { paddingHorizontal: spacing.lg, paddingVertical: 12, borderRadius: radii.pill },
  attachBtnText: { color: theme.bg, fontSize: sizes.md, fontFamily: font.bodySemi },
});
