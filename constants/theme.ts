// Theme — light + dark palettes; selected at module-init time from
// kv.themeMode + the OS color scheme. Switching mode requires an app
// reload because StyleSheet.create() captures color values at evaluation.
//
// PRIMARY_COLOR comes from flavor.ts so the Islamic flavor's gold flows
// through automatically.

import { Appearance } from 'react-native';
import { PRIMARY_COLOR, IS_ISLAMIC } from './flavor';
import { kv } from '@/utils/kv';

export type ThemeMode = 'system' | 'dark' | 'light';
export type Palette = {
  bg: string;
  bg1: string;
  bg2: string;
  bg3: string;
  bg4: string;
  accent: string;
  accentDim: string;
  accentMid: string;
  income: string;
  expense: string;
  warning: string;
  indigo: string;
  transfer: string;
  text1: string;
  text2: string;
  text3: string;
  border: string;
  gold: string;
};

const dark: Palette = {
  bg: '#08080F',
  bg1: '#0E0E18',
  bg2: '#161622',
  bg3: '#1E1E2E',
  bg4: '#282840',
  accent: PRIMARY_COLOR,
  accentDim: `${PRIMARY_COLOR}20`,
  accentMid: `${PRIMARY_COLOR}44`,
  income: PRIMARY_COLOR,
  expense: '#FF6B8A',
  warning: '#FFBE44',
  indigo: '#818CF8',
  transfer: '#60A5FA',
  text1: '#EAEAF2',
  text2: '#8888AA',
  text3: '#55556A',
  border: '#252538',
  gold: '#D4AF37',
};

// Brand mint (#00E09E) reads fine on dark — saturation pops against
// black. On white it goes washed-out. We swap to a deeper variant for
// light mode so the green still feels like a brand color, not a hint:
//   Flow:   emerald-600 (#059669)
//   Amanah: teal-700    (#0F766E)
// Dark mode keeps PRIMARY_COLOR unchanged.
const LIGHT_ACCENT = IS_ISLAMIC ? '#0F766E' : '#059669';

const light: Palette = {
  bg: '#F7F7FA',
  bg1: '#FFFFFF',
  bg2: '#F0F0F5',
  bg3: '#E5E5EE',
  bg4: '#DADAE6',
  accent: LIGHT_ACCENT,
  accentDim: `${LIGHT_ACCENT}20`,
  accentMid: `${LIGHT_ACCENT}44`,
  income: LIGHT_ACCENT,
  expense: '#E11D48',
  warning: '#D97706',
  indigo: '#4F46E5',
  transfer: '#2563EB',
  text1: '#111827',
  text2: '#4B5563',
  text3: '#9CA3AF',
  border: '#E5E7EB',
  gold: '#B7831A',
};

function resolveActivePalette(): Palette {
  const stored = (kv.get('themeMode') ?? 'system') as ThemeMode;
  const sys = Appearance.getColorScheme();
  if (stored === 'light') return light;
  if (stored === 'dark') return dark;
  return sys === 'light' ? light : dark;
}

/** Active palette — captured at module-init. Changing themeMode and
 *  reloading the app re-runs this resolution; in-session changes are
 *  applied via Updates.reloadAsync(). */
export const theme: Palette = resolveActivePalette();

export const palettes = { dark, light };
export function activeThemeIsLight(): boolean {
  return theme === light;
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 16,
  pill: 999,
} as const;

export const font = {
  display: 'Outfit_700Bold',
  displayBold: 'Outfit_800ExtraBold',
  body: 'PlusJakartaSans_500Medium',
  bodySemi: 'PlusJakartaSans_600SemiBold',
  arabic: 'IBMPlexSansArabic_500Medium',
} as const;

/**
 * Phase 8: pick the right text font for the user's locale.
 * Returns IBM Plex Sans Arabic for ar-* locales (islamic flavor only — the
 * Arabic font isn't shipped in generic; tree-shake guarantee). Otherwise
 * returns the default Latin body font.
 *
 * Components that mix Arabic + Latin text (e.g., HijriGregorianHero) should
 * call this per-Text rather than at the StyleSheet level so each Text segment
 * picks the right glyph file.
 */
export function localizedFont(locale: string | null | undefined): string {
  if (locale && locale.startsWith('ar') && process.env.APP_FLAVOR === 'islamic') {
    return font.arabic;
  }
  return font.body;
}

export function localizedDisplayFont(locale: string | null | undefined): string {
  if (locale && locale.startsWith('ar') && process.env.APP_FLAVOR === 'islamic') {
    // IBM Plex Sans Arabic doesn't ship a separate display weight in our
    // package; reuse the medium for now. Headings still scale via fontSize.
    return font.arabic;
  }
  return font.displayBold;
}

export const sizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  display: 42,
} as const;
