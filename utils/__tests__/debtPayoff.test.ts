// Tests for the pure debt payoff math.

import { projectPayoff, debtTotals } from '../debtPayoff';

function assert(cond: boolean, label: string) {
  // eslint-disable-next-line no-console
  console.log(cond ? `  ✅ ${label}` : `  ❌ ${label}`);
  if (!cond) process.exit(1);
}

console.log('=== empty debts ===');
{
  const r = projectPayoff([], 100);
  assert(r.months === 0, 'no debts → 0 months');
  assert(r.totalInterest === 0, 'no interest');
}

console.log('=== single debt, exact minimum clears slowly ===');
{
  // $1000 @ 12% APR, $50/month minimum.
  const r = projectPayoff(
    [{ id: 'a', balance: 1000, apr: 12, minPayment: 50 }],
    50,
  );
  assert(r.months != null && r.months > 20 && r.months < 30, '$1k at 12% pays off in ~22-25 months');
  assert(r.totalInterest > 0 && r.totalInterest < 200, 'interest accrued is reasonable');
}

console.log('=== avalanche beats snowball on total interest ===');
{
  const debts = [
    { id: 'lo-bal-hi-apr', balance: 500, apr: 25, minPayment: 25 },
    { id: 'hi-bal-lo-apr', balance: 5000, apr: 6, minPayment: 100 },
  ];
  const budget = 250;
  const av = projectPayoff(debts, budget, 'avalanche');
  const sb = projectPayoff(debts, budget, 'snowball');
  assert(
    av.totalInterest <= sb.totalInterest + 0.01,
    `avalanche (${av.totalInterest.toFixed(2)}) ≤ snowball (${sb.totalInterest.toFixed(2)})`,
  );
}

console.log('=== budget below minimums never clears ===');
{
  const r = projectPayoff(
    [{ id: 'huge', balance: 100000, apr: 25, minPayment: 100 }],
    50,
  );
  assert(r.months === null, 'underfunded → months=null');
}

console.log('=== debtTotals sums correctly ===');
{
  const t = debtTotals([
    { id: 'a', balance: 100, apr: 0, minPayment: 10 },
    { id: 'b', balance: 200, apr: 0, minPayment: 20 },
  ]);
  assert(t.balance === 300, 'balance sum');
  assert(t.minPayment === 30, 'minPayment sum');
}

console.log('\n=== Summary ===');
console.log('All debtPayoff cases passed.');
