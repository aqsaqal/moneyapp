// Receipt OCR — Phase 10m.
//
// Pipeline:
//   1. expo-image-picker captures or picks a photo (camera or library).
//   2. ML Kit Text Recognition runs on-device on the image (Android +
//      iOS via @react-native-ml-kit/text-recognition).
//   3. parseReceipt() walks the recognized blocks and tries to pull out
//      a {total, date, merchant} triple. The regex set is intentionally
//      conservative — when the receipt format is exotic the parser
//      returns whatever fields it could find with high confidence and
//      lets the user fill in the rest.
//
// Privacy:
//   - The image stays on device. ML Kit's text-recognition module runs
//     entirely locally; no audio or pixel data leaves the device.
//   - Only the parsed text excerpt + the saved image path are persisted.
//
// Lazy import keeps the dev client from crashing if a binary predates
// the native module.

import * as ImagePicker from 'expo-image-picker';
import { parseReceipt, type ParsedReceipt } from './receiptParser';

export type { ParsedReceipt } from './receiptParser';
export { parseReceipt } from './receiptParser';

// Lazy require so a binary that predates the native ML Kit module can
// still load this module without crashing.
function getMlkitTextRecognition():
  | { recognize: (uri: string) => Promise<{ text: string; blocks: { text: string }[] }> }
  | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-ml-kit/text-recognition');
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

/** Open the OS image picker (camera + library both available) and
 *  return the chosen URI. Returns null on cancel / permission denial. */
export async function captureReceiptImage(source: 'camera' | 'library' = 'camera'): Promise<string | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
    const r = await ImagePicker.launchCameraAsync({
      mediaTypes: 'images',
      quality: 0.7,
      exif: false,
    });
    if (r.canceled) return null;
    return r.assets[0]?.uri ?? null;
  }
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;
  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    quality: 0.7,
    exif: false,
  });
  if (r.canceled) return null;
  return r.assets[0]?.uri ?? null;
}

/** Run on-device OCR + the heuristic parser. Returns null when the
 *  native module isn't present (older binary). */
export async function recognizeReceipt(uri: string): Promise<ParsedReceipt | null> {
  const mlkit = getMlkitTextRecognition();
  if (!mlkit) return null;
  const result = await mlkit.recognize(uri);
  return parseReceipt(result.text);
}

