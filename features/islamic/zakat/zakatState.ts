// Persistence for Zakat calculator inputs. Uses MMKV (KV is fine — these are
// small, single-row, frequently-read user preferences).

import { kv } from '@/utils/kv';
import type { Mazhab } from './mazhab';
import type { NisabBasis } from './nisab';

export interface ZakatStateShape {
  mazhab: Mazhab;
  nisabBasis: NisabBasis;
  hawlStartIso: string;       // ISO date string
  manualGold: number;         // grams
  manualSilver: number;       // grams
  manualInventory: number;    // currency value
  manualInvestments: number;  // currency value (halal only)
  manualReceivables: number;  // currency value
  manualDebts: number;        // currency value
  otherWealthNote: string;    // free-text "consult scholar" placeholder
}

const DEFAULT: ZakatStateShape = {
  mazhab: 'hanafi',
  nisabBasis: 'silver',
  hawlStartIso: new Date().toISOString(),
  manualGold: 0,
  manualSilver: 0,
  manualInventory: 0,
  manualInvestments: 0,
  manualReceivables: 0,
  manualDebts: 0,
  otherWealthNote: '',
};

const KEY = 'islamic.zakatState';

export function getZakatState(): ZakatStateShape {
  const raw = kv.getJSON<ZakatStateShape>(KEY);
  return { ...DEFAULT, ...(raw ?? {}) };
}

export function setZakatState(patch: Partial<ZakatStateShape>): ZakatStateShape {
  const next = { ...getZakatState(), ...patch };
  kv.setJSON(KEY, next);
  return next;
}
