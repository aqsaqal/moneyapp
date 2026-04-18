import { Tabs } from 'expo-router';
import { PRIMARY_COLOR } from '@/constants/flavor';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: PRIMARY_COLOR,
        tabBarInactiveTintColor: '#55556A',
        tabBarStyle: {
          backgroundColor: '#0E0E18',
          borderTopColor: '#252538',
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="more" options={{ title: 'More' }} />
    </Tabs>
  );
}
