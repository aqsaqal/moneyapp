// Islamic-only: tiny status badge rendered after the note line on a
// TransactionRow. Lives in features/islamic/ so the literal status
// names ('halal' / 'haram' / 'mushbooh') only ship in the islamic
// bundle — generic builds never require this file.

import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { theme, sizes } from '@/constants/theme';

function colorFor(status: string | null | undefined): string {
  switch (status) {
    case 'halal': return theme.accent;
    case 'haram': return theme.expense;
    case 'mushbooh': return theme.warning;
    default: return theme.text2;
  }
}

export function HalalBadge({ status }: { status: string }) {
  return <Text style={[styles.badge, { color: colorFor(status) }]}>{status}</Text>;
}

const styles = StyleSheet.create({
  badge: { fontSize: sizes.xs, marginTop: 2 },
});
