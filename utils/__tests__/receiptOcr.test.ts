// Tests for the pure parseReceipt() heuristic. The native ML Kit step
// isn't tested here — we just trust it returns text — but the parser
// regression matrix protects the most common receipt shapes.

import { parseReceipt } from '../receiptParser';

function assertEq<T>(actual: T, expected: T, label: string) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  // eslint-disable-next-line no-console
  console.log(ok ? `  ✅ ${label}` : `  ❌ ${label}\n     expected: ${JSON.stringify(expected)}\n     actual:   ${JSON.stringify(actual)}`);
  if (!ok) process.exit(1);
}

console.log('=== parseReceipt: starbucks-style ===');
{
  const r = parseReceipt(
    `STARBUCKS COFFEE
     1234 MAIN ST
     2026-05-09  14:23
     Latte                4.50
     Croissant            3.25
     Subtotal             7.75
     Tax                  0.62
     TOTAL                8.37
     VISA  ****1234       8.37`,
  );
  assertEq(r.total, 8.37, 'total picks the labelled TOTAL line');
  assertEq(r.merchant, 'STARBUCKS COFFEE', 'merchant = first non-empty line');
  assertEq(r.date != null, true, 'date parsed from ISO header');
}

console.log('=== parseReceipt: european dotted format ===');
{
  const r = parseReceipt(
    `Carrefour Express
     09.05.2026
     Pain                2,50
     Eau                 1,80
     Total a payer:     4,30`,
  );
  assertEq(r.total, 4.3, 'comma decimal recognized');
  assertEq(r.merchant, 'Carrefour Express', 'merchant from first line');
  assertEq(r.date != null, true, 'DMY date format parsed');
}

console.log('=== parseReceipt: fallback to largest amount ===');
{
  const r = parseReceipt(
    `MOM AND POP STORE
     09/05/2026
     Item A 1.00
     Item B 2.50
     Item C 12.34`,
  );
  assertEq(r.total, 12.34, 'largest amount wins when no TOTAL label');
}

console.log('=== parseReceipt: empty input ===');
{
  const r = parseReceipt('');
  assertEq(r.total, null, 'no total');
  assertEq(r.merchant, null, 'no merchant');
  assertEq(r.date, null, 'no date');
}

console.log('\n=== Summary ===');
console.log('All parseReceipt cases passed.');
