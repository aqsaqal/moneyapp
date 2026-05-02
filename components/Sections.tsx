// Shared section primitives used across Plan, Activity, Me tabs (v2 IA).
// Originally lived inline in v1's app/(tabs)/more.tsx. Extracted so the
// 4-tab redesign can reuse them without duplication or cross-screen import
// loops.

import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { formatMoney, type CurrencyCode } from '@/constants/currency';

/** Uppercase, letter-spaced section heading. Optional trailing "+" tap target
 *  (`onAdd`) for sections with quick-add affordance (Plan → Expenses/Income/
 *  Budgets, etc.). */
export function SectionHeader({
  title,
  style,
  onAdd,
  addLabel,
}: {
  title: string;
  style?: ViewStyle;
  onAdd?: () => void;
  addLabel?: string;
}) {
  if (!onAdd) {
    return <Text style={[sectionStyles.section, style as never]}>{title}</Text>;
  }
  return (
    <View style={[sectionStyles.headerRow, style as never]}>
      <Text style={sectionStyles.section}>{title}</Text>
      <Pressable
        onPress={onAdd}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={addLabel ?? `Add ${title.toLowerCase()}`}
        style={({ pressed }) => [sectionStyles.headerAdd, pressed && { opacity: 0.6 }]}
      >
        <MaterialCommunityIcons name="plus" size={18} color={theme.accent} />
      </Pressable>
    </View>
  );
}

/** Half-width side-by-side card showing a labelled monetary total. */
export function SummaryCard({
  label,
  value,
  color,
  currency,
}: {
  label: string;
  value: number;
  color: string;
  currency: CurrencyCode;
}) {
  return (
    <View style={[sectionStyles.summary, { borderColor: theme.border }]}>
      <Text style={sectionStyles.summaryLabel}>{label}</Text>
      <Text style={[sectionStyles.summaryValue, { color }]}>{formatMoney(value, currency)}</Text>
    </View>
  );
}

/** Small stat tile used in 2-up or 4-up grids (Activity analytics, etc.). */
export function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={sectionStyles.stat}>
      <Text style={sectionStyles.statLabel}>{label}</Text>
      <Text style={sectionStyles.statValue}>{value}</Text>
    </View>
  );
}

/** Dashed-border "+ Add X" affordance row at the bottom of lists. */
export function AddRow({
  label,
  onPress,
  color = theme.accent,
}: {
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable style={sectionStyles.addRow} onPress={onPress}>
      <MaterialCommunityIcons name="plus" size={18} color={color} />
      <Text style={[sectionStyles.addText, { color }]}>{label}</Text>
    </Pressable>
  );
}

/** Single setting row — leading optional icon, label + hint, trailing accessory. */
export function SettingRow({
  label,
  hint,
  icon,
  iconColor = theme.accent,
  trailing,
  onPress,
}: {
  label: string;
  hint?: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconColor?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
}) {
  const Inner = (
    <>
      {icon && <MaterialCommunityIcons name={icon} size={20} color={iconColor} />}
      <View style={{ flex: 1 }}>
        <Text style={sectionStyles.settingLabel}>{label}</Text>
        {hint ? <Text style={sectionStyles.settingHint}>{hint}</Text> : null}
      </View>
      {trailing}
    </>
  );
  if (onPress) {
    return (
      <Pressable style={sectionStyles.settingRow} onPress={onPress} accessibilityRole="button">
        {Inner}
      </Pressable>
    );
  }
  return <View style={sectionStyles.settingRow}>{Inner}</View>;
}

export const sectionStyles = StyleSheet.create({
  section: { color: theme.text2, fontSize: sizes.sm, textTransform: 'uppercase', letterSpacing: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerAdd: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${theme.accent}22`,
  },
  summaryRow: { flexDirection: 'row', gap: spacing.md },
  summary: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: 4,
    backgroundColor: theme.bg2,
  },
  summaryLabel: { color: theme.text2, fontSize: sizes.xs },
  summaryValue: { fontSize: sizes.xl, fontFamily: font.display, fontWeight: '700' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: {
    flexBasis: '47%',
    flexGrow: 1,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  statLabel: { color: theme.text2, fontSize: sizes.xs },
  statValue: {
    color: theme.text1,
    fontSize: sizes.lg,
    fontFamily: font.display,
    fontWeight: '700',
    marginTop: 4,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.border,
  },
  addText: { fontSize: sizes.sm },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  settingLabel: { color: theme.text1, fontSize: sizes.md },
  settingHint: { color: theme.text3, fontSize: sizes.xs, marginTop: 2 },
  // Carried over for downstream consumers' inline overrides
  chipRow: { gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10, // bumped from 6 → 10 (a11y touch-target Phase 9 prep)
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg2,
  },
  chipText: { color: theme.text2, fontSize: sizes.sm },
  toggle: {
    width: 40,
    height: 22,
    borderRadius: 11,
    padding: 2,
    backgroundColor: theme.bg3,
    justifyContent: 'center',
  },
  toggleKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: theme.text1 },
});
