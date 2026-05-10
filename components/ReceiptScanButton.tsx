// ReceiptScanButton — opens the camera, runs ML Kit OCR, and reports
// {amount, note} back to the Add modal so the form is pre-filled. Lives
// next to VoiceMicButton in the note row of app/add.tsx.
//
// Hidden when the native module is missing (old binary) — same pattern
// as VoiceMicButton.

import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { useT } from '@/hooks/useT';
import { captureReceiptImage, recognizeReceipt, type ParsedReceipt } from '@/utils/receiptOcr';

export interface ReceiptScanButtonProps {
  onScanned: (result: { amount: number | null; note: string | null; receiptUri: string }) => void;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

export function ReceiptScanButton({ onScanned, size = 22, style }: ReceiptScanButtonProps) {
  const t = useT();
  const haptics = useHaptics();
  const [busy, setBusy] = useState(false);

  const tap = async () => {
    if (busy) return;
    haptics.tap();
    setBusy(true);
    try {
      const uri = await captureReceiptImage('camera');
      if (!uri) return;
      let parsed: ParsedReceipt | null = null;
      try {
        parsed = await recognizeReceipt(uri);
      } catch (e) {
        Alert.alert(t('receipt.failed'), String(e));
      }
      onScanned({
        amount: parsed?.total ?? null,
        note: parsed?.merchant ?? null,
        receiptUri: uri,
      });
    } catch (e) {
      Alert.alert(t('receipt.failed'), String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={style}>
      <Pressable
        onPress={tap}
        style={({ pressed }) => [
          styles.btn,
          busy && styles.btnBusy,
          pressed && { transform: [{ scale: 0.94 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('receipt.scan')}
        disabled={busy}
      >
        <MaterialCommunityIcons
          name={busy ? 'progress-clock' : 'camera-outline'}
          size={size}
          color={theme.text2}
        />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnBusy: {
    backgroundColor: `${theme.accent}22`,
  },
});
