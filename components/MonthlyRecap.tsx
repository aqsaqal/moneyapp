// MonthlyRecap — shareable end-of-month card.
//
// A square (1080×1080-target) card that summarizes the user's month:
// - Top: brand + "Your <Month>"
// - Hero: net flow (income - expenses) with trend
// - Stats grid: total in, total out, days tracked, top category
// - Streak badge if applicable
// - Footer: brand wordmark
//
// Captured via react-native-view-shot, written to a temp PNG, shared via
// expo-sharing. The user can post the screenshot anywhere — the brand mark
// + handle is baked in, no metadata leaks.
//
// Privacy: amount + category names are visible. We DO NOT include account
// names, tx notes, halal status, or any single-tx detail. Aggregate only.

import React, { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Sharing from 'expo-sharing';

// Lazy-import view-shot so a JS bundle loaded into a native binary that
// predates the dep doesn't crash the entire route on module-eval. When
// the native side is missing we fall back to a "View as image" preview
// without sharing.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _viewShot: { ViewShot: any; captureRef: any } | null = null;
function getViewShot() {
  if (_viewShot) return _viewShot;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-view-shot');
    _viewShot = { ViewShot: mod.default ?? mod.ViewShot, captureRef: mod.captureRef };
    return _viewShot;
  } catch {
    return null;
  }
}
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { APP_NAME, PRIMARY_COLOR } from '@/constants/flavor';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { catInfo } from '@/constants/categories';
import {
  useTransactions,
  useMonthTotalsByCategory,
  useDailySpend,
} from '@/hooks/useAppData';
import { useStreak } from '@/hooks/useStreak';
import { useT } from '@/hooks/useT';
import { kv } from '@/utils/kv';
import { monthKey as monthKeyOf } from '@/utils/format';

export interface MonthlyRecapProps {
  visible: boolean;
  /** YYYY-MM. Defaults to current month. */
  month?: string;
  onClose: () => void;
}

export function MonthlyRecap({ visible, month, onClose }: MonthlyRecapProps) {
  const t = useT();
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const key = month ?? monthKeyOf();
  const monthLabel = formatMonthLabel(key);

  const txns = useTransactions({ monthKey: key });
  const totals = useMonthTotalsByCategory(key, 'expense');
  const daily = useDailySpend(key);
  const streak = useStreak();

  const income = txns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const net = income - expense;
  const daysTracked = new Set(daily.filter((d) => d.amount > 0).map((d) => d.day)).size;
  // Cultural review (islamic): ibadah categories (zakat / sadaqa /
  // qurban) must NEVER appear in a shareable card. Filter them out of
  // the candidate set used to pick the headline "top category."
  const IBADAH = process.env.APP_FLAVOR === 'islamic'
    ? new Set(['zakat', 'sadaqa', 'qurban'])
    : null;
  const shareTotals = IBADAH
    ? totals.filter((t) => !IBADAH.has(t.category))
    : totals;
  const topCat = shareTotals.slice().sort((a, b) => b.total - a.total)[0];
  const topCatInfo = topCat ? catInfo(topCat.category) : null;

  const share = async () => {
    if (sharing) return;
    const vs = getViewShot();
    if (!vs) {
      Alert.alert('Share unavailable', 'Reinstall the app to enable sharing.');
      return;
    }
    setSharing(true);
    try {
      const uri = await vs.captureRef(cardRef, { format: 'png', quality: 0.95, result: 'tmpfile' });
      const ok = await Sharing.isAvailableAsync();
      if (!ok) {
        Alert.alert('Share unavailable', 'Sharing is not available on this device.');
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: `Your ${monthLabel}`,
        UTI: 'public.png',
      });
    } catch (e) {
      Alert.alert('Could not share', String(e));
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
            <MaterialCommunityIcons name="close" size={22} color={theme.text2} />
          </Pressable>
          <Text style={styles.title}>{t('recap.title')}</Text>
          <Pressable
            onPress={share}
            hitSlop={10}
            disabled={sharing}
            accessibilityLabel={t('common.share')}
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.6 }]}
          >
            <MaterialCommunityIcons name="share-variant" size={18} color={theme.bg} />
            <Text style={styles.shareText}>{sharing ? '…' : t('common.share')}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Captured area — keep it stable: no scroll, no animations inside.
              Wrap with ViewShot only when the native module is loadable; on
              older binaries we skip the wrapper, the card still renders, but
              Share is disabled (handled in share()). */}
          <RecapShotWrapper ref={cardRef} style={styles.cardWrap}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.brand}>{APP_NAME}</Text>
                <Text style={styles.month}>{t('recap.your', { month: monthLabel })}</Text>
              </View>

              <View style={styles.netBlock}>
                <Text style={styles.netLabel}>{t('recap.netFlow')}</Text>
                <Text
                  style={[
                    styles.netValue,
                    { color: net >= 0 ? PRIMARY_COLOR : theme.expense },
                  ]}
                  adjustsFontSizeToFit
                  numberOfLines={1}
                >
                  {net >= 0 ? '+' : ''}
                  {formatMoney(net, currency)}
                </Text>
                <Text style={styles.netHint}>
                  {formatMoney(income, currency)} in · {formatMoney(expense, currency)} out
                </Text>
              </View>

              <View style={styles.grid}>
                <Stat label={t('recap.daysTracked')} value={`${daysTracked} / ${daily.length}`} />
                <Stat label={t('recap.streak')} value={streak > 0 ? String(streak) : '—'} />
                <Stat
                  label={t('recap.topCategory')}
                  value={topCatInfo ? topCatInfo.name : '—'}
                  accent={topCatInfo?.color}
                />
                <Stat
                  label={t('recap.topSpend')}
                  value={topCat ? formatMoney(topCat.total, currency) : '—'}
                />
              </View>

              <View style={styles.footer}>
                <View style={[styles.dot, { backgroundColor: PRIMARY_COLOR }]} />
                <Text style={styles.footerText}>{t('recap.footer', { appName: APP_NAME })}</Text>
              </View>
            </View>
          </RecapShotWrapper>

          <Text style={styles.privacyNote}>{t('recap.privacyNote')}</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

