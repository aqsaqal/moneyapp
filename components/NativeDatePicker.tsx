// NativeDatePicker — one cross-platform calendar for every "pick a day"
// field (Smart Add date, event start/end, goal target date).
//
//   Android  the system dialog; it closes itself after one pick, so a
//            single onChange event carries the result.
//   iOS      the inline calendar fires onChange on EVERY interaction —
//            including moving between months — so closing on the first
//            event made it vanish mid-pick and sometimes left a date a
//            month ahead. Render it in a card and keep it open until Done.
//
// The native module is required lazily so platforms that don't bundle
// it (web, tests) still import this file safely.

import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { useT } from '@/hooks/useT';
import { kv } from '@/utils/kv';

type DateTimePickerModule = typeof import('@react-native-community/datetimepicker').default;
let _datePicker: DateTimePickerModule | null = null;
export function getDatePicker(): DateTimePickerModule | null {
  if (_datePicker) return _datePicker;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _datePicker = require('@react-native-community/datetimepicker').default as DateTimePickerModule;
  } catch {
    _datePicker = null;
  }
  return _datePicker;
}

export interface NativeDatePickerProps {
  value: Date;
  onChange: (d: Date) => void;
  /** Called when the picker should go away (Done on iOS, any dismissal on Android). */
  onClose: () => void;
  minimumDate?: Date;
  maximumDate?: Date;
}

export function NativeDatePicker({ value, onChange, onClose, minimumDate, maximumDate }: NativeDatePickerProps) {
  const t = useT();
  const DateTimePicker = getDatePicker();
  const locale = (kv.get('locale') ?? 'en-US') as never;
  if (!DateTimePicker) {
    onClose();
    return null;
  }
  if (Platform.OS === 'ios') {
    return (
      <View style={styles.card}>
        <DateTimePicker
          value={value}
          mode="date"
          display="inline"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          locale={locale}
          themeVariant="dark"
          accentColor={theme.accent}
          onChange={(_e, selected) => { if (selected) onChange(selected); }}
        />
        <Pressable onPress={onClose} style={styles.done} accessibilityRole="button" accessibilityLabel={t('common.done')}>
          <Text style={styles.doneText}>{t('common.done')}</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <DateTimePicker
      value={value}
      mode="date"
      display="default"
      minimumDate={minimumDate}
      maximumDate={maximumDate}
      // Honour the in-app language setting — without this the Android
      // dialog falls back to the OS locale.
      locale={locale}
      onChange={(event, selected) => {
        onClose();
        if (event.type === 'set' && selected) onChange(selected);
      }}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg2,
    paddingBottom: spacing.xs,
  },
  done: { alignSelf: 'flex-end', paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  doneText: { color: theme.accent, fontSize: sizes.md, fontFamily: font.bodySemi },
});
