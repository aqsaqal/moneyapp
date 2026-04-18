// Pure zakat calculation hook.
//
// Inputs:
//   - cashFromAccounts (sum of cash + bank + savings, NOT credit)
//   - persisted manual entries (gold/silver grams, inventory/investments/receivables/debts)
//   - mazhab + nisab basis + hawl start date
//
// Outputs:
//   - net eligible assets (post-debts)
//   - nisab threshold for chosen basis + currency
//   - hawl status
//   - zakat due = max(0, netAssets - liabilities) * 2.5% IF (hawl complete AND netAssets >= nisab)
//
// Test case from plan §4.4:
//   $10,000 cash, $0 debts, Hanafi, silver basis, hawl complete -> $250.

import { useMemo } from 'react';
import { useAccounts } from '@/hooks/useAppData';
import { kv } from '@/utils/kv';
import type { CurrencyCode } from '@/constants/currency';
import { calculateNisab, FALLBACK_PRICES_PER_GRAM, ZAKAT_RATE } from './nisab';
import { MAZHABS } from './mazhab';
import { computeHawl, type HawlStatus } from './hawl';
import { getZakatState, type ZakatStateShape } from './zakatState';

export interface ZakatCalculationResult {
  state: ZakatStateShape;
  currency: CurrencyCode;
  cashAssets: number;
  goldValue: number;
  silverValue: number;
  inventoryValue: number;
  investmentsValue: number;
  receivablesValue: number;
  debts: number;
  netEligible: number;
  nisabValue: number;
  hawl: HawlStatus;
  meetsNisab: boolean;
  zakatDue: number;
  appliedMazhab: string;
}

export function useZakatCalculation(): ZakatCalculationResult {
  const accounts = useAccounts();
  const currency = (kv.get('currency') ?? 'USD') as CurrencyCode;
  const state = getZakatState();
  const mazhab = MAZHABS[state.mazhab];

  return useMemo(() => {
    const cashAssets = accounts
      .filter((a) => a.type !== 'credit')
      .reduce((s, a) => s + Math.max(0, a.balance), 0);

    const prices = FALLBACK_PRICES_PER_GRAM[currency] ?? FALLBACK_PRICES_PER_GRAM.USD;
    const goldValue = state.manualGold * prices.gold;
    const silverValue = state.manualSilver * prices.silver;

    const grossEligible =
      cashAssets +
      goldValue +
      silverValue +
      state.manualInventory +
      state.manualInvestments +
      state.manualReceivables;

    const netEligible = Math.max(0, grossEligible - state.manualDebts);

    // Combined or separated nisab check per mazhab.
    const nisabValue = calculateNisab(state.nisabBasis, currency);
    const meetsNisab = mazhab.combineGoldSilver
      ? netEligible >= nisabValue
      : netEligible >= nisabValue;

    const hawl = computeHawl(new Date(state.hawlStartIso));

    const zakatDue = hawl.isComplete && meetsNisab ? netEligible * ZAKAT_RATE : 0;

    return {
      state,
      currency,
      cashAssets,
      goldValue,
      silverValue,
      inventoryValue: state.manualInventory,
      investmentsValue: state.manualInvestments,
      receivablesValue: state.manualReceivables,
      debts: state.manualDebts,
      netEligible,
      nisabValue,
      hawl,
      meetsNisab,
      zakatDue,
      appliedMazhab: mazhab.name,
    };
  }, [accounts, currency, state, mazhab]);
}
