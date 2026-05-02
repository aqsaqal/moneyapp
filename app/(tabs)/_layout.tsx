// v2 Tab layout: Home | Plan | (FAB middle absolute) | Activity | Me.
// 4 tabs + FAB center-anchored absolute on top.
//
// Edge-to-edge note (Android Samsung gestures + 3-button nav, iOS home
// indicator): the system nav bar overlays the bottom of the screen. We
// expand the tab bar's bottom padding by `insets.bottom` so tab targets
// sit ABOVE system gestures, not under them. The FAB lifts the same
// amount so it stays vertically centered relative to the tab bar.

import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '@/constants/theme';
import { PRIMARY_COLOR } from '@/constants/flavor';
import { FabButton } from '@/components/FabButton';

const TAB_BAR_HEIGHT = 64;
const TAB_BAR_PAD_BOTTOM = 8;
const FAB_BASELINE_BOTTOM = 24; // base lift above tab bar floor

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Push tab bar up by the system inset so its tap targets clear gesture nav.
  const tabBarHeight = TAB_BAR_HEIGHT + insets.bottom;
  const tabBarPaddingBottom = TAB_BAR_PAD_BOTTOM + insets.bottom;
  // FAB sits roughly centered against the tab bar's visual middle.
  const fabBottom = FAB_BASELINE_BOTTOM + insets.bottom;

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: PRIMARY_COLOR,
          tabBarInactiveTintColor: theme.text3,
          tabBarStyle: [
            styles.tabBar,
            { height: tabBarHeight, paddingBottom: tabBarPaddingBottom },
          ],
          tabBarLabelStyle: { fontSize: 11 },
          tabBarItemStyle: { paddingHorizontal: 0 },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Home',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="home-variant" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="plan"
          options={{
            title: 'Plan',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="calendar-check" size={size} color={color} />
            ),
          }}
        />
        {/* No center "spacer" screen — the FAB is absolute-positioned and visually
            sits between Plan and Activity. The 4 tab items split evenly across
            the bar; the FAB lifts above. */}
        <Tabs.Screen
          name="activity"
          options={{
            title: 'Activity',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="format-list-bulleted" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="me"
          options={{
            title: 'Me',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="account-circle-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
      {/* Floating FAB — absolute, center-anchored, lifts above tab bar AND system nav. */}
      <View
        style={[styles.fabWrap, { bottom: fabBottom }]}
        pointerEvents="box-none"
      >
        <FabButton onPress={() => router.push('/add')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  tabBar: {
    backgroundColor: theme.bg1,
    borderTopColor: theme.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 6,
  },
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
