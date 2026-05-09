// Top-level error boundary. Catches render-time crashes from any tab or
// modal so the app doesn't end up at iOS/Android's "the app stopped
// working" dialog. The fallback UI matches the rest of the app and gives
// the user a single, obvious recovery action: Reload.
//
// The boundary intentionally does NOT call any third-party crash service
// (Sentry, etc.) — keeping the "no data leaves device" privacy claim
// intact for v1. If a user-facing diagnostic is needed later, this is
// where to add it (gated behind an explicit toggle).

import React from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { t as i18nT } from '@/utils/i18n';

interface State {
  error: Error | null;
}

interface Props {
  children: React.ReactNode;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    // Local-only log so dev / TestFlight builds surface the stack.
    if (__DEV__) {
      // eslint-disable-next-line no-console
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  reload = () => {
    // Best-effort reload via expo-updates if present; fall back to a
    // soft state reset so the user isn't stranded.
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Updates = require('expo-updates');
      Updates.reloadAsync?.().catch(() => {
        this.setState({ error: null });
      });
    } catch {
      this.setState({ error: null });
    }
  };

  copyDetails = () => {
    if (!this.state.error) return;
    const detail = `${this.state.error.name}: ${this.state.error.message}\n${this.state.error.stack ?? ''}`;
    Alert.alert('Error', detail.slice(0, 1500));
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.root}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons name="alert-circle-outline" size={56} color={theme.warning} />
        </View>
        <Text style={styles.title}>{i18nT('errorBoundary.title')}</Text>
        <Text style={styles.body}>{i18nT('errorBoundary.body')}</Text>
        <Pressable
          onPress={this.reload}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
          accessibilityRole="button"
          accessibilityLabel={i18nT('errorBoundary.reload')}
        >
          <Text style={styles.btnText}>{i18nT('errorBoundary.reload')}</Text>
        </Pressable>
        {__DEV__ && (
          <Pressable onPress={this.copyDetails} hitSlop={10} style={styles.detailLink}>
            <Text style={styles.detailText}>Show error details</Text>
          </Pressable>
        )}
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  iconWrap: { marginBottom: spacing.sm },
  title: {
    color: theme.text1,
    fontSize: sizes.xl,
    fontFamily: font.displayBold,
    textAlign: 'center',
  },
  body: {
    color: theme.text2,
    fontSize: sizes.md,
    fontFamily: font.body,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  btn: {
    marginTop: spacing.md,
    backgroundColor: theme.accent,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: radii.pill,
    minWidth: 180,
    alignItems: 'center',
    ...Platform.select({
      ios: { shadowColor: theme.accent, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 4 },
    }),
  },
  btnText: { color: theme.bg, fontSize: sizes.md, fontFamily: font.bodySemi },
  detailLink: { marginTop: spacing.md },
  detailText: { color: theme.text3, fontSize: sizes.sm },
});
