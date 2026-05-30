// Numpad — 5 equal-width columns × 4 rows. The right column's bottom
// two cells merge into one tall primary-action key.
//
//   ÷ │ 1 │ 2 │ 3 │ ⌫
//   × │ 4 │ 5 │ 6 │ 📅
//   − │ 7 │ 8 │ 9 │ ✓  ← spans rows 3-4
//   + │ % │ 0 │ . │
//
// All five columns share the SAME flex:1 unit, so every cell is the
// same width. Rows are not used as the layout primitive — instead the
// pad is a row of 5 columns, each column rendering its own stack of
// keys top-to-bottom. This keeps cell widths aligned without fighting
// aspectRatio + flex inside a 3-section split.
//
// The tall primary key uses `flex: 2` (no aspectRatio) so it takes
// exactly the height of two regular cells plus the gap between them,
// matching the other columns' total height under alignItems: stretch.
//
// Hardcoded LTR — numeric keypads never flip in RTL languages.

import React from 'react';
import { View, Text, Pressable, StyleSheet, I18nManager } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, radii, font, sizes } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';

export type CalcOp = '+' | '-' | '*' | '/';

export interface NumpadProps {
  /** Digit / dot / percent / delete taps. Sends '0'-'9', '.', '%', 'del'. */
  onPress: (key: string) => void;
  /** Tap on the calendar icon — open the date picker. */
  onDate: () => void;
  /** Tap on the green primary key when in submit mode. */
  onSubmit: () => void;
  /** Tap on the primary key when in evaluate mode (math op queued). */
  onEvaluate: () => void;
  /** Operator tap from the always-visible left column. */
  onCalcOp: (op: CalcOp) => void;
  /** When true the primary key shows `=` and routes to onEvaluate. */
  awaitingEval: boolean;
  /** Accessibility label for the submit key. Defaults to "Submit". */
  submitLabel?: string;
}

const OPS: { op: CalcOp; glyph: string; label: string }[] = [
  { op: '/', glyph: '÷', label: 'divide' },
  { op: '*', glyph: '×', label: 'times' },
  { op: '-', glyph: '−', label: 'minus' },
  { op: '+', glyph: '+', label: 'plus' },
];

export function Numpad({
  onPress,
  onDate,
  onSubmit,
  onEvaluate,
  onCalcOp,
  awaitingEval,
  submitLabel = 'Submit',
}: NumpadProps) {
  const haptics = useHaptics();
  const rtl = I18nManager.isRTL;

  const Digit = ({ k, label }: { k: string; label?: string }) => (
    <Pressable
      onPressIn={haptics.tap}
      onPress={() => onPress(k)}
      style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
      accessibilityRole="button"
      accessibilityLabel={label ?? k}
    >
      <Text style={styles.keyText}>{k}</Text>
    </Pressable>
  );

  const OpKey = ({ op, glyph, label }: { op: CalcOp; glyph: string; label: string }) => (
    <Pressable
      onPressIn={haptics.tap}
      onPress={() => onCalcOp(op)}
      style={({ pressed }) => [styles.key, styles.opKey, pressed && styles.keyPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Text style={styles.opText}>{glyph}</Text>
    </Pressable>
  );

  const FnIcon = ({
    icon,
    onPress: onTap,
    label,
  }: {
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    onPress: () => void;
    label: string;
  }) => (
    <Pressable
      onPressIn={haptics.tap}
      onPress={onTap}
      style={({ pressed }) => [styles.key, styles.fnKey, pressed && styles.keyPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialCommunityIcons name={icon} size={22} color={theme.text1} />
    </Pressable>
  );

  const PrimaryAction = () => (
    <Pressable
      onPressIn={haptics.tap}
      onPress={awaitingEval ? onEvaluate : onSubmit}
      style={({ pressed }) => [
        styles.key,
        styles.primaryKey,
        pressed && styles.keyPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={awaitingEval ? 'Evaluate' : submitLabel}
    >
      {awaitingEval ? (
        <Text style={styles.equalsText}>=</Text>
      ) : (
        <MaterialCommunityIcons name="check" size={28} color={theme.bg} />
      )}
    </Pressable>
  );

  return (
    <View style={[styles.wrap, rtl && { direction: 'ltr' }]}>
      <View style={styles.col}>
        {OPS.map((o) => (
          <OpKey key={o.op} op={o.op} glyph={o.glyph} label={o.label} />
        ))}
      </View>
      <View style={styles.col}>
        <Digit k="1" /><Digit k="4" /><Digit k="7" /><Digit k="%" label="percent" />
      </View>
      <View style={styles.col}>
        <Digit k="2" /><Digit k="5" /><Digit k="8" /><Digit k="0" />
      </View>
      <View style={styles.col}>
        <Digit k="3" /><Digit k="6" /><Digit k="9" /><Digit k="." label="decimal" />
      </View>
      <View style={styles.col}>
        <FnIcon icon="backspace-outline" onPress={() => onPress('del')} label="Delete" />
        <FnIcon icon="calendar-outline" onPress={onDate} label="Pick date" />
        <PrimaryAction />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Five columns, gap:8 between them. Each column flex:1 → identical
  // widths, so digit cells, op cells, fn cells, and the tall primary
  // key all share the same column width.
  wrap: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  col: { flex: 1, gap: 8 },
  key: {
    width: '100%',
    aspectRatio: 1.15,
    backgroundColor: theme.bg2,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  fnKey: { backgroundColor: theme.bg3 },
  opKey: { backgroundColor: theme.bg3 },
  // Primary spans rows 3-4 of its column. The other two cells in the
  // column have height = colW/aspectRatio; the column's total height
  // is set by the four-cell columns (left ops + 3 digits) via the
  // wrap's alignItems:stretch, so the primary key just fills whatever
  // remains via flex:2 with no aspectRatio constraint.
  primaryKey: {
    aspectRatio: undefined,
    flex: 2,
    backgroundColor: theme.accent,
    borderColor: 'transparent',
  },
  keyPressed: {
    backgroundColor: theme.bg4,
    transform: [{ scale: 0.94 }],
  },
  keyText: {
    color: theme.text1,
    fontFamily: font.display,
    fontSize: sizes.xxl,
  },
  opText: {
    color: theme.text1,
    fontFamily: font.display,
    fontSize: sizes.xl,
  },
  equalsText: {
    color: theme.bg,
    fontFamily: font.display,
    fontSize: 36,
  },
});
