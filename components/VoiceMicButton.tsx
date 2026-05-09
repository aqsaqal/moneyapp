// VoiceMicButton — tap-to-record speech that fills the Add modal's amount + note.
//
// Uses @react-native-voice/voice (Apple Speech / Android Speech Recognizer).
// Free, on-device-when-possible. Privacy disclosure in iOS Info.plist
// NSSpeechRecognitionUsageDescription + Android RECORD_AUDIO permission.
//
// Parser:
//   "twelve fifty coffee" → amount=12.50, note="coffee"
//   "12 lunch"            → amount=12,    note="lunch"
//   "uber 14"             → amount=14,    note="uber"
//   "coffee"              → amount=null,  note="coffee"
// Numbers are extracted greedy-first (largest decimal-like substring); the
// remaining text becomes the note. Verbal numerals ("twelve fifty") are mapped
// via a small word→digit table covering 0-99 + decimals.

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, font, sizes, radii } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';

// Lazy-imported so the dev client without native module installed doesn't crash.
type VoiceModule = typeof import('@react-native-voice/voice').default;
let _voice: VoiceModule | null = null;
function getVoice(): VoiceModule | null {
  if (_voice) return _voice;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-voice/voice').default as VoiceModule;
    // The library's wrapper instance always loads; the underlying NativeModule
    // (`NativeModules.Voice`) may still be null when the native side hasn't
    // been compiled into this build (e.g. older APK predating the dep). In
    // that case we want to behave like "not available" — the wrapper will
    // throw "cannot read property 'startSpeech' of null" otherwise.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NativeModules } = require('react-native');
    if (!NativeModules?.Voice) return null;
    _voice = mod;
    return _voice;
  } catch {
    return null;
  }
}

export interface VoiceParse {
  amount: number | null;
  note: string;
}

export function parseVoiceInput(text: string): VoiceParse {
  if (!text) return { amount: null, note: '' };
  // Convert spelled numbers ("twelve fifty") → "12.50". This handles common
  // English; Arabic / Spanish / etc. ride entirely on numeric digits in the
  // recognizer output.
  const expanded = expandSpelledNumbers(text);
  // Pull the first number-like substring.
  const m = expanded.match(/(-?\d+(?:[.,]\d+)?)/);
  let amount: number | null = null;
  let note = expanded;
  if (m) {
    amount = parseFloat(m[1].replace(',', '.'));
    note = (expanded.slice(0, m.index!) + ' ' + expanded.slice(m.index! + m[0].length)).trim();
  }
  // Strip filler words.
  note = note
    .replace(/\b(?:dollars?|bucks?|riyal|riyals|dirham|dirhams|euros?|pounds?|cents?|for|on|at|the|a|an)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  return { amount, note };
}

const SPELLED: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9,
  ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16,
  seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  sixty: 60, seventy: 70, eighty: 80, ninety: 90, hundred: 100,
};

/** Replaces sequences like "twelve fifty" with "12.50" or "twenty five" with "25". */
function expandSpelledNumbers(s: string): string {
  const tokens = s.toLowerCase().split(/\s+/);
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (a in SPELLED && b in SPELLED) {
      const va = SPELLED[a];
      const vb = SPELLED[b];
      // "twenty five" → 25
      if (va >= 20 && va < 100 && vb < 10) {
        out.push(String(va + vb));
        i += 2;
        continue;
      }
      // "twelve fifty" → 12.50 (when the second is a "tens" word)
      if (va < 20 && vb >= 20 && vb < 100) {
        out.push(`${va}.${vb.toString().padStart(2, '0')}`);
        i += 2;
        continue;
      }
      // "five point fifty" handled below
    }
    if (a in SPELLED) {
      out.push(String(SPELLED[a]));
      i += 1;
      continue;
    }
    out.push(a);
    i += 1;
  }
  return out.join(' ').replace(/\s+point\s+/g, '.');
}

export interface VoiceMicButtonProps {
  /** Called with the parsed amount + note when speech ends. */
  onResult: (parsed: VoiceParse) => void;
  /** ISO locale for the recognizer; pass 'ar-SA' for Arabic, etc. Default 'en-US'. */
  locale?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
}

function friendlyError(raw: unknown): string {
  const msg = String(typeof raw === 'object' && raw && 'message' in raw ? (raw as { message: string }).message : raw);
  // iOS SFSpeechRecognizer error 1700 / 300 family: recognizer not available
  // on this device. Almost always the iOS Simulator (no Apple speech services
  // wired up) — guide the user to a real device instead of dumping the code.
  if (/^\s*300\b|recognizer/i.test(msg)) {
    return 'Voice not supported on this simulator — try a real device.';
  }
  // Android: native module missing → "cannot read property 'startSpeech' of null".
  if (/startSpeech/i.test(msg) || /null is not an object/i.test(msg)) {
    return 'Voice not available in this build.';
  }
  if (/permission|denied/i.test(msg)) return 'Microphone permission denied.';
  return msg;
}

export function VoiceMicButton({
  onResult,
  locale = 'en-US',
  size = 22,
  style,
}: VoiceMicButtonProps) {
  const haptics = useHaptics();
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unsupported, setUnsupported] = useState(false);
  const Voice = getVoice();

  useEffect(() => {
    if (!Voice) {
      setUnsupported(true);
      return;
    }
    Voice.onSpeechStart = () => setRecording(true);
    Voice.onSpeechEnd = () => setRecording(false);
    Voice.onSpeechError = (e) => {
      setRecording(false);
      setError(friendlyError(e.error));
    };
    Voice.onSpeechResults = (e) => {
      setRecording(false);
      const text = (e.value && e.value[0]) ?? '';
      if (text) onResult(parseVoiceInput(text));
    };
    // Probe availability so we can hide on sim / unsupported devices instead
    // of waiting for the user to tap and see a red error.
    Voice.isAvailable()
      .then((ok) => setUnsupported(!ok))
      .catch(() => setUnsupported(true));
    return () => {
      Voice.destroy().then(Voice.removeAllListeners).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Voice, onResult]);

  const tap = async () => {
    if (!Voice || unsupported) {
      setError('Voice not available on this device.');
      return;
    }
    setError(null);
    haptics.tap();
    try {
      if (recording) {
        await Voice.stop();
      } else {
        await Voice.start(locale);
      }
    } catch (e) {
      setError(friendlyError(e));
      setRecording(false);
    }
  };

  if (unsupported) return null;

  return (
    <View style={style}>
      <Pressable
        onPress={tap}
        style={({ pressed }) => [
          styles.btn,
          recording && styles.btnRec,
          pressed && { transform: [{ scale: 0.94 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={recording ? 'Stop recording' : 'Record voice note'}
      >
        <MaterialCommunityIcons
          name={recording ? 'stop-circle' : 'microphone-outline'}
          size={size}
          color={recording ? theme.expense : theme.text2}
        />
      </Pressable>
      {error && <Text style={styles.err}>{error}</Text>}
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
  btnRec: {
    backgroundColor: `${theme.expense}22`,
  },
  err: {
    color: theme.expense,
    fontSize: sizes.xs,
    fontFamily: font.body,
    marginTop: 2,
  },
});
