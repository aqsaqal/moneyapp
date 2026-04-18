// SearchBar — debounced text input for History screen (§6 item 4).

import React, { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, radii, font, sizes } from '@/constants/theme';

export function SearchBar({
  value,
  onChange,
  placeholder = 'Search',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  useEffect(() => {
    const t = setTimeout(() => onChange(local), 150);
    return () => clearTimeout(t);
  }, [local, onChange]);
  return (
    <View style={styles.wrap}>
      <MaterialCommunityIcons name="magnify" size={16} color={theme.text3} />
      <TextInput
        value={local}
        onChangeText={setLocal}
        placeholder={placeholder}
        placeholderTextColor={theme.text3}
        style={styles.input}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: theme.bg2,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  input: { flex: 1, color: theme.text1, fontFamily: font.body, fontSize: sizes.md, paddingVertical: 0 },
});
