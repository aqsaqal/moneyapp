// Islamic-specific expense categories. Per spec lines 294-301.
// All marked isIslamic: true so CategoryTile renders the crescent badge.

import type { CategoryDef } from '@/constants/categories';

export const ISLAMIC_EXPENSE_CATEGORIES: CategoryDef[] = [
  { id: 'zakat',        name: 'Zakat',              icon: 'hand-holding', color: '#00C9A7', isIslamic: true },
  { id: 'sadaqa',       name: 'Sadaqa',             icon: 'heart-circle', color: '#34D399', isIslamic: true },
  { id: 'qurban',       name: 'Qurban',             icon: 'leaf',         color: '#4ADE80', isIslamic: true },
  { id: 'hajj',         name: 'Hajj/Umrah',         icon: 'compass',      color: '#FBBF24', isIslamic: true },
  { id: 'masjid',       name: 'Masjid',             icon: 'mosque',       color: '#818CF8', isIslamic: true },
  { id: 'islamic_edu',  name: 'Islamic Education',  icon: 'book',         color: '#60A5FA', isIslamic: true },
];
