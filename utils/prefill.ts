// Shared helper for building Smart Add prefill blobs. Used by Plan rows
// (recurring / goal / debt → log a payment) and Activity rows (tap a
// transaction → edit it in Smart Add).
import type { Transaction } from '@/utils/db/schema';

export function encodePrefill(data: Record<string, unknown>): string {
  const json = JSON.stringify(data);
  if (typeof globalThis.btoa === 'function') return globalThis.btoa(json);
  return Buffer.from(json, 'utf8').toString('base64');
}

/** Build a prefill payload that opens Smart Add in edit mode for an
 *  existing transaction. The editId flag tells add.tsx to call
 *  updateTransaction() on submit instead of creating a new row. */
export function buildEditPrefill(tx: Transaction): string {
  return encodePrefill({
    editId: tx.id,
    type: tx.type,
    amount: tx.originalAmount ?? tx.amount,
    // For mixed-currency edits we send both — `amount` is the entry-currency
    // amount the user originally typed, `accountAmount` is what actually hit
    // the account. Smart Add uses accountAmount to seed the (editable)
    // auto-convert override line so a re-save preserves the user's
    // bank-rate adjustment.
    accountAmount: tx.originalAmount != null ? tx.amount : undefined,
    accountId: tx.accountId,
    toAccountId: tx.toAccountId ?? undefined,
    category: tx.category ?? undefined,
    note: tx.note ?? undefined,
    originalCurrency: tx.originalCurrency ?? undefined,
    date: tx.date,
  });
}
