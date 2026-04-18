// Centralized haptic feel. Wraps expo-haptics so screens don't scatter raw
// ImpactFeedbackStyle constants.
//
// Philosophy matches v4: numpad = light, add-submit = success, long-press = medium.
// Never fire haptics on scroll or continuous gestures.

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const enabled = Platform.OS !== 'web';

export function useHaptics() {
  return {
    tap: () => {
      if (!enabled) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    press: () => {
      if (!enabled) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    success: () => {
      if (!enabled) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    warn: () => {
      if (!enabled) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    },
    error: () => {
      if (!enabled) return;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    },
  };
}
