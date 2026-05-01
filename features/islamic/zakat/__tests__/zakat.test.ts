// Pure-math tests for the Zakat calculation primitives.
// Validates the spec's anchor case from plan.md §4.4:
//   "$10k cash, Hanafi, silver basis, hawl complete → exactly $250 zakat due"
//
// These are intentionally NOT React hook tests — useZakatCalculation wraps
// the math in a hook that pulls accounts via Drizzle. Here we exercise the
// underlying pure functions and the formula directly so the math is locked
// down independently of any React/SQLite plumbing.
//
// Run with:
//   npx tsc features/islamic/zakat/__tests__/zakat.test.ts --outDir /tmp/zakat-test \
//     --module commonjs --target es2020 --moduleResolution node \
//     --esModuleInterop --skipLibCheck && node /tmp/zakat-test/zakat.test.js

import { calculateNisab, GOLD_GRAMS, SILVER_GRAMS, ZAKAT_RATE, FALLBACK_PRICES_PER_GRAM } from '../nisab';
import { MAZHABS, type Mazhab } from '../mazhab';
import { computeHawl } from '../hawl';

let failures = 0;
let passes = 0;

function assert(label: string, cond: boolean, detail?: string) {
  if (cond) {
    passes += 1;
    console.log('  ✅', label);
  } else {
    failures += 1;
    console.error('  ❌', label, detail ?? '');
  }
}

function assertEq<T>(label: string, actual: T, expected: T) {
  assert(label, actual === expected, `expected ${String(expected)}, got ${String(actual)}`);
}

function assertClose(label: string, actual: number, expected: number, eps = 0.01) {
  assert(label, Math.abs(actual - expected) < eps, `expected ~${expected}, got ${actual} (Δ=${Math.abs(actual - expected)})`);
}

console.log('=== Constants ===');
assertEq('GOLD_GRAMS', GOLD_GRAMS, 87.48);
assertEq('SILVER_GRAMS', SILVER_GRAMS, 612.36);
assertEq('ZAKAT_RATE', ZAKAT_RATE, 0.025);

console.log('\n=== Nisab thresholds (USD fallback prices) ===');
const usdGoldNisab = calculateNisab('gold', 'USD');
const usdSilverNisab = calculateNisab('silver', 'USD');
const expectedGold = 87.48 * FALLBACK_PRICES_PER_GRAM.USD.gold;
const expectedSilver = 612.36 * FALLBACK_PRICES_PER_GRAM.USD.silver;
assertClose('gold nisab USD', usdGoldNisab, expectedGold);
assertClose('silver nisab USD', usdSilverNisab, expectedSilver);
// Silver nisab should be lower than gold (silver makes more wealth zakatable —
// silver-basis is the conservative default for Muslims today).
assert('silver nisab < gold nisab (USD)', usdSilverNisab < usdGoldNisab);

console.log('\n=== Per-currency parity ===');
for (const code of Object.keys(FALLBACK_PRICES_PER_GRAM)) {
  const n = calculateNisab('silver', code);
  assert(`silver nisab (${code}) > 0`, n > 0);
}
const sarSilver = calculateNisab('silver', 'SAR');
const usdSilver = calculateNisab('silver', 'USD');
assert('SAR silver nisab > USD silver nisab (SAR is lower-value unit)', sarSilver > usdSilver);

console.log('\n=== Mazhab rules ===');
for (const m of Object.keys(MAZHABS) as Mazhab[]) {
  assert(`${m} has a name`, MAZHABS[m].name.length > 0);
  assert(`${m} has a note`, MAZHABS[m].note.length > 0);
}
assert('Hanafi combines gold+silver toward nisab', MAZHABS.hanafi.combineGoldSilver === true);
assert("Shafi'i evaluates separately", MAZHABS.shafii.combineGoldSilver === false);
assert('Maliki evaluates separately', MAZHABS.maliki.combineGoldSilver === false);
assert('Hanbali evaluates separately', MAZHABS.hanbali.combineGoldSilver === false);
assert('Hanafi treats personal jewelry as zakatable', MAZHABS.hanafi.personalJewelryZakatable === true);
assert("Shafi'i treats personal jewelry as exempt", MAZHABS.shafii.personalJewelryZakatable === false);

console.log('\n=== Hawl ===');
const oneYearAgo = new Date();
oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
oneYearAgo.setDate(oneYearAgo.getDate() - 5);  // a few extra days for safety
const hawlComplete = computeHawl(oneYearAgo);
assert('hawl is complete after 1 lunar year', hawlComplete.isComplete);
assert('hawl daysRemaining = 0 when complete', hawlComplete.daysRemaining === 0);

