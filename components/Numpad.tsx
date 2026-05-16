// Numpad — Phase 10z layout.
//
//   [ 1 ][ 2 ][ 3 ][ ⌫ ]
//   [ 4 ][ 5 ][ 6 ][ 📅 ]
//   [ 7 ][ 8 ][ 9 ][ 🧮 ]
//   [ . ][ 0 ][   ][ ✓ ]
//
// Right column holds the function keys; the 3×4 digit grid is
// unchanged. Tapping 🧮 toggles a single operators row that appears
// BELOW the numpad — the digit grid never shifts. The empty cell next
// to 0 matches every native phone keypad.
//
// Hardcoded LTR (I18nManager.swapLeftAndRightInRTL = false at the
// component root) — numeric keypads never flip in RTL languages.

import React from 'react';
import { View, Text, Pressable, StyleSheet, I18nManager } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, radii, font, sizes, spacing } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';

export type CalcOp = '+' | '-' | '*' | '/';

export interface NumpadProps {
  /** Digit / dot taps. Sends '0'-'9' or '.'. Delete sends 'del' to
   *  match the previous API; that key is in the side column now. */
  onPress: (key: string) => void;
  /** Tap on the calendar icon — open the date picker. */
  onDate: () => void;
  /** Tap on the green check — submit the form. */
  onSubmit: () => void;
  /** Tap on the calculator icon — toggle the operators row. */
  onCalcToggle: () => void;
  /** Operator tap from the toggle row (only fires when `calcOpen`). */
  onCalcOp?: (op: CalcOp) => void;
  /** When true, render the operators row below the numpad. */
  calcOpen?: boolean;
  /** Label / accessibility for the submit key. Defaults to "Submit". */
  submitLabel?: string;
}

export function Numpad({
  onPress,
  onDate,
  onSubmit,
  onCalcToggle,
  onCalcOp,
  calcOpen = false,
  submitLabel = 'Submit',
}: NumpadProps) {
  const haptics = useHaptics();
  const rtl = I18nManager.isRTL;

  const Digit = ({ k }: { k: string }) => (
    <Pressable
      onPressIn={haptics.tap}
      onPress={() => onPress(k)}
      style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
      accessibilityRole="button"
      accessibilityLabel={k}
    >
      <Text style={styles.keyText}>{k}</Text>
    </Pressable>
  );

  const FnKey = ({
    icon,
    onPress: onTap,
    label,
    accent = false,
  }: {
    icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
    onPress: () => void;
    label: string;
    accent?: boolean;
  }) => (
    <Pressable
      onPressIn={haptics.tap}
      onPress={onTap}
      style={({ pressed }) => [
        styles.key,
        styles.fnKey,
        accent && styles.fnKeyAccent,
        pressed && styles.keyPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <MaterialCommunityIcons
        name={icon}
        size={22}
        color={accent ? theme.bg : theme.text1}
      />
    </Pressable>
  );

  return (
    <View style={[styles.wrap, rtl && { direction: 'ltr' }]}>
      <View style={styles.row}>
        <Digit k="1" /><Digit k="2" /><Digit k="3" />
        <FnKey icon="backspace-outline" onPress={() => onPress('del')} label="Delete" />
      </View>
      <View style={styles.row}>
        <Digit k="4" /><Digit k="5" /><Digit k="6" />
        <FnKey icon="calendar-outline" onPress={onDate} label="Pick date" />
      </View>
      <View style={styles.row}>
        <Digit k="7" /><Digit k="8" /><Digit k="9" />
        <FnKey
          icon={calcOpen ? 'calculator' : 'calculator-variant-outline'}
          onPress={onCalcToggle}
          label={calcOpen ? 'Hide calculator' : 'Calculator'}
        />
      </View>
      <View style={styles.row}>
        <Digit k="." /><Digit k="0" />
        <View style={[styles.key, styles.keyEmpty]} pointerEvents="none" />
        <FnKey icon="check" onPress={onSubmit} label={submitLabel} accent />
      </View>

      {calcOpen && (
        <View style={[styles.opRow]}>
          {(['+', '-', '*', '/'] as CalcOp[]).map((op) => (
            <Pressable
              key={op}
              onPressIn={haptics.tap}
              onPress={() => onCalcOp?.(op)}
              style={({ pressed }) => [styles.opKey, pressed && styles.keyPressed]}
              accessibilityRole="button"
              accessibilityLabel={
                op === '+' ? 'plus' : op === '-' ? 'minus' : op === '*' ? 'times' : 'divide'
              }
            >
              <Text style={styles.opText}>
                {op === '*' ? '×' : op === '/' ? '÷' : op === '-' ? '−' : '+'}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: { flexDirection: 'row', gap: 10 },
  key: {
    flex: 1,
    aspectRatio: 1.5,
    backgroundColor: theme.bg2,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  fnKey: { backgroundColor: theme.bg3 },
  fnKeyAccent: {
    backgroundColor: theme.accent,
    borderColor: 'transparent',
  },
  keyEmpty: {
    backgroundColor: 'transparent',
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
  opRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.xs,
  },
  opKey: {
    flex: 1,
    aspectRatio: 2.4,
    backgroundColor: theme.bg3,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.border,
  },
  opText: {
    color: theme.text1,
    fontFamily: font.display,
    fontSize: sizes.xl,
  },
});
