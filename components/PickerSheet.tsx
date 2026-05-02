// PickerSheet — bottom-sheet style option picker.
//
// Used by every "tap-the-row-to-pick" pattern: language, currency, mazhab,
// prayer method, account in transfer mode, etc. Renders a list of options
// each with optional icon + subtitle. Single-select; tapping an option
// fires onPick + closes.
//
// Implementation: react-native Modal with semi-transparent backdrop.

import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, font, sizes, radii, spacing } from '@/constants/theme';

export interface PickerOption<T extends string> {
  value: T;
  label: string;
  hint?: string;
  icon?: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  iconColor?: string;
}

export interface PickerSheetProps<T extends string> {
  visible: boolean;
  title: string;
  options: PickerOption<T>[];
  selected?: T | null;
  onPick: (value: T) => void;
  onClose: () => void;
}

export function PickerSheet<T extends string>({
  visible,
  title,
  options,
  selected,
  onPick,
  onClose,
}: PickerSheetProps<T>) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>
        <ScrollView contentContainerStyle={styles.list}>
          {options.map((opt) => {
            const isSel = selected === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  onPick(opt.value);
                  onClose();
                }}
                style={[styles.row, isSel && styles.rowSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected: isSel }}
                accessibilityLabel={`${opt.label}${opt.hint ? '. ' + opt.hint : ''}`}
              >
                {opt.icon && (
                  <MaterialCommunityIcons
                    name={opt.icon}
                    size={20}
                    color={opt.iconColor ?? theme.text2}
                  />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.label, isSel && { color: theme.accent, fontFamily: font.bodySemi }]}>
                    {opt.label}
                  </Text>
                  {opt.hint ? <Text style={styles.hint}>{opt.hint}</Text> : null}
                </View>
                {isSel && (
                  <MaterialCommunityIcons name="check" size={20} color={theme.accent} />
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '75%',
    backgroundColor: theme.bg1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    marginBottom: spacing.md,
  },
  title: {
    color: theme.text1,
    fontSize: sizes.lg,
    fontFamily: font.displayBold,
    marginBottom: spacing.sm,
  },
  list: { gap: 4, paddingBottom: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  rowSelected: { backgroundColor: theme.bg3 },
  label: { color: theme.text1, fontSize: sizes.md, fontFamily: font.body },
  hint: { color: theme.text3, fontSize: sizes.xs, marginTop: 2 },
});
