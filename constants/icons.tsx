// Icon mapping — lucide name → MaterialCommunityIcons name.
// Wraps <MaterialCommunityIcons> so screens stay readable (<Icon name="Utensils"/>)
// without every consumer knowing the mcc name.

import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { StyleProp, TextStyle } from 'react-native';

type MCCName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export const ICON_MAP: Record<string, MCCName> = {
  // Expense category icons (v4 line 45-72)
  Utensils: 'silverware-fork-knife',
  Car: 'car',
  ShoppingCart: 'cart-outline',
  Coffee: 'coffee',
  Zap: 'flash',
  Heart: 'heart-outline',
  Star: 'star',
  BookOpen: 'book-open-variant',
  Plane: 'airplane',
  Gift: 'gift-outline',
  Droplet: 'water',
  Wifi: 'wifi',
  Smartphone: 'cellphone',
  Home: 'home-variant',
  Package: 'package-variant',
  Activity: 'run',
  FileText: 'file-document-outline',
  MoreHorizontal: 'dots-horizontal',

  // Income category icons
  Briefcase: 'briefcase-outline',
  Edit3: 'pencil',
  TrendingUp: 'trending-up',
  TrendingDown: 'trending-down',
  ArrowRightLeft: 'swap-horizontal',

  // Account type icons
  Wallet: 'wallet-outline',
  CreditCard: 'credit-card-outline',
  PiggyBank: 'piggy-bank-outline',
  Banknote: 'cash',

  // Nav + control
  Plus: 'plus',
  List: 'format-list-bulleted',
  Check: 'check',
  X: 'close',
  Trash2: 'trash-can-outline',
  RefreshCw: 'refresh',
  CheckCircle: 'check-circle',
  Circle: 'circle-outline',
  ArrowDownLeft: 'arrow-bottom-left',
  ArrowUpRight: 'arrow-top-right',
  DollarSign: 'currency-usd',
  Target: 'target',
  BarChart3: 'chart-bar',
  AlertTriangle: 'alert',
  Calendar: 'calendar',
  ChevronRight: 'chevron-right',
  Scale: 'scale-balance',

  // Islamic-flavor icons. Strings present in both bundles (constant values),
  // but only referenced by features/islamic/* components. Dead-code elimination
  // in generic keeps these map entries but never looks them up.
  'hand-holding': 'hand-heart',
  'heart-circle': 'heart-circle',
  leaf: 'leaf',
  compass: 'compass-outline',
  book: 'book',
  mosque: 'mosque',
  'star-crescent': 'star-crescent',
};

export interface IconProps {
  name: string;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

export function Icon({ name, size = 18, color = '#EAEAF2', style }: IconProps): React.JSX.Element {
  // Two valid name shapes: a legacy Lucide-style key (mapped via ICON_MAP)
  // or a raw MaterialCommunityIcons name (passed through). Falling back
  // to the literal name covers seeded categories that now store mcc
  // names directly (Phase 10x) without forcing every legacy caller to
  // change in lockstep.
  const mcc = (ICON_MAP[name] ?? name) as MCCName;
  return <MaterialCommunityIcons name={mcc} size={size} color={color} style={style} />;
}
