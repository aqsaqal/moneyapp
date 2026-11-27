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

// ─── Themes ──────────────────────────────────────────────────────────
// A theme is a dark + light palette pair. "mint" is the original look and
// the default; the other three came out of the 2026-11 palette review.
// The id is device-wide (kv.themeId) and, like themeMode, needs a reload.

export type ThemeId = 'mint' | 'graphite' | 'ink' | 'espresso';
export const THEME_IDS: ThemeId[] = ['mint', 'graphite', 'ink', 'espresso'];
export const DEFAULT_THEME_ID: ThemeId = 'mint';

type Overrides = Partial<Omit<Palette, 'accentDim' | 'accentMid'>>;
function derive(base: Palette, ov: Overrides): Palette {
  const accent = ov.accent ?? base.accent;
  return { ...base, ...ov, accent, accentDim: `${accent}20`, accentMid: `${accent}44` };
}

// Warm charcoal surfaces, chartreuse accent. Light mode uses an olive
// accent since chartreuse has no contrast on white.
const graphiteDark = derive(dark, {
  bg: '#0E0E0C', bg1: '#141412', bg2: '#1B1B18', bg3: '#24241F', bg4: '#30302A',
  accent: '#C8F135', income: '#5FD38D', expense: '#F06A6A', warning: '#F2B134',
  text1: '#F2F0EA', text2: '#9C9A93', text3: '#63615B', border: '#2A2A26',
});
const graphiteLight = derive(light, {
  bg: '#F7F7F3', bg1: '#FFFFFF', bg2: '#F0F0EA', bg3: '#E6E6DE', bg4: '#DADACF',
  accent: '#6F8F00', income: '#2E9E5B', expense: '#D7443E', warning: '#C97F0A',
  text1: '#1A1A17', text2: '#5C5B55', text3: '#9A9890', border: '#E3E3DB',
});

// Navy-ink surfaces, saffron accent, green income, true red expenses.
const inkDark = derive(dark, {
  bg: '#0A0E14', bg1: '#0F141B', bg2: '#151C25', bg3: '#1C2531', bg4: '#26323F',
  accent: '#F2A93B', income: '#4CC38A', expense: '#E5484D', warning: '#E07A3C',
  text1: '#EAF0F5', text2: '#8C9AA8', text3: '#596673', border: '#223040',
});
const inkLight = derive(light, {
  bg: '#F5F7FA', bg1: '#FFFFFF', bg2: '#EDF1F5', bg3: '#E1E7EE', bg4: '#D3DBE5',
  accent: '#B9700A', income: '#1F8F5F', expense: '#D32F36', warning: '#C2561F',
  text1: '#101820', text2: '#4E5D6C', text3: '#8C9AA8', border: '#DCE3EB',
});

// Espresso-brown surfaces, sage accent.
const espressoDark = derive(dark, {
  bg: '#0E0C0A', bg1: '#15120F', bg2: '#1C1814', bg3: '#262019', bg4: '#322A22',
  accent: '#9CC08C', income: '#7DBF79', expense: '#E06C6C', warning: '#D9A441',
  text1: '#F3EDE4', text2: '#A89F93', text3: '#6B635A', border: '#2B241E',
});
const espressoLight = derive(light, {
  bg: '#F8F5F0', bg1: '#FFFFFF', bg2: '#F1ECE4', bg3: '#E7DFD4', bg4: '#DBD0C2',
  accent: '#4F7D45', income: '#3E8A3B', expense: '#C9463F', warning: '#B5841A',
  text1: '#1E1813', text2: '#5E554C', text3: '#9A9085', border: '#E4DCD1',
});

export const THEMES: Record<ThemeId, { dark: Palette; light: Palette }> = {
  mint: { dark, light },
  graphite: { dark: graphiteDark, light: graphiteLight },
  ink: { dark: inkDark, light: inkLight },
  espresso: { dark: espressoDark, light: espressoLight },
};

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && (THEME_IDS as string[]).includes(v);
}

function resolveThemeId(): ThemeId {
  const stored = kv.get('themeId');
  return isThemeId(stored) ? stored : DEFAULT_THEME_ID;
}

function resolveActivePalette(id: ThemeId): Palette {
  const pair = THEMES[id];
  const stored = (kv.get('themeMode') ?? 'system') as ThemeMode;
  const sys = Appearance.getColorScheme();
  if (stored === 'light') return pair.light;
  if (stored === 'dark') return pair.dark;
  return sys === 'light' ? pair.light : pair.dark;
}

/** Theme id captured at module-init, like `theme` below. */
export const activeThemeId: ThemeId = resolveThemeId();

/** Active palette — captured at module-init. Changing themeMode / themeId
 *  and reloading the app re-runs this resolution; in-session changes are
 *  applied via Updates.reloadAsync(). */
export const theme: Palette = resolveActivePalette(activeThemeId);

export const palettes = THEMES[activeThemeId];
export function activeThemeIsLight(): boolean {
  return theme === palettes.light;
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
