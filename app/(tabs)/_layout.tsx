// v2 Tab layout: Home | Plan | (FAB middle absolute) | Activity | Me.
//
// 4 tabs + FAB center-anchored absolute on top.
//
// Custom tab bar lays out tabs as [Home, Plan, SPACER, Activity, Me] so the
// inner two tabs (Plan, Activity) sit at the same distance from the FAB as
// the outer two (Home, Me) do from each other — visually balanced.
// React Navigation's default 4-tab layout splits the bar evenly, which
// pushes Plan/Activity uncomfortably close to the FAB.
//
// Edge-to-edge: the system gesture / 3-button nav bar overlays the bottom
// of the screen. We expand `paddingBottom` and `height` by insets.bottom
// so tap targets sit above system gestures, not under them. The FAB lifts
// the same amount.

import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type {
  BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { theme } from '@/constants/theme';
import { PRIMARY_COLOR } from '@/constants/flavor';
import { FabButton } from '@/components/FabButton';
import { useT } from '@/hooks/useT';

const TAB_BAR_HEIGHT = 64;
const TAB_BAR_PAD_BOTTOM = 8;
const FAB_BASELINE_BOTTOM = 24;
const FAB_SPACER_WIDTH = 72;

const TAB_ICONS: Record<
  string,
  React.ComponentProps<typeof MaterialCommunityIcons>['name']
> = {
  index: 'home-variant',
  plan: 'calendar-check',
  activity: 'format-list-bulleted',
  me: 'wallet-outline',
};
const TAB_LABEL_KEYS: Record<string, string> = {
  index: 'tabs.home',
  plan: 'tabs.plan',
  activity: 'tabs.activity',
  me: 'tabs.me',
};
// Visual order in the bar — splits 2 + spacer + 2 around the FAB.
const TAB_ORDER = ['index', 'plan', '__spacer__', 'activity', 'me'] as const;

function CustomTabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const t = useT();
  // Build map: route name → state.index, so we can render in our preferred order.
  const routeByName = new Map(state.routes.map((r, i) => [r.name, { route: r, idx: i }]));

  return (
    <View
      style={[
        styles.tabBar,
        {
          height: TAB_BAR_HEIGHT + insets.bottom,
          paddingBottom: TAB_BAR_PAD_BOTTOM + insets.bottom,
        },
      ]}
    >
      {TAB_ORDER.map((slot, i) => {
        if (slot === '__spacer__') {
          return <View key="spacer" style={{ width: FAB_SPACER_WIDTH }} pointerEvents="none" />;
        }
        const entry = routeByName.get(slot);
        if (!entry) return null;
        const { route, idx } = entry;
        const focused = state.index === idx;
        const { options } = descriptors[route.key];
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name as never);
          }
        };
        const color = focused ? PRIMARY_COLOR : theme.text3;
        const label = t(TAB_LABEL_KEYS[slot]);
        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={styles.tabItem}
            accessibilityRole="button"
            accessibilityState={focused ? { selected: true } : {}}
            accessibilityLabel={label}
          >
            <MaterialCommunityIcons name={TAB_ICONS[slot]} size={24} color={color} />
            <Text style={[styles.tabLabel, { color }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fabBottom = FAB_BASELINE_BOTTOM + insets.bottom;

  return (
    <View style={styles.root}>
      <Tabs
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" options={{ title: 'Home' }} />
        <Tabs.Screen name="plan" options={{ title: 'Plan' }} />
        <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
        <Tabs.Screen name="me" options={{ title: 'Me' }} />
      </Tabs>
      <View style={[styles.fabWrap, { bottom: fabBottom }]} pointerEvents="box-none">
        <FabButton
          onPress={() => router.push('/add')}
          onLongPress={() => router.push('/category-grid')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.bg1,
    borderTopColor: theme.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: {
    fontSize: 11,
  },
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
