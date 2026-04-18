// Islamic stack — only materialized into app/(islamic)/ when APP_FLAVOR=islamic
// (see scripts/prepare-flavor.js).

import { Stack } from 'expo-router';
import { theme } from '@/constants/theme';

export default function IslamicLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: theme.bg },
      }}
    />
  );
}
