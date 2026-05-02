// MeTabExtras — readable rows on the Me tab showing the user's chosen
// mazhab + prayer-times calculation method, with edit affordance.
//
// Phase 8 (cultural review): "method/mazhab transparency — Me tab shows the
// user's chosen mazhab + prayer-time calc method as a row." Today they're
// picked but not surfaced after selection.
//
// Wired via FeatureSlots.MeTabExtras in features/islamic/slots.tsx.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';
import { SectionHeader } from '@/components/Sections';
import { MAZHABS } from '../zakat/mazhab';
import { getZakatState, setZakatState } from '../zakat/zakatState';
import { getMethod, setMethod, type CalcMethodId } from '../ramadan/prayerTimes';

interface NavSlotProps {
  onNavigate: (path: string) => void;
}

const PRAYER_METHODS: { id: CalcMethodId; label: string }[] = [
  { id: 'UmmAlQura', label: 'Umm al-Qura (Saudi Arabia)' },
  { id: 'MuslimWorldLeague', label: 'Muslim World League' },
  { id: 'Egyptian', label: 'Egyptian' },
  { id: 'Karachi', label: 'Karachi (Pakistan)' },
  { id: 'Dubai', label: 'Dubai' },
  { id: 'NorthAmerica', label: 'ISNA (North America)' },
  { id: 'Kuwait', label: 'Kuwait' },
  { id: 'Qatar', label: 'Qatar' },
  { id: 'Singapore', label: 'Singapore' },
  { id: 'Tehran', label: 'Tehran' },
  { id: 'Turkey', label: 'Turkey' },
  { id: 'MoonsightingCommittee', label: 'Moonsighting Committee' },
];

export function MeTabExtras(_: NavSlotProps) {
  // Read state synchronously; rows re-render on parent re-render.
  const z = getZakatState();
  const method = getMethod();

  return (
    <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
      <SectionHeader title="Islamic" />

      <Pressable
        style={styles.row}
        onPress={() => cycleMazhab()}
        accessibilityRole="button"
        accessibilityLabel={`Mazhab: ${MAZHABS[z.mazhab].name}. Tap to change.`}
      >
        <MaterialCommunityIcons name="book-open-variant" size={20} color={theme.gold} />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Mazhab</Text>
          <Text style={styles.value}>{MAZHABS[z.mazhab].name}</Text>
          <Text style={styles.hint}>{MAZHABS[z.mazhab].note}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={18} color={theme.text3} />
      </Pressable>

      <Pressable
        style={styles.row}
        onPress={() => cyclePrayerMethod()}
        accessibilityRole="button"
        accessibilityLabel={`Prayer time calculation: ${labelForMethod(method)}. Tap to change.`}
      >
        <MaterialCommunityIcons name="moon-waxing-crescent" size={20} color={theme.accent} />
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Prayer time method</Text>
          <Text style={styles.value}>{labelForMethod(method)}</Text>
          <Text style={styles.hint}>Used by Ramadan card to compute Suhoor &amp; Iftar</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={18} color={theme.text3} />
      </Pressable>
    </View>
  );
}

function labelForMethod(id: string): string {
  return PRAYER_METHODS.find((m) => m.id === id)?.label ?? id;
}

/** Tap-to-cycle pattern: rotates through the 4 mazhabs.
 *  In Phase 8 we keep this minimal; a proper picker sheet lands later. */
function cycleMazhab() {
  const order: (keyof typeof MAZHABS)[] = ['hanafi', 'shafii', 'maliki', 'hanbali'];
  const current = getZakatState().mazhab;
  const idx = order.indexOf(current);
  const next = order[(idx + 1) % order.length];
  setZakatState({ mazhab: next });
}

function cyclePrayerMethod() {
  const order: CalcMethodId[] = PRAYER_METHODS.map((m) => m.id);
  const current = getMethod();
  const idx = order.indexOf(current);
  const next = order[(idx + 1) % order.length];
  setMethod(next);
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  label: { color: theme.text2, fontSize: sizes.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { color: theme.text1, fontSize: sizes.md, fontFamily: font.bodySemi, marginTop: 2 },
  hint: { color: theme.text3, fontSize: sizes.xs, marginTop: 2, fontFamily: font.body },
});
