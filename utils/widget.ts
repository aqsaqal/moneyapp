// Home-screen widgets. The app hands the widgets a small snapshot of
// pre-formatted strings (currency, language and theme already applied)
// whenever its numbers change; the native side only lays them out.
//
//   iOS:     App Group UserDefaults via @bacons/apple-targets, widget code
//            in targets/widget/FlowWidgets.swift.
//   Android: modules/flow-widget (Kotlin AppWidgetProviders).
//
// Both native sides are optional: an old dev client without them simply
// has no widget.

import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';

export type WidgetRow = { label: string; value: string };
export type WidgetQuick = { label: string; color: string; url: string };
export type WidgetTop = { label: string; color: string; value: string };
export type WidgetSnapshot = {
  v: 1;
  asOf: string;
  pro: boolean;
  homeUrl: string;
  lockedText: string;
  lockedUrl: string;
  emptyText: string;
  colors: { bg: string; bg2: string; accent: string; text1: string; text2: string; text3: string; tone: string; border: string };
  title: string;
  perDay: string;
  aDay: string;
  progress: number;
  dayLine: string;
  verdict: string;
  rows: WidgetRow[];
  topTitle: string;
  top: WidgetTop[];
  quickTitle: string;
  quick: WidgetQuick[];
};

interface FlowWidgetNative {
  set(snapshot: string): void;
  count(kind: string): Promise<number>;
  pin(kind: string): boolean;
}
const android = Platform.OS === 'android' ? requireOptionalNativeModule<FlowWidgetNative>('FlowWidget') : null;

type Targets = typeof import('@bacons/apple-targets');
let targets: Targets | null | undefined;
function ios(): Targets | null {
  if (Platform.OS !== 'ios') return null;
  if (targets === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      targets = require('@bacons/apple-targets') as Targets;
    } catch {
      targets = null;
    }
  }
  return targets;
}

export const APP_GROUP: string =
  (Constants.expoConfig?.extra as { appGroup?: string } | undefined)?.appGroup ??
  `group.${Constants.expoConfig?.ios?.bundleIdentifier ?? 'com.moneyflow.generic'}`;
export const APP_SCHEME: string =
  (Array.isArray(Constants.expoConfig?.scheme) ? Constants.expoConfig?.scheme[0] : Constants.expoConfig?.scheme) ?? 'flow';

let last = '';

/** Hand the widgets a fresh snapshot and redraw them. No-op when nothing changed. */
export function pushWidgetSnapshot(snap: WidgetSnapshot) {
  const json = JSON.stringify(snap);
  if (json === last) return;
  last = json;
  try {
    if (android) android.set(json);
    const t = ios();
    if (t) {
      new t.ExtensionStorage(APP_GROUP).set('snapshot', json);
      t.ExtensionStorage.reloadWidget();
    }
  } catch {}
}

/** How many of our widgets are on the home screen; -1 where that cannot be asked (iOS). */
export async function widgetCount(): Promise<number> {
  if (!android) return -1;
  try {
    const [a, b] = await Promise.all([android.count('safe'), android.count('quick')]);
    return a + b;
  } catch {
    return -1;
  }
}

/** Android: ask the launcher to add a widget (it confirms itself). False when it must be done by hand. */
export function pinWidget(kind: 'safe' | 'quick'): boolean {
  try {
    return !!android?.pin(kind);
  } catch {
    return false;
  }
}

export const HAS_WIDGETS = Platform.OS === 'android' ? !!android : !!ios();
