// Pure heuristic OCR parser — no native deps so it can run in the test
// runner. The native pipeline (expo-image-picker + ML Kit) lives in
// utils/receiptOcr.ts and calls into this for the post-OCR step.

export interface ParsedReceipt {
  total: number | null;
  /** Unix ms; null when no date could be parsed from the receipt. */
  date: number | null;
  /** Best-guess merchant — usually the first all-caps line, or null. */
  merchant: string | null;
  /** Raw OCR text, kept around for the user to inspect or copy. */
  rawText: string;
}

/** Walks raw OCR text once and returns the highest-confidence
 *  total / date / merchant. Pure function, easy to test. */
export function parseReceipt(rawText: string): ParsedReceipt {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Total — look for "TOTAL", "AMOUNT", "DUE", "GRAND TOTAL" labels with a
  // money-shaped value on the same line. Prefer the LAST occurrence (the
  // grand total typically follows subtotals).
  const totalRe =
    /\b(grand\s*total|total\s*due|amount\s*due|total\s*amount|total\s*a\s*payer|total)\s*[:\-]?\s*[$€£¥₺ر.س]?\s*(\d+(?:[.,]\d{2}))/i;
  let total: number | null = null;
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i].match(totalRe);
    if (m) {
      const n = parseFloat(m[2].replace(',', '.'));
      if (Number.isFinite(n) && n > 0) {
        total = n;
        break;
      }
    }
  }
  // Fallback: largest money value seen anywhere on the receipt.
  if (total == null) {
    let best = 0;
    for (const line of lines) {
      for (const m of line.matchAll(/\b(\d+[.,]\d{2})\b/g)) {
        const n = parseFloat(m[1].replace(',', '.'));
        if (Number.isFinite(n) && n > best) best = n;
      }
    }
    if (best > 0) total = best;
  }

  // Date — common formats: 2026-05-09, 09/05/2026, 09.05.26, May 09 2026.
  // Returned as unix ms when interpretable.
  let date: number | null = null;
  for (const line of lines) {
    const iso = line.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
    if (iso) {
      const d = new Date(`${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`);
      if (!Number.isNaN(d.getTime())) {
        date = d.getTime();
        break;
      }
    }
    const dmy = line.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2}|\d{2})\b/);
    if (dmy) {
      const yy = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
      const d = new Date(`${yy}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`);
      if (!Number.isNaN(d.getTime())) {
        date = d.getTime();
        break;
      }
    }
  }

  // Merchant — first non-empty line, capped to 40 chars. Heuristic,
  // catches storefronts that print the brand at the top of the receipt.
  const merchant = lines[0] ? lines[0].slice(0, 40) : null;

  return { total, date, merchant, rawText };
}
