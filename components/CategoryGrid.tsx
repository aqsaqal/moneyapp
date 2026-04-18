// Category grid — 3-column scrolling grid of CategoryTile. Home screen uses
// this to show month-to-date spend by category (v4 lines 412-464).

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { CategoryTile } from './CategoryTile';
import { catInfo } from '@/constants/categories';
import type { CurrencyCode } from '@/constants/currency';

export interface CategoryGridData {
  category: string;
  amount: number;
  change?: number | null;
}

export function CategoryGrid({
  data,
  selectedId,
  onSelect,
  currency = 'USD',
}: {
  data: CategoryGridData[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  currency?: CurrencyCode;
}) {
  return (
    <View style={styles.grid}>
      {data.map((item) => {
        const cat = catInfo(item.category);
        return (
          <CategoryTile
            key={item.category}
            cat={cat}
            amount={item.amount}
            change={item.change}
            selected={selectedId === item.category}
            onPress={onSelect ? () => onSelect(item.category) : undefined}
            currency={currency}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    rowGap: 8,
  },
});
