// v2 Tab layout: Home | Plan | (FAB middle absolute) | Activity | Me.
// 4 tabs in the bar + FAB center-anchored absolute on top. The FAB takes
// no Tabs.Screen slot; we add invisible padding spacers in the bar so the
// 4 visible tabs split into 2-and-2 around the FAB.

import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { PRIMARY_COLOR } from '@/constants/flavor';
import { FabButton } from '@/components/FabButton';

export default function TabsLayout() {
  const router = useRouter();

  return (
    <View style={styles.root}>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: PRIMARY_COLOR,
          tabBarInactiveTintColor: theme.text3,
          tabBarStyle: styles.tabBar,
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
            the bar; the FAB lifts above. We adjust tab item spacing in styles. */}
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
      {/* Floating FAB — absolute, center-anchored, lifts above tab bar. */}
      <View style={styles.fabWrap} pointerEvents="box-none">
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
    height: 64,
    paddingBottom: 8,
    paddingTop: 6,
  },
  fabWrap: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
