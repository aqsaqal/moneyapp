// Shared helper for building Smart Add prefill blobs. Used by Plan rows
// (recurring / goal / debt → log a payment) and Activity rows (tap a
// transaction → edit it in Smart Add).
//
// IMPORTANT — Unicode safety:
//   - Plain `btoa(JSON.stringify(...))` throws on any character outside
//     Latin-1, which means any non-ASCII goal name / recurring title /
//     transaction note (Cyrillic, Arabic, Chinese, …) silently failed
//     decode and left Smart Add with no prefill (blank screen).
//   - We can't use Node's Buffer here: Hermes ships neither it nor a
//     polyfill, so `Buffer.from(...)` throws ReferenceError on device.
//   - Solution: encode to UTF-8 bytes via TextEncoder, fold them into a
//     binary string of char-codes 0–255 (which btoa accepts), then
//     base64. Decode reverses it via TextDecoder. Both APIs are
//     available in Hermes on every RN ≥ 0.71 (= Expo SDK 49+).
import type { Transaction } from '@/utils/db/schema';

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  // Build a Latin-1 binary string char-by-char; btoa accepts that.
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToUtf8(b64: string): string {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodePrefill(data: Record<string, unknown>): string {
  return utf8ToBase64(JSON.stringify(data));
}

/** Symmetric decoder used by add.tsx. Exported so the encoding path has
 *  a single source of truth — bug-fixes in one place only. */
export function decodePrefill(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(base64ToUtf8(raw));
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
    // Cross-currency transfer: the stored To-side credit (possibly a manual
    // correction) seeds the To conversion line the same way.
    toAccountAmount: tx.toAmount ?? undefined,
    accountId: tx.accountId,
    toAccountId: tx.toAccountId ?? undefined,
    category: tx.category ?? undefined,
    note: tx.note ?? undefined,
    originalCurrency: tx.originalCurrency ?? undefined,
    date: tx.date,
  });
}
