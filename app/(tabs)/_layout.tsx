// Tab layout: Home | FAB (middle) | History | More.
// The FAB is its own route (add.tsx as modal); we customize the tab bar to
// render it as a raised button in the middle slot.

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
          name="history"
          options={{
            title: 'History',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="format-list-bulleted" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="more"
          options={{
            title: 'More',
            tabBarIcon: ({ color, size }) => (
              <MaterialCommunityIcons name="dots-horizontal-circle-outline" size={size} color={color} />
            ),
          }}
        />
      </Tabs>
      {/* Floating FAB — absolute-positioned, center-anchored, lifts above tab bar. */}
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
