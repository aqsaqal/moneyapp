// Mazhab (school of jurisprudence) — rule deltas for zakat calculation.
// Plan §6 decision: ship the four major mazhabs with documented rule diffs.
// Tone: present rules transparently; never moralize, always disclaim.

export type Mazhab = 'hanafi' | 'shafii' | 'maliki' | 'hanbali';

export interface MazhabRules {
  id: Mazhab;
  name: string;
  /** Combine gold and silver value when checking nisab? Hanafi yes; others no. */
  combineGoldSilver: boolean;
  /** Personal jewelry zakatable? Hanafi yes; others no (assumes within reasonable use). */
  personalJewelryZakatable: boolean;
  /** Brief note shown next to the picker. */
  note: string;
}

export const MAZHABS: Record<Mazhab, MazhabRules> = {
  hanafi: {
    id: 'hanafi',
    name: 'Hanafi',
    combineGoldSilver: true,
    personalJewelryZakatable: true,
    note: 'Combines gold + silver toward nisab. Personal jewelry is zakatable.',
  },
  shafii: {
    id: 'shafii',
    name: "Shafi'i",
    combineGoldSilver: false,
    personalJewelryZakatable: false,
    note: 'Each metal evaluated separately. Personal jewelry exempt within reasonable use.',
  },
  maliki: {
    id: 'maliki',
    name: 'Maliki',
    combineGoldSilver: false,
    personalJewelryZakatable: false,
    note: 'Each metal evaluated separately. Personal jewelry exempt within reasonable use.',
  },
  hanbali: {
    id: 'hanbali',
    name: 'Hanbali',
    combineGoldSilver: false,
    personalJewelryZakatable: false,
    note: 'Each metal evaluated separately. Personal jewelry exempt within reasonable use.',
  },
};