const startedToday = new Date();
const hawlFresh = computeHawl(startedToday);
assert('hawl is incomplete at day 0', !hawlFresh.isComplete);
assert('hawl daysRemaining > 350 at day 0', hawlFresh.daysRemaining > 350);

console.log('\n=== Anchor case: $10k cash, Hanafi, silver basis, hawl complete → exactly $250 ===');
// Reproduce the calculation from useZakatCalculation.ts inline.
function computeZakatDue(args: {
  cashAssets: number;
  manualGold: number; manualSilver: number;
  manualInventory: number; manualInvestments: number; manualReceivables: number;
  manualDebts: number;
  basis: 'gold' | 'silver';
  hawlComplete: boolean;
  currency: keyof typeof FALLBACK_PRICES_PER_GRAM;
}): { netEligible: number; nisabValue: number; meetsNisab: boolean; zakatDue: number } {
  const prices = FALLBACK_PRICES_PER_GRAM[args.currency];
  const goldValue = args.manualGold * prices.gold;
  const silverValue = args.manualSilver * prices.silver;
  const grossEligible =
    args.cashAssets + goldValue + silverValue +
    args.manualInventory + args.manualInvestments + args.manualReceivables;
  const netEligible = Math.max(0, grossEligible - args.manualDebts);
  const nisabValue = calculateNisab(args.basis, args.currency);
  const meetsNisab = netEligible >= nisabValue;
  const zakatDue = args.hawlComplete && meetsNisab ? netEligible * ZAKAT_RATE : 0;
  return { netEligible, nisabValue, meetsNisab, zakatDue };
}

const anchor = computeZakatDue({
  cashAssets: 10000,
  manualGold: 0, manualSilver: 0,
  manualInventory: 0, manualInvestments: 0, manualReceivables: 0,
  manualDebts: 0,
  basis: 'silver',
  hawlComplete: true,
  currency: 'USD',
});
assertClose('netEligible = $10000', anchor.netEligible, 10000);
assert('meetsNisab (silver basis)', anchor.meetsNisab);
assertClose('zakatDue = $250', anchor.zakatDue, 250);

console.log('\n=== Edge: hawl incomplete → zakatDue = $0 even above nisab ===');
const hawlIncomplete = computeZakatDue({
  cashAssets: 10000,
  manualGold: 0, manualSilver: 0, manualInventory: 0, manualInvestments: 0, manualReceivables: 0,
  manualDebts: 0,
  basis: 'silver',
  hawlComplete: false,
  currency: 'USD',
});
assertEq('zakatDue = 0 when hawl incomplete', hawlIncomplete.zakatDue, 0);

console.log('\n=== Edge: below nisab → zakatDue = $0 even with hawl complete ===');
const belowNisab = computeZakatDue({
  cashAssets: 100,
  manualGold: 0, manualSilver: 0, manualInventory: 0, manualInvestments: 0, manualReceivables: 0,
  manualDebts: 0,
  basis: 'silver',
  hawlComplete: true,
  currency: 'USD',
});
assert('not meetsNisab at $100', !belowNisab.meetsNisab);
assertEq('zakatDue = 0 below nisab', belowNisab.zakatDue, 0);

console.log('\n=== Edge: debts subtract from net eligible ===');
const withDebts = computeZakatDue({
  cashAssets: 10000,
  manualGold: 0, manualSilver: 0, manualInventory: 0, manualInvestments: 0, manualReceivables: 0,
  manualDebts: 4000,
  basis: 'silver',
  hawlComplete: true,
  currency: 'USD',
});
assertClose('netEligible = 6000 ($10k cash - $4k debts)', withDebts.netEligible, 6000);
assertClose('zakatDue = $150 on $6k', withDebts.zakatDue, 150);

console.log('\n=== Edge: receivables count toward eligible wealth ===');
const withReceivables = computeZakatDue({
  cashAssets: 5000,
  manualGold: 0, manualSilver: 0, manualInventory: 0, manualInvestments: 0,
  manualReceivables: 5000,
  manualDebts: 0,
  basis: 'silver',
  hawlComplete: true,
  currency: 'USD',
});
assertClose('netEligible = 10000 ($5k cash + $5k receivables)', withReceivables.netEligible, 10000);
assertClose('zakatDue = $250 unchanged', withReceivables.zakatDue, 250);

console.log('\n=== Summary ===');
console.log(`${passes} passed, ${failures} failed`);
if (failures > 0) {
  process.exit(1);
}
