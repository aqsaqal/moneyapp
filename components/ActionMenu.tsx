// Bottom-sheet "quick actions" menu — invoked from a long-press on
// Plan tab rows. Generic shape so the same component renders the
// recurring / goal / budget option lists with no per-type forks.

import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';

export interface ActionMenuOption {
  label: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  destructive?: boolean;
  onPress: () => void;
}

export interface ActionMenuProps {
  visible: boolean;
  title?: string;
  options: ActionMenuOption[];
  onClose: () => void;
}

export function ActionMenu({ visible, title, options, onClose }: ActionMenuProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        {title && <Text style={styles.title} numberOfLines={1}>{title}</Text>}
        {options.map((opt, i) => (
          <Pressable
            key={i}
            onPress={() => {
              onClose();
              // Defer to next tick so the modal can finish dismissing
              // before the action (which might open another modal/Alert).
              setTimeout(opt.onPress, 50);
            }}
            style={styles.row}
            accessibilityRole="button"
            accessibilityLabel={opt.label}
          >
            <MaterialCommunityIcons
              name={opt.icon}
              size={20}
              color={opt.destructive ? theme.expense : theme.text2}
            />
            <Text style={[styles.label, opt.destructive && { color: theme.expense }]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: theme.bg1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    marginBottom: spacing.md,
  },
  title: {
    color: theme.text3, fontSize: sizes.sm, fontFamily: font.bodySemi,
    marginBottom: spacing.sm, paddingHorizontal: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
  },
  label: { color: theme.text1, fontSize: sizes.md, fontFamily: font.body },
});
