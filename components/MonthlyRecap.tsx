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
import ViewShot, { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
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
import { kv } from '@/utils/kv';
import { monthKey as monthKeyOf } from '@/utils/format';

export interface MonthlyRecapProps {
  visible: boolean;
  /** YYYY-MM. Defaults to current month. */
  month?: string;
  onClose: () => void;
}

export function MonthlyRecap({ visible, month, onClose }: MonthlyRecapProps) {
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
  const topCat = totals.slice().sort((a, b) => b.total - a.total)[0];
  const topCatInfo = topCat ? catInfo(topCat.category) : null;

  const share = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      // captureRef returns a temporary PNG path on iOS + Android.
      const uri = await captureRef(cardRef, { format: 'png', quality: 0.95, result: 'tmpfile' });
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
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
            <MaterialCommunityIcons name="close" size={22} color={theme.text2} />
          </Pressable>
          <Text style={styles.title}>Recap</Text>
          <Pressable
            onPress={share}
            hitSlop={10}
            disabled={sharing}
            accessibilityLabel="Share recap"
            style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.6 }]}
          >
            <MaterialCommunityIcons name="share-variant" size={18} color={theme.bg} />
            <Text style={styles.shareText}>{sharing ? '…' : 'Share'}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Captured area — keep it stable: no scroll, no animations inside. */}
          <ViewShot
            ref={cardRef}
            options={{ format: 'png', quality: 0.95 }}
            style={styles.cardWrap}
          >
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.brand}>{APP_NAME}</Text>
                <Text style={styles.month}>Your {monthLabel}</Text>
              </View>

              <View style={styles.netBlock}>
                <Text style={styles.netLabel}>Net flow</Text>
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
                <Stat label="Days tracked" value={`${daysTracked} / ${daily.length}`} />
                <Stat label="Streak" value={streak > 0 ? `${streak} day${streak === 1 ? '' : 's'}` : '—'} />
                <Stat
                  label="Top category"
                  value={topCatInfo ? topCatInfo.name : '—'}
                  accent={topCatInfo?.color}
                />
                <Stat
                  label={topCat ? `${topCatInfo?.name ?? 'Top'} spend` : 'Top spend'}
                  value={topCat ? formatMoney(topCat.total, currency) : '—'}
                />
              </View>

              <View style={styles.footer}>
                <View style={[styles.dot, { backgroundColor: PRIMARY_COLOR }]} />
                <Text style={styles.footerText}>Tracked privately on-device with {APP_NAME}.</Text>
              </View>
            </View>
          </ViewShot>

          <Text style={styles.privacyNote}>
            Only the totals shown above are in the image. No account names, notes, or
            individual transactions are included.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

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
  card: {
    aspectRatio: 1,
    backgroundColor: CARD_BG,
    borderRadius: 28,
    padding: 28,
    gap: 22,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
      android: { elevation: 8 },
    }),
  },
  cardHeader: { gap: 4 },
  brand: { color: theme.text1, fontSize: 22, fontFamily: font.displayBold },
  month: { color: theme.text3, fontSize: sizes.sm, letterSpacing: 0.5 },
  netBlock: { gap: 4 },
  netLabel: { color: theme.text3, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 1 },
  netValue: { fontSize: 56, fontFamily: font.displayBold, lineHeight: 62 },
  netHint: { color: theme.text2, fontSize: sizes.sm, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: 14,
    borderRadius: radii.md,
    backgroundColor: '#1F2937',
    gap: 4,
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
