// Paywall — the one place Pro is bought or restored. Opened with
// /paywall?feature=<themes|events|split|pdf|profiles> from a gate, which
// highlights that row.

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { APP_NAME } from '@/constants/flavor';
import { PRO_FALLBACK_PRICE, type ProFeature } from '@/constants/pro';
import { PRIVACY_POLICY_URL, TERMS_URL } from '@/constants/legal';
import { useT } from '@/hooks/useT';
import { usePro } from '@/utils/pro';
import { buy, loadPrice, restore } from '@/utils/purchases';

type Icon = React.ComponentProps<typeof MaterialCommunityIcons>['name'];
const FEATURES: { key: ProFeature | 'future'; icon: Icon }[] = [
  { key: 'themes', icon: 'palette-swatch-outline' },
  { key: 'events', icon: 'airplane' },
  { key: 'split', icon: 'call-split' },
  { key: 'pdf', icon: 'file-pdf-box' },
  { key: 'profiles', icon: 'account-multiple-outline' },
  { key: 'widgets', icon: 'widgets-outline' },
  { key: 'future', icon: 'star-four-points-outline' },
];

export default function Paywall() {
  const t = useT();
  const router = useRouter();
  const pro = usePro();
  const feature = useLocalSearchParams<{ feature?: string }>().feature;
  const [price, setPrice] = useState<string | null>(null);
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const app = APP_NAME;

  useEffect(() => {
    let alive = true;
    loadPrice().then((p) => { if (alive) setPrice(p); });
    return () => { alive = false; };
  }, []);

  const shown = price ?? PRO_FALLBACK_PRICE;

  const onBuy = async () => {
    if (busy) return;
    setBusy('buy');
    const r = await buy();
    setBusy(null);
    if (r === 'purchased') {
      Alert.alert(t('pro.thanks.title'), t('pro.thanks.body', { app }), [{ text: t('common.ok'), onPress: () => router.back() }]);
    } else if (r === 'unavailable') {
      Alert.alert(t('pro.unavailable.title'), t('pro.unavailable.body'));
    } else if (r === 'failed') {
      Alert.alert(t('pro.failed.title'), t('pro.failed.body'));
    }
  };

  const onRestore = async () => {
    if (busy) return;
    setBusy('restore');
    const r = await restore();
    setBusy(null);
    if (r === 'restored') {
      Alert.alert(t('pro.thanks.title'), t('pro.restored.body'), [{ text: t('common.ok'), onPress: () => router.back() }]);
    } else if (r === 'nothing') {
      Alert.alert(t('pro.restore'), t('pro.nothing.body'));
    } else {
      Alert.alert(t('pro.unavailable.title'), t('pro.unavailable.body'));
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
          <MaterialCommunityIcons name="close" size={24} color={theme.text1} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <MaterialCommunityIcons name="star-four-points" size={30} color={theme.bg} />
          </View>
          <Text style={styles.title}>{t('pro.name', { app })}</Text>
          <Text style={styles.sub}>{pro ? t('pro.owned', { app }) : t('pro.hero.sub')}</Text>
        </View>

        <View style={styles.list}>
          {FEATURES.map((f) => {
            const hi = f.key === feature;
            return (
              <View key={f.key} style={[styles.row, hi && styles.rowHi]}>
                <View style={[styles.rowIcon, hi && { backgroundColor: theme.accentMid }]}>
                  <MaterialCommunityIcons name={f.icon} size={20} color={hi ? theme.accent : theme.text2} />
                </View>
                <Text style={[styles.rowText, hi && { color: theme.text1, fontFamily: font.bodySemi }]}>
                  {t(`pro.feature.${f.key}`)}
                </Text>
                <MaterialCommunityIcons name="check" size={18} color={theme.accent} />
              </View>
            );
          })}
        </View>

        {pro ? (
          <Pressable onPress={() => router.back()} style={styles.cta} accessibilityRole="button">
            <Text style={styles.ctaText}>{t('common.done')}</Text>
          </Pressable>
        ) : (
          <>
            <Text style={styles.price}>{t('pro.price.once', { price: shown })}</Text>
            <Pressable
              onPress={() => void onBuy()}
              style={[styles.cta, busy && { opacity: 0.6 }]}
              disabled={!!busy}
              accessibilityRole="button"
            >
              {busy === 'buy' ? (
                <ActivityIndicator color={theme.bg} />
              ) : (
                <Text style={styles.ctaText}>{t('pro.buy', { price: shown })}</Text>
              )}
            </Pressable>
            <Pressable onPress={() => void onRestore()} style={styles.restore} disabled={!!busy} hitSlop={8} accessibilityRole="button">
              {busy === 'restore' ? (
                <ActivityIndicator color={theme.text2} />
              ) : (
                <Text style={styles.restoreText}>{t('pro.restore')}</Text>
              )}
            </Pressable>
            <Text style={styles.fine}>{t('pro.fine')}</Text>
          </>
        )}

        <View style={styles.legal}>
          <Pressable onPress={() => Linking.openURL(TERMS_URL).catch(() => {})} hitSlop={8}>
            <Text style={styles.legalText}>{t('me.terms')}</Text>
          </Pressable>
          <Text style={styles.legalText}> · </Text>
          <Pressable onPress={() => Linking.openURL(PRIVACY_POLICY_URL).catch(() => {})} hitSlop={8}>
            <Text style={styles.legalText}>{t('me.privacyPolicy')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.bg },
  header: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  scroll: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.xl },
  heroIcon: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: theme.accent,
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs,
  },
  title: { color: theme.text1, fontSize: sizes.xxl, fontFamily: font.displayBold },
  sub: { color: theme.text2, fontSize: sizes.md, fontFamily: font.body, textAlign: 'center' },
  list: { gap: spacing.xs, marginBottom: spacing.xl },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radii.md,
    borderWidth: 1, borderColor: 'transparent',
  },
  rowHi: { backgroundColor: theme.bg2, borderColor: theme.accentMid },
  rowIcon: { width: 36, height: 36, borderRadius: radii.sm, backgroundColor: theme.bg2, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, color: theme.text2, fontSize: sizes.md, fontFamily: font.body },
  price: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.body, textAlign: 'center', marginBottom: spacing.sm },
  cta: { backgroundColor: theme.accent, borderRadius: radii.lg, paddingVertical: 16, alignItems: 'center' },
  ctaText: { color: theme.bg, fontSize: sizes.lg, fontFamily: font.bodySemi },
  restore: { alignItems: 'center', paddingVertical: spacing.md },
  restoreText: { color: theme.text2, fontSize: sizes.md, fontFamily: font.bodySemi },
  fine: { color: theme.text3, fontSize: sizes.xs, fontFamily: font.body, textAlign: 'center', marginTop: spacing.xs },
  legal: { flexDirection: 'row', justifyContent: 'center', marginTop: spacing.xl },
  legalText: { color: theme.text3, fontSize: sizes.xs, fontFamily: font.body },
});
