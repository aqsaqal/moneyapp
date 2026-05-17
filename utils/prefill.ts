// Shared helper for building Smart Add prefill blobs. Used by Plan rows
// (recurring / goal / debt → log a payment) and Activity rows (tap a
// transaction → edit it in Smart Add).
//
// IMPORTANT: payloads are JSON-stringified then UTF-8 → base64 encoded.
// We can't use plain `btoa(json)` because notes / category labels may
// contain non-Latin-1 characters (Cyrillic, Arabic, Chinese, …) and
// `btoa` throws on bytes outside 0x00–0xFF. Going through Buffer
// guarantees UTF-8 round-tripping on every platform RN runs on.
import type { Transaction } from '@/utils/db/schema';

export function encodePrefill(data: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64');
}

/** Symmetric decoder used by add.tsx. Exported so the encoding path has a
 *  single source of truth — bug-fixed in one place. */
export function decodePrefill(raw: string): Record<string, unknown> | null {
  try {
    const json = Buffer.from(raw, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
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
