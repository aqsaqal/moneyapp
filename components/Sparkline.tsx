// Sparkline — a tiny inline line chart for list rows (account cards).
// Plain react-native-svg polyline: no axes, no animation, no Skia
// canvas per row, so a list of ten accounts stays cheap.

import React from 'react';
import { View } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';

export function Sparkline({
  values,
  width = 80,
  height = 24,
  color,
  strokeWidth = 1.5,
}: {
  values: number[];
  width?: number;
  height?: number;
  color: string;
  strokeWidth?: number;
}) {
  if (values.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const flat = max === min;
  const pad = strokeWidth;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const points = values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * innerW;
      const y = flat ? height / 2 : pad + (1 - (v - min) / (max - min)) * innerH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <Svg width={width} height={height} accessibilityElementsHidden importantForAccessibility="no">
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </Svg>
  );
}
