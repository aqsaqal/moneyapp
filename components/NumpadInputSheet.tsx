// NumpadInputSheet — a reusable bottom-sheet for entering an amount in
// any context outside Smart Add (account balance adjust, budget, goal
// target, recurring amount, etc).
//
// Layout matches Smart Add: a large amount display on top, the compact
// 5-column Numpad below (no calendar slot; primary key spans rows 2-4).
//
// Supports the same calc shorthand as Smart Add — operators chain into
// a pending expression, and the primary key flips between ✓ (submit) and
// = (evaluate the queued operation) so users can do "100 + 50" inside a
// budget field.

import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { theme, spacing, font, sizes, radii } from '@/constants/theme';
import { Numpad, type CalcOp } from '@/components/Numpad';
import { formatMoney, type CurrencyCode } from '@/constants/currency';
import { useT } from '@/hooks/useT';

interface Props {
  visible: boolean;
  /** Title shown above the amount, e.g. "Set balance", "Monthly budget". */
  title: string;
  /** Initial numeric value (or null/undefined for an empty field). */
  initial?: number | null;
  /** Currency for the formatted preview line. Omit to skip preview. */
  currency?: CurrencyCode;
  /** Allow zero as a valid submit value (e.g. setting a balance to 0). */
  allowZero?: boolean;
  onSubmit: (value: number) => void;
  onClose: () => void;
}

export function NumpadInputSheet({
  visible,
  title,
  initial,
  currency,
  allowZero = false,
  onSubmit,
  onClose,
}: Props) {
  const t = useT();
  // Raw expression string the numpad mutates. Resolved to a number on
  // submit via the same eval rules as Smart Add (no precedence beyond
  // left-to-right; standard shunting-yard).
  const [expr, setExpr] = useState<string>('');
  const [awaitingEval, setAwaitingEval] = useState(false);

  useEffect(() => {
    if (visible) {
      setExpr(initial != null && initial !== 0 ? String(initial) : '');
      setAwaitingEval(false);
    }
  }, [visible, initial]);

  const value = evalExpr(expr);
  const previewMoney = currency && Number.isFinite(value)
    ? formatMoney(value, currency)
    : '';

  const onKey = (k: string) => {
    if (k === 'del') {
      setExpr((s) => s.slice(0, -1));
      setAwaitingEval(/[+\-*/]/.test(expr.slice(0, -1)));
      return;
    }
    if (k === '%') {
      // Append percent literal — handled at eval time.
      setExpr((s) => s + '%');
      return;
    }
    if (k === '.') {
      // Block multiple dots in the current number segment.
      const seg = expr.split(/[+\-*/]/).pop() ?? '';
      if (seg.includes('.')) return;
      setExpr((s) => (s === '' ? '0.' : s + '.'));
      return;
    }
    // Digit
    setExpr((s) => s + k);
  };

  const onCalcOp = (op: CalcOp) => {
    setExpr((s) => {
      if (s === '') return s; // ignore leading op
      // Replace trailing op so user can switch between operators.
      if (/[+\-*/]$/.test(s)) return s.slice(0, -1) + op;
      return s + op;
    });
    setAwaitingEval(true);
  };

  const onEvaluate = () => {
    const resolved = evalExpr(expr);
    if (Number.isFinite(resolved)) {
      setExpr(String(resolved));
    }
    setAwaitingEval(false);
  };

  const onSubmitInternal = () => {
    const v = evalExpr(expr);
    if (!Number.isFinite(v)) return;
    if (!allowZero && v === 0) return;
    onSubmit(v);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheet} edges={['bottom']}>
        <View style={styles.handle} />
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel={t('common.close')}>
            <MaterialCommunityIcons name="close" size={22} color={theme.text2} />
          </Pressable>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <View style={{ width: 22 }} />
        </View>

        <View style={styles.display}>
          <Text style={styles.amount} adjustsFontSizeToFit numberOfLines={1}>
            {expr || '0'}
          </Text>
          {previewMoney ? (
            <Text style={styles.preview} numberOfLines={1}>{previewMoney}</Text>
          ) : null}
        </View>

        <Numpad
          compact
          onPress={onKey}
          onCalcOp={onCalcOp}
          onSubmit={onSubmitInternal}
          onEvaluate={onEvaluate}
          awaitingEval={awaitingEval}
          submitLabel={t('common.save')}
        />
      </SafeAreaView>
    </Modal>
  );
}

// Tiny left-to-right evaluator. % is treated as a trailing literal
// converter (50% → 0.5 of the previous operand) when it follows a
// number, mirroring Smart Add's behaviour. Returns NaN for malformed
// or empty input.
function evalExpr(raw: string): number {
  if (!raw) return NaN;
  // Strip a trailing operator.
  let s = raw;
  if (/[+\-*/]$/.test(s)) s = s.slice(0, -1);
  if (!s) return NaN;
  // Tokenise.
  const tokens = s.match(/(\d+\.?\d*%?|[+\-*/])/g);
  if (!tokens) return NaN;
  let acc = parseNumber(tokens[0]);
  for (let i = 1; i + 1 < tokens.length; i += 2) {
    const op = tokens[i];
    const next = parseNumber(tokens[i + 1]);
    if (!Number.isFinite(next)) return NaN;
    if (op === '+') acc += next;
    else if (op === '-') acc -= next;
    else if (op === '*') acc *= next;
    else if (op === '/') {
      if (next === 0) return NaN;
      acc /= next;
    }
  }
  return acc;
}

function parseNumber(tok: string): number {
  if (tok.endsWith('%')) {
    const n = parseFloat(tok.slice(0, -1));
    return Number.isFinite(n) ? n / 100 : NaN;
  }
  return parseFloat(tok);
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0, right: 0, bottom: 0,
    backgroundColor: theme.bg1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40, height: 4,
    borderRadius: 2,
    backgroundColor: theme.border,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { color: theme.text1, fontSize: sizes.lg, fontFamily: font.displayBold },
  display: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    backgroundColor: theme.bg2,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: theme.border,
    gap: 6,
  },
  amount: {
    color: theme.text1,
    fontSize: 44,
    fontFamily: font.displayBold,
  },
  preview: {
    color: theme.text3,
    fontSize: sizes.sm,
    fontFamily: font.body,
  },
});
