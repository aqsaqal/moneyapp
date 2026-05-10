// MeTabExtras — readable rows on Me tab showing chosen mazhab + prayer
// calculation method. Tap a row → PickerSheet opens with all options;
// pick to change.
//
// Phase 9 update: replaced the tap-to-cycle pattern from Phase 8 with a
// proper picker sheet (consistent with Language / Currency in Me).

import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';
import { sectionStyles, SectionHeader, SettingRow } from '@/components/Sections';
import { PickerSheet, type PickerOption } from '@/components/PickerSheet';
import { MAZHABS, type Mazhab } from '../zakat/mazhab';
import { getZakatState, setZakatState } from '../zakat/zakatState';
import { getMethod, setMethod, type CalcMethodId } from '../ramadan/prayerTimes';
import { kv } from '@/utils/kv';
import { loadMetalsCache, refreshMetals } from '../zakat/metalsRefresh';

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
  const [zState, setZState] = useState(getZakatState());
  const [method, setMethodState] = useState<CalcMethodId>(getMethod());
  const [picker, setPicker] = useState<null | 'mazhab' | 'method'>(null);
  const [nisabAuto, setNisabAuto] = useState(kv.getBool('islamic.nisabAutoRefresh', false));
  const [nisabFetched, setNisabFetched] = useState<number>(loadMetalsCache()?.fetchedAt ?? 0);
  const [nisabBusy, setNisabBusy] = useState(false);

  const fmtAge = (() => {
    if (!nisabFetched) return 'never';
    const h = Math.floor((Date.now() - nisabFetched) / 3_600_000);
    if (h < 1) return 'just now';
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  })();

  return (
    <View style={{ gap: spacing.md, marginTop: spacing.lg }}>
      <SectionHeader title="Islamic" />

      <SettingRow
        label="Mazhab"
        hint={`${MAZHABS[zState.mazhab].name} · ${MAZHABS[zState.mazhab].note}`}
        icon="book-open-variant"
        iconColor={theme.gold}
        onPress={() => setPicker('mazhab')}
      />

      <SettingRow
        label="Prayer time method"
        hint={labelForMethod(method)}
        icon="moon-waxing-crescent"
        iconColor={theme.accent}
        onPress={() => setPicker('method')}
      />

      <SettingRow
        label="Refresh nisab spot prices"
        hint={
          nisabBusy
            ? 'Fetching gold + silver…'
            : nisabAuto
              ? `On — fetched ${fmtAge}`
              : 'Off — using fallback prices'
        }
        icon="cached"
        iconColor={theme.gold}
        trailing={
          <Pressable
            onPress={async () => {
              const next = !nisabAuto;
              kv.setBool('islamic.nisabAutoRefresh', next);
              setNisabAuto(next);
              if (next) {
                setNisabBusy(true);
                try {
                  const c = await refreshMetals();
                  setNisabFetched(c.fetchedAt);
                } catch (e) {
                  Alert.alert("Couldn't refresh", String(e));
                } finally {
                  setNisabBusy(false);
                }
              }
            }}
            style={[sectionStyles.toggle, nisabAuto && { backgroundColor: theme.accent }]}
            accessibilityRole="switch"
            accessibilityState={{ checked: nisabAuto }}
          >
            <View style={[sectionStyles.toggleKnob, nisabAuto && { transform: [{ translateX: 18 }] }]} />
          </Pressable>
        }
      />

      <PickerSheet
        visible={picker === 'mazhab'}
        title="Mazhab"
        options={(['hanafi', 'shafii', 'maliki', 'hanbali'] as Mazhab[]).map<PickerOption<Mazhab>>(
          (m) => ({
            value: m,
            label: MAZHABS[m].name,
            hint: MAZHABS[m].note,
          }),
        )}
        selected={zState.mazhab}
        onPick={(m) => {
          setZakatState({ mazhab: m });
          setZState(getZakatState());
        }}
        onClose={() => setPicker(null)}
      />

      <PickerSheet
        visible={picker === 'method'}
        title="Prayer time method"
        options={PRAYER_METHODS.map<PickerOption<CalcMethodId>>((m) => ({
          value: m.id,
          label: m.label,
        }))}
        selected={method}
        onPick={(id) => {
          setMethod(id);
          setMethodState(id);
        }}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

function labelForMethod(id: string): string {
  return PRAYER_METHODS.find((m) => m.id === id)?.label ?? id;
}
