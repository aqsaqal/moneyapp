// Debt payoff math — Phase 10o.
//
// Pure functions — no React, no DB. Two strategies:
//
//   - avalanche: pay minimums on every debt + push every spare dollar
//     at the HIGHEST-APR debt first. Mathematically optimal (least
//     interest paid).
//
//   - snowball: pay minimums on every debt + push every spare dollar
//     at the SMALLEST BALANCE first. Behaviourally easier (early wins
//     keep momentum).
//
// projectPayoff() simulates month-by-month:
//   1. Apply monthly interest = balance * apr / 12 / 100
//   2. Allocate minPayment to every debt (capped at remaining balance)
//   3. Distribute any extra-budget to the strategy's priority debt
//   4. Carry leftover when a debt finishes mid-month
//
// Returns total months to clear all debts + total interest paid.
// Caps simulation at 600 months (50 years) — anything longer is
// "never going to clear at this rate" and we surface that.

export interface DebtInput {
  id: string;
  balance: number;
  apr: number;        // annual percent (e.g. 18.99)
  minPayment: number;
}

export type Strategy = 'avalanche' | 'snowball';

export interface PayoffResult {
  /** Months until every debt is cleared, or null if cap reached. */
  months: number | null;
  /** Total interest paid across all debts. */
  totalInterest: number;
  /** Per-debt {monthCleared, interestPaid}, in input order. */
  perDebt: Array<{ id: string; monthCleared: number | null; interestPaid: number }>;
}

const MAX_MONTHS = 600;

export function projectPayoff(
  debts: DebtInput[],
  monthlyBudget: number,
  strategy: Strategy = 'avalanche',
): PayoffResult {
  if (debts.length === 0) {
    return { months: 0, totalInterest: 0, perDebt: [] };
  }
  // Working copies; we mutate balances during the simulation.
  const state = debts.map((d) => ({
    id: d.id,
    balance: Math.max(0, d.balance),
    apr: d.apr,
    minPayment: d.minPayment,
    interestPaid: 0,
    monthCleared: null as number | null,
  }));

  const totalMin = debts.reduce((s, d) => s + d.minPayment, 0);
  // If the user's monthly budget is below the sum of minimums, the math
  // can still be informative — we let the highest-APR debt swallow what
  // little is left after minimums, accepting that some debts will grow.
  // Caller (UI) can warn.

  for (let month = 1; month <= MAX_MONTHS; month++) {
    // 1. Interest accrual.
    for (const d of state) {
      if (d.monthCleared != null) continue;
      const interest = (d.balance * d.apr) / 12 / 100;
      d.balance += interest;
      d.interestPaid += interest;
    }

    // 2. Pay minimums.
    let pool = monthlyBudget;
    for (const d of state) {
      if (d.monthCleared != null) continue;
      const pay = Math.min(d.minPayment, d.balance, pool);
      d.balance -= pay;
      pool -= pay;
      if (d.balance <= 0.01) {
        d.balance = 0;
        d.monthCleared = month;
      }
    }

    // 3. Distribute extra to priority debt (active debts only).
    while (pool > 0.01) {
      const active = state.filter((d) => d.monthCleared == null);
      if (active.length === 0) break;
      const priority = strategy === 'avalanche'
        ? active.reduce((a, b) => (a.apr >= b.apr ? a : b))
        : active.reduce((a, b) => (a.balance <= b.balance ? a : b));
      const pay = Math.min(priority.balance, pool);
      priority.balance -= pay;
      pool -= pay;
      if (priority.balance <= 0.01) {
        priority.balance = 0;
        priority.monthCleared = month;
      }
    }

    if (state.every((d) => d.monthCleared != null)) {
      return {
        months: month,
        totalInterest: state.reduce((s, d) => s + d.interestPaid, 0),
        perDebt: state.map((d) => ({
          id: d.id,
          monthCleared: d.monthCleared,
          interestPaid: d.interestPaid,
        })),
      };
    }
  }

  // Budget too low — never finishes within the cap.
  return {
    months: null,
    totalInterest: state.reduce((s, d) => s + d.interestPaid, 0),
    perDebt: state.map((d) => ({
      id: d.id,
      monthCleared: d.monthCleared,
      interestPaid: d.interestPaid,
    })),
  };
}

/** Convenience: total balance + minimum-payment sum across debts. */
export function debtTotals(debts: DebtInput[]): { balance: number; minPayment: number } {
  return debts.reduce(
    (acc, d) => ({
      balance: acc.balance + d.balance,
      minPayment: acc.minPayment + d.minPayment,
    }),
    { balance: 0, minPayment: 0 },
  );
}
