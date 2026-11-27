// WidgetNudgeCard — a one-time card on Home between "This month" and
// "Recent" that offers to put the Safe to spend widget on the home
// screen. Gone for good once a widget exists (Android can tell), or once
// the person acted on it or dismissed it.

import React, { useEffect, useState } from 'react';
import { Alert, AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { APP_NAME } from '@/constants/flavor';
import { kv } from '@/utils/kv';
import { HAS_WIDGETS, pinWidget, widgetCount } from '@/utils/widget';
import { useT } from '@/hooks/useT';

export function WidgetNudgeCard() {
  const t = useT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!HAS_WIDGETS || kv.getBool('widgetNudgeDone', false)) return;
    let alive = true;
    const check = () => {
      widgetCount().then((n) => {
        if (!alive) return;
        if (n > 0) {
          kv.setBool('widgetNudgeDone', true);
          setShow(false);
        } else {
          setShow(true);
        }
      });
    };
    check();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') check(); });
    return () => { alive = false; sub.remove(); };
  }, []);

  if (!show) return null;

  const done = () => {
    kv.setBool('widgetNudgeDone', true);
    setShow(false);
  };
  const add = () => {
    if (Platform.OS === 'android' && pinWidget('safe')) {
      // The launcher confirms; the foreground check above hides the card once it is there.
      return;
    }
    Alert.alert(
      t('settings.widgets'),
      Platform.OS === 'ios' ? t('settings.widgets.ios', { app: APP_NAME }) : t('settings.widgets.manual', { app: APP_NAME }),
    );
    done();
  };

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.icon}>
        <MaterialCommunityIcons name="widgets-outline" size={20} color={theme.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{t('home.widgetNudge.title')}</Text>
        <Text style={styles.body}>{t('home.widgetNudge.body')}</Text>
        <Pressable onPress={add} hitSlop={6} style={styles.cta} accessibilityRole="button">
          <Text style={styles.ctaText}>{t('home.widgetNudge.cta')}</Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={theme.accent} />
        </Pressable>
      </View>
      <Pressable onPress={done} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('common.close')}>
        <MaterialCommunityIcons name="close" size={18} color={theme.text3} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: theme.bg2,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.border,
    padding: spacing.md,
  },
  icon: { width: 36, height: 36, borderRadius: radii.sm, backgroundColor: theme.accentDim, alignItems: 'center', justifyContent: 'center' },
  title: { color: theme.text1, fontSize: sizes.sm, fontFamily: font.bodySemi },
  body: { color: theme.text2, fontSize: sizes.xs, fontFamily: font.body, marginTop: 2 },
  cta: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm, alignSelf: 'flex-start' },
  ctaText: { color: theme.accent, fontSize: sizes.sm, fontFamily: font.bodySemi },
});
