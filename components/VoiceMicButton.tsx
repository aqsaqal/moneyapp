// VoiceMicButton — tap-to-record speech that fills the Add modal's amount + note.
//
// Phase 10z: switched from @react-native-voice/voice (unmaintained,
// autolinking issues under SDK 54) to expo-speech-recognition. Same
// UX, cleaner native integration via the package's config plugin,
// permissions declared in app.config.ts.
//
// Parser unchanged:
//   "twelve fifty coffee" → amount=12.50, note="coffee"
//   "12 lunch"            → amount=12,    note="lunch"
//   "uber 14"             → amount=14,    note="uber"
//   "coffee"              → amount=null,  note="coffee"

import React, { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, font, sizes } from '@/constants/theme';
import { useHaptics } from '@/hooks/useHaptics';
import { t as i18nT } from '@/utils/i18n';
import { kv } from '@/utils/kv';

// Lazy-imported so a binary that predates the native module shows the
// graceful fallback alert instead of crashing on require().
type Esr = typeof import('expo-speech-recognition');
let _esr: Esr | null = null;
function getEsr(): Esr | null {
  if (_esr) return _esr;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _esr = require('expo-speech-recognition');
    return _esr;
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
  const expanded = expandSpelledNumbers(text);
  const m = expanded.match(/(-?\d+(?:[.,]\d+)?)/);
  let amount: number | null = null;
  let note = expanded;
  if (m) {
    amount = parseFloat(m[1].replace(',', '.'));
    note = (expanded.slice(0, m.index!) + ' ' + expanded.slice(m.index! + m[0].length)).trim();
  }
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
      if (va >= 20 && va < 100 && vb < 10) {
        out.push(String(va + vb));
        i += 2;
        continue;
      }
      if (va < 20 && vb >= 20 && vb < 100) {
        out.push(`${va}.${vb.toString().padStart(2, '0')}`);
        i += 2;
        continue;
      }
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
  onResult: (parsed: VoiceParse) => void;
  /** BCP-47 locale code; 'en-US' / 'ar-SA' / 'ru-RU'. Default 'en-US'. */
  locale?: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
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
  const Esr = getEsr();
  // Keep the latest partial transcript so onend can report it even when
  // the recognizer didn't emit a final result (common on Android when
  // the user stops speaking briefly).
  const transcriptRef = useRef<string>('');

  useEffect(() => {
    if (!Esr) return;
    const subs = [
      Esr.ExpoSpeechRecognitionModule.addListener('start', () => setRecording(true)),
      Esr.ExpoSpeechRecognitionModule.addListener('end', () => {
        setRecording(false);
        const text = transcriptRef.current;
        transcriptRef.current = '';
        if (text) onResult(parseVoiceInput(text));
      }),
      Esr.ExpoSpeechRecognitionModule.addListener('result', (e) => {
        // Each result event carries an array of candidate transcripts;
        // the first is the highest-confidence guess.
        const txt = e?.results?.[0]?.transcript ?? '';
        if (txt) transcriptRef.current = txt;
      }),
      Esr.ExpoSpeechRecognitionModule.addListener('error', (e) => {
        setRecording(false);
        const code = e?.error ?? '';
        const msg = e?.message ?? '';
        if (/permission/i.test(code + msg)) setError(i18nT('voice.permissionDenied'));
        else if (/not-allowed|service-not-allowed/i.test(code)) setError(i18nT('voice.unsupported.build'));
        else setError(msg || code || i18nT('voice.unsupported.build'));
      }),
    ];
    return () => {
      for (const s of subs) s.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Esr, onResult]);

  const startRecording = async () => {
    if (!Esr) return;
    try {
      const perm = await Esr.ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        setError(i18nT('voice.permissionDenied'));
        return;
      }
      transcriptRef.current = '';
      Esr.ExpoSpeechRecognitionModule.start({
        lang: locale,
        interimResults: true,
        // Keep audio on-device when possible. Honored by Android 12+ /
        // recent iOS; older devices may still fall back to cloud per
        // OS policy (disclosed in our privacy policy).
        requiresOnDeviceRecognition: true,
        continuous: false,
        maxAlternatives: 1,
      });
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
      setRecording(false);
    }
  };

  const tap = async () => {
    if (!Esr) {
      setError(i18nT('voice.unsupported.build'));
      return;
    }
    setError(null);
    haptics.tap();
    if (recording) {
      try {
        await Esr.ExpoSpeechRecognitionModule.stop();
      } catch (e) {
        setError(String((e as Error)?.message ?? e));
        setRecording(false);
      }
      return;
    }
    if (!kv.getBool('voicePromptShown', false)) {
      Alert.alert(
        i18nT('voice.permission.title'),
        i18nT('voice.permission.body'),
        [
          { text: i18nT('voice.permission.deny'), style: 'cancel' },
          {
            text: i18nT('voice.permission.ok'),
            style: 'default',
            onPress: () => {
              kv.setBool('voicePromptShown', true);
              void startRecording();
            },
          },
        ],
      );
      return;
    }
    void startRecording();
  };

  if (!Esr) return null;

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