/** Wraps the captured card in a `ViewShot` when the native module is loaded.
 *  When it's not (older binary), renders a plain View — the card displays
 *  fine and Share is disabled at the action level. */
const RecapShotWrapper = React.forwardRef<View, { style?: View['props']['style']; children: React.ReactNode }>(
  function RecapShotWrapperImpl({ style, children }, ref) {
    const vs = getViewShot();
    if (vs) {
      const VS = vs.ViewShot;
      return (
        <VS ref={ref} options={{ format: 'png', quality: 0.95 }} style={style}>
          {children}
        </VS>
      );
    }
    return (
      <View ref={ref} style={style}>
        {children}
      </View>
    );
  },
);

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={styles.stat}>
      {accent && <View style={[styles.statAccent, { backgroundColor: accent }]} />}
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

function formatMonthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleString('en', { month: 'long', year: 'numeric' });
}

const CARD_BG = '#0F172A';

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: { color: theme.text1, fontSize: sizes.lg, fontFamily: font.displayBold },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  shareText: { color: theme.bg, fontSize: sizes.sm, fontFamily: font.bodySemi },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  cardWrap: { alignSelf: 'center', width: '100%' },
  // Square card targeted at 1080×1080 social share. The content blocks
  // (header + net flow + 2x2 grid + footer) used to overflow at viewport
  // widths > ~330pt — overflow: hidden was clipping the bottom row off
  // screen and out of the captured PNG. Tightened paddings, gap, and the
  // headline font so the four blocks fit the square at every supported
  // screen width without losing legibility.
  card: {
    aspectRatio: 1,
    backgroundColor: CARD_BG,
    borderRadius: 28,
    padding: 20,
    gap: 14,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 8 },
    }),
  },
  cardHeader: { gap: 2 },
  brand: { color: theme.text1, fontSize: 20, fontFamily: font.displayBold },
  month: { color: theme.text3, fontSize: sizes.sm, letterSpacing: 0.5 },
  netBlock: { gap: 2 },
  netLabel: { color: theme.text3, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 1 },
  netValue: { fontSize: 40, fontFamily: font.displayBold, lineHeight: 46 },
  netHint: { color: theme.text2, fontSize: sizes.sm, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 10,
    borderRadius: radii.md,
    backgroundColor: '#1F2937',
    gap: 2,
  },
  statAccent: { width: 24, height: 3, borderRadius: 2, marginBottom: 4 },
  statLabel: { color: theme.text3, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { color: theme.text1, fontSize: sizes.lg, fontFamily: font.bodySemi },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 'auto' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  footerText: { color: theme.text3, fontSize: sizes.xs },
  privacyNote: {
    color: theme.text3,
    fontSize: sizes.xs,
    lineHeight: 18,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
  },
});
