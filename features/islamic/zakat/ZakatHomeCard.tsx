// Compact Zakat status card on Home — gold accent per spec line 366.
// Shows: zakat due (if hawl complete), or days until hawl completes.
// Tone: factual; no rhetoric.

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';
import { formatMoney } from '@/constants/currency';
import { useZakatCalculation } from './useZakatCalculation';

export function ZakatHomeCard() {
  const z = useZakatCalculation();
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push('/(islamic)/zakat' as never)} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.iconBox}>
          <MaterialCommunityIcons name="hand-heart" size={22} color={theme.gold} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.label}>Zakat estimate</Text>
          <Text style={styles.value}>
            {z.zakatDue > 0
              ? formatMoney(z.zakatDue, z.currency)
              : z.meetsNisab
              ? `Hawl in ${z.hawl.daysRemaining} days`
              : 'Below nisab threshold'}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.text3} />
      </View>
      <Text style={styles.disclaimer}>
        Calculated by the {z.appliedMazhab} method · Consult your local scholar
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: `${theme.gold}55`,
    gap: 10,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  iconBox: {
    width: 40, height: 40, borderRadius: radii.md,
    backgroundColor: `${theme.gold}22`,
    alignItems: 'center', justifyContent: 'center',
  },
  label: { color: theme.text2, fontSize: sizes.xs, fontFamily: font.body },
  value: { color: theme.gold, fontSize: sizes.xl, fontFamily: font.displayBold },
  disclaimer: { color: theme.text3, fontSize: sizes.xs, fontStyle: 'italic' },
});
