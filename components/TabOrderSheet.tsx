// TabOrderSheet — drag the four tabs into the order you want. The +
// button always stays in the middle; the first two land on its left, the
// last two on its right. Saved device-wide via utils/tabOrder.

import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { useT } from '@/hooks/useT';
import { useHaptics } from '@/hooks/useHaptics';
import {
  DEFAULT_TAB_ORDER,
  getTabOrder,
  setTabOrder,
  isDefaultTabOrder,
  type TabRoute,
} from '@/utils/tabOrder';

export const TAB_META: Record<TabRoute, { icon: React.ComponentProps<typeof MaterialCommunityIcons>['name']; labelKey: string }> = {
  index: { icon: 'home-variant', labelKey: 'tabs.home' },
  plan: { icon: 'calendar-check', labelKey: 'tabs.plan' },
  activity: { icon: 'format-list-bulleted', labelKey: 'tabs.activity' },
  accounts: { icon: 'wallet-outline', labelKey: 'tabs.me' },
};

export function TabOrderSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useT();
  const haptics = useHaptics();
  const [order, setOrder] = useState<TabRoute[]>(getTabOrder);
  useEffect(() => { if (visible) setOrder(getTabOrder()); }, [visible]);

  const apply = (next: TabRoute[]) => {
    setOrder(next);
    setTabOrder(next);
    haptics.tap();
  };

  const renderItem = ({ item, drag, isActive, getIndex }: RenderItemParams<TabRoute>) => {
    const meta = TAB_META[item];
    const i = getIndex() ?? 0;
    return (
      <ScaleDecorator activeScale={1.03}>
        <Pressable
          onLongPress={drag}
          delayLongPress={200}
          style={[styles.row, isActive && { borderColor: theme.accent }]}
          accessibilityRole="button"
          accessibilityLabel={`${t(meta.labelKey)}, ${i + 1}`}
        >
          <Text style={styles.pos}>{i + 1}</Text>
          <MaterialCommunityIcons name={meta.icon} size={22} color={theme.accent} />
          <Text style={styles.label}>{t(meta.labelKey)}</Text>
          <Pressable onPressIn={drag} hitSlop={10} style={{ padding: 4 }} accessibilityRole="button" accessibilityLabel={t('categories.dragHandle')}>
            <MaterialCommunityIcons name="drag" size={22} color={theme.text3} />
          </Pressable>
        </Pressable>
      </ScaleDecorator>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      {/* Android renders a Modal in its own window, outside the app's
          GestureHandlerRootView, so the drag list needs a root of its own
          here or long-press/drag never activates. */}
      <GestureHandlerRootView style={{ flex: 1 }}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
            <MaterialCommunityIcons name="close" size={22} color={theme.text2} />
          </Pressable>
          <Text style={styles.title}>{t('settings.tabOrder')}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.done')}>
            <Text style={styles.done}>{t('common.done')}</Text>
          </Pressable>
        </View>
        <Text style={styles.hint}>{t('settings.tabOrder.hint')}</Text>

        {/* Preview: how the bar will read, + fixed in the middle. */}
        <View style={styles.preview}>
          {order.map((r, i) => (
            <React.Fragment key={r}>
              {i === 2 && (
                <View style={styles.previewFab}>
                  <MaterialCommunityIcons name="plus" size={18} color={theme.bg} />
                </View>
              )}
              <View style={styles.previewTab}>
                <MaterialCommunityIcons name={TAB_META[r].icon} size={18} color={theme.text2} />
                <Text style={styles.previewLabel} numberOfLines={1}>{t(TAB_META[r].labelKey)}</Text>
              </View>
            </React.Fragment>
          ))}
        </View>

        <DraggableFlatList
          data={order}
          keyExtractor={(r) => r}
          renderItem={renderItem}
          onDragEnd={({ data }) => apply(data)}
          activationDistance={12}
          containerStyle={{ flexGrow: 0 }}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        />

        {!isDefaultTabOrder(order) && (
          <Pressable onPress={() => apply(DEFAULT_TAB_ORDER)} style={styles.reset} accessibilityRole="button">
            <MaterialCommunityIcons name="restore" size={16} color={theme.text2} />
            <Text style={styles.resetText}>{t('settings.tabOrder.reset')}</Text>
          </Pressable>
        )}
      </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.bg1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: theme.border },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: theme.text1, fontSize: sizes.lg, fontFamily: font.displayBold },
  done: { color: theme.accent, fontSize: sizes.md, fontFamily: font.bodySemi },
  hint: { color: theme.text3, fontSize: sizes.sm, lineHeight: 20 },
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  previewTab: { alignItems: 'center', gap: 2, flex: 1 },
  previewLabel: { color: theme.text3, fontSize: 10 },
  previewFab: { width: 36, height: 36, borderRadius: 18, backgroundColor: theme.accent, alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: theme.bg2,
    borderWidth: 1,
    borderColor: theme.border,
  },
  pos: { color: theme.text3, fontSize: sizes.sm, fontFamily: font.bodySemi, width: 14, textAlign: 'center' },
  label: { flex: 1, color: theme.text1, fontSize: sizes.md, fontFamily: font.body },
  reset: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: spacing.sm },
  resetText: { color: theme.text2, fontSize: sizes.sm, fontFamily: font.bodySemi },
});
