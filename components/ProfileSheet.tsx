// ProfileSheet — create / edit / delete profiles, switch active.
//
// One sheet handles three modes:
//   - mode='create' → new profile form
//   - mode='edit'   → edit existing profile (name / color / icon)
//   - mode='switch' → flat list of profiles + "+ New profile" tail
//
// Why a single sheet: keeps the surface tiny and consistent with the
// AccountSheet / RecurringSheet pattern already in use.

import React, { useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { useT } from '@/hooks/useT';
import {
  createProfile,
  deleteProfile,
  switchActiveProfile,
  updateProfile,
  PROFILE_COLORS,
  PROFILE_ICONS,
  type Profile,
} from '@/utils/profiles';

type Mode =
  | { kind: 'switch'; profiles: Profile[]; activeId: string }
  | { kind: 'edit'; profile: Profile }
  | { kind: 'create' };

export interface ProfileSheetProps {
  visible: boolean;
  mode: Mode | null;
  onClose: () => void;
}

export function ProfileSheet({ visible, mode, onClose }: ProfileSheetProps) {
  const t = useT();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PROFILE_COLORS[0]);
  const [icon, setIcon] = useState(PROFILE_ICONS[0]);

  React.useEffect(() => {
    if (!visible || !mode) return;
    if (mode.kind === 'edit') {
      setName(mode.profile.name);
      setColor(mode.profile.color);
      setIcon(mode.profile.icon);
    } else if (mode.kind === 'create') {
      setName('');
      setColor(PROFILE_COLORS[0]);
      setIcon(PROFILE_ICONS[0]);
    }
  }, [visible, mode]);

  const save = () => {
    if (!mode) return;
    if (!name.trim()) {
      Alert.alert(t('common.required'), t('profile.nameRequired'));
      return;
    }
    if (mode.kind === 'create') {
      const p = createProfile({ name, color, icon });
      switchActiveProfile(p.id);
    } else if (mode.kind === 'edit') {
      updateProfile(mode.profile.id, { name, color, icon });
    }
    onClose();
  };

  const askDelete = () => {
    if (!mode || mode.kind !== 'edit') return;
    Alert.alert(
      t('profile.deleteConfirm.title'),
      t('profile.deleteConfirm.body', { name: mode.profile.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            const r = deleteProfile(mode.profile.id);
            if (!r.ok && r.reason === 'last') {
              Alert.alert(t('profile.deleteLast.title'), t('profile.deleteLast.body'));
              return;
            }
            onClose();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.kav}
        pointerEvents="box-none"
      >
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        {mode?.kind === 'switch' ? (
          <SwitchList mode={mode} onClose={onClose} />
        ) : (
          <EditForm
            kind={mode?.kind ?? 'create'}
            name={name}
            setName={setName}
            color={color}
            setColor={setColor}
            icon={icon}
            setIcon={setIcon}
            onSave={save}
            onDelete={mode?.kind === 'edit' ? askDelete : undefined}
            onClose={onClose}
            t={t}
          />
        )}
      </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function SwitchList({ mode, onClose }: { mode: Extract<Mode, { kind: 'switch' }>; onClose: () => void }) {
  const t = useT();
  return (
    <View style={{ paddingBottom: spacing.lg }}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
          <MaterialCommunityIcons name="close" size={22} color={theme.text2} />
        </Pressable>
        <Text style={styles.title}>{t('profile.switch')}</Text>
        <View style={{ width: 22 }} />
      </View>
      <FlatList
        data={mode.profiles}
        keyExtractor={(p) => p.id}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              if (item.id !== mode.activeId) switchActiveProfile(item.id);
              onClose();
            }}
            style={styles.row}
            accessibilityRole="button"
            accessibilityState={{ selected: item.id === mode.activeId }}
          >
            <View style={[styles.iconBox, { backgroundColor: `${item.color}22` }]}>
              <MaterialCommunityIcons name={item.icon as never} size={20} color={item.color} />
            </View>
            <Text style={styles.rowName}>{item.name}</Text>
            {item.id === mode.activeId && (
              <MaterialCommunityIcons name="check" size={20} color={theme.accent} />
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

function EditForm({
  kind,
  name,
  setName,
  color,
  setColor,
  icon,
  setIcon,
  onSave,
  onDelete,
  onClose,
  t,
}: {
  kind: 'edit' | 'create';
  name: string;
  setName: (s: string) => void;
  color: string;
  setColor: (s: string) => void;
  icon: string;
  setIcon: (s: string) => void;
  onSave: () => void;
  onDelete?: () => void;
  onClose: () => void;
  t: (k: string) => string;
}) {
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.lg }}>
      <View style={styles.header}>
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
          <MaterialCommunityIcons name="close" size={22} color={theme.text2} />
        </Pressable>
        <Text style={styles.title}>{kind === 'edit' ? t('common.edit') : t('common.add')}</Text>
        <Pressable onPress={onSave} hitSlop={10} accessibilityLabel={t('common.save')}>
          <MaterialCommunityIcons name="check" size={22} color={theme.accent} />
        </Pressable>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t('profile.field.name')}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={t('profile.namePlaceholder')}
          placeholderTextColor={theme.text3}
          style={styles.input}
        />
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t('profile.field.color')}</Text>
        <View style={styles.swatchRow}>
          {PROFILE_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[styles.swatch, { backgroundColor: c }, color === c && styles.swatchActive]}
              accessibilityLabel={c}
            />
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{t('profile.field.icon')}</Text>
        <View style={styles.iconRow}>
          {PROFILE_ICONS.map((i) => (
            <Pressable
              key={i}
              onPress={() => setIcon(i)}
              style={[styles.iconChip, icon === i && { backgroundColor: `${color}33`, borderColor: color }]}
              accessibilityLabel={i}
            >
              <MaterialCommunityIcons name={i as never} size={20} color={icon === i ? color : theme.text2} />
            </Pressable>
          ))}
        </View>
      </View>

      {onDelete && (
        <Pressable onPress={onDelete} style={styles.deleteRow} accessibilityRole="button">
          <MaterialCommunityIcons name="trash-can-outline" size={18} color={theme.expense} />
          <Text style={styles.deleteText}>{t('common.delete')}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  kav: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '88%',
    backgroundColor: theme.bg1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  title: { color: theme.text1, fontSize: sizes.lg, fontFamily: font.displayBold },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.md,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowName: { flex: 1, color: theme.text1, fontSize: sizes.md },
  field: { gap: 6, marginBottom: spacing.md },
  fieldLabel: { color: theme.text3, fontSize: sizes.xs, letterSpacing: 0.5 },
  input: {
    backgroundColor: theme.bg2,
    color: theme.text1,
    fontFamily: font.body,
    fontSize: sizes.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
  },
  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  swatchActive: { borderColor: theme.text1 },
  iconRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.bg2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: spacing.md,
    marginTop: spacing.lg,
  },
  deleteText: { color: theme.expense, fontSize: sizes.sm, fontFamily: font.bodySemi },
});
