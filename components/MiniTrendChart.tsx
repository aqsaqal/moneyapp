// MiniTrendChart — Skia-based area chart for home spending trend.
// Replaces v4's Recharts <AreaChart> (lines 404-411).
// Using Victory Native XL (v41+) which is built on @shopify/react-native-skia.

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CartesianChart, Line, Area } from 'victory-native';
import { theme } from '@/constants/theme';

export interface TrendPoint {
  day: number;
  amount: number;
  [key: string]: number; // satisfy victory-native's Record<string, unknown> index signature
}

export function MiniTrendChart({ data, height = 80 }: { data: TrendPoint[]; height?: number }) {
  if (data.length === 0) {
    return <View style={[styles.wrap, { height }]} />;
  }
  return (
    <View style={[styles.wrap, { height }]}>
      <CartesianChart
        data={data}
        xKey="day"
        yKeys={['amount']}
        padding={{ left: 4, right: 4, top: 4, bottom: 4 }}
      >
        {({ points, chartBounds }) => (
          <>
            <Area
              points={points.amount}
              y0={chartBounds.bottom}
              color={`${theme.accent}33`}
              animate={{ type: 'timing', duration: 300 }}
            />
            <Line
              points={points.amount}
              color={theme.accent}
              strokeWidth={2}
              animate={{ type: 'timing', duration: 300 }}
            />
          </>
        )}
      </CartesianChart>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%' },
});
