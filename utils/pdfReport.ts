// PDF monthly reports — Phase 10n.
//
// Renders a printable HTML page per month and lets the user share it as
// a PDF via expo-print + expo-sharing. Two entry points:
//   - exportMonthlyPdf(monthKey, currency)        — one month
//   - exportYearlyPdf(year, currency)             — 12 months stacked,
//     one section per month, page-broken so each prints on its own
//     page. Tax-season bundle.
//
// The renderer is data-driven: it reads transactions/accounts/budgets
// from the active SQLite via getRawDB(), runs aggregations in JS, and
// emits a single self-contained HTML string with inline CSS. No images,
// no fonts that aren't widely available — keeps the PDF byte-portable
// and email-attachable.
//
// Privacy: like CSV export, the PDF includes everything the user can see
// in the app. Users decide where to share. No outbound calls.

import * as Sharing from 'expo-sharing';
import { Alert } from 'react-native';

// Lazy-imported so a JS bundle loaded into a binary that predates the
// expo-print native module doesn't crash at module-eval. The two PDF
// entry points show a friendly error when the module isn't available
// (older binary on the iOS sim or S26) rather than throwing.
type PrintModule = typeof import('expo-print');
let _print: PrintModule | null = null;
function getPrint(): PrintModule | null {
  if (_print) return _print;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _print = require('expo-print') as PrintModule;
    return _print;
  } catch {
    return null;
  }
}
import { getRawDB } from './db/client';
import { formatMoney } from './format';
import { catInfo } from '@/constants/categories';
import { APP_NAME } from '@/constants/flavor';
import type { CurrencyCode } from '@/constants/currency';

interface TxnRow {
  id: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number;
  category: string | null;
  account_id: string;
  to_account_id: string | null;
  note: string | null;
  date: number;
}

interface AccountRow {
  id: string;
  name: string;
  type: string;
  balance: number;
  currency: string | null;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function monthBounds(yearMonth: string): { start: number; end: number; label: string } {
  const [y, m] = yearMonth.split('-').map(Number);
  const start = new Date(y, m - 1, 1).getTime();
  const end = new Date(y, m, 1).getTime();
  const label = new Date(y, m - 1, 1).toLocaleString('en', { month: 'long', year: 'numeric' });
  return { start, end, label };
}

function renderMonthSection(monthKey: string, currency: CurrencyCode): string {
  const raw = getRawDB();
  const { start, end, label } = monthBounds(monthKey);

  const txns = raw.getAllSync(
    `SELECT id, type, amount, category, account_id, to_account_id, note, date
       FROM transactions
      WHERE date >= ? AND date < ?
      ORDER BY date DESC`,
    [start, end],
  ) as TxnRow[];
  const accounts = raw.getAllSync(
    `SELECT id, name, type, balance, currency FROM accounts`,
  ) as AccountRow[];
  const acctById = new Map(accounts.map((a) => [a.id, a]));

  const income = txns.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txns.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const net = income - expense;

  const byCat = new Map<string, number>();
  for (const t of txns) {
    if (t.type !== 'expense' || !t.category) continue;
    byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
  }
  const categoriesSorted = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]);

  const txRowsHtml = txns
    .map((t) => {
      const d = new Date(t.date);
      const dStr = `${d.getDate()} ${d.toLocaleString('en', { month: 'short' })}`;
      const acct = acctById.get(t.account_id)?.name ?? t.account_id;
      const sign = t.type === 'expense' ? '−' : t.type === 'income' ? '+' : '↔';
      const name = t.note ? escapeHtml(t.note)
        : t.category ? escapeHtml(catInfo(t.category).name)
        : t.type === 'transfer' ? 'Transfer' : '—';
      return `<tr>
        <td class="day">${dStr}</td>
        <td class="name">${name}</td>
        <td class="acct">${escapeHtml(acct)}</td>
        <td class="amt ${t.type}">${sign} ${escapeHtml(formatMoney(t.amount, currency))}</td>
      </tr>`;
    })
    .join('');

  const catRowsHtml = categoriesSorted
    .map(([cat, total]) => {
      const ci = catInfo(cat);
      const pct = expense > 0 ? Math.round((total / expense) * 100) : 0;
      return `<tr>
        <td><span class="dot" style="background:${ci.color}"></span>${escapeHtml(ci.name)}</td>
        <td class="amt">${escapeHtml(formatMoney(total, currency))}</td>
        <td class="pct">${pct}%</td>
      </tr>`;
    })
    .join('');

  return `
    <section class="month">
      <h2>${escapeHtml(label)}</h2>
      <div class="kpis">
        <div class="kpi"><span class="kpi-label">Income</span><span class="kpi-value pos">${escapeHtml(formatMoney(income, currency))}</span></div>
        <div class="kpi"><span class="kpi-label">Expenses</span><span class="kpi-value neg">${escapeHtml(formatMoney(expense, currency))}</span></div>
        <div class="kpi"><span class="kpi-label">Net</span><span class="kpi-value ${net >= 0 ? 'pos' : 'neg'}">${escapeHtml(formatMoney(net, currency))}</span></div>
        <div class="kpi"><span class="kpi-label">Transactions</span><span class="kpi-value">${txns.length}</span></div>
      </div>
      ${categoriesSorted.length > 0 ? `
        <h3>Spending by category</h3>
        <table class="cats">
          <thead><tr><th>Category</th><th class="amt">Total</th><th class="pct">% of expenses</th></tr></thead>
          <tbody>${catRowsHtml}</tbody>
        </table>
      ` : ''}
      ${txns.length > 0 ? `
        <h3>Transactions</h3>
        <table class="txns">
          <thead><tr><th class="day">Date</th><th>Description</th><th>Account</th><th class="amt">Amount</th></tr></thead>
          <tbody>${txRowsHtml}</tbody>
        </table>
      ` : '<p class="empty">No transactions this month.</p>'}
    </section>
  `;
}

const STYLE = `
  @page { size: A4; margin: 32px 36px; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111827; font-size: 11px; }
  header { border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 18px; }
  header h1 { margin: 0 0 2px; font-size: 22px; letter-spacing: -0.5px; }
  header .meta { color: #6b7280; font-size: 10px; }
  section.month { page-break-after: always; }
  section.month:last-of-type { page-break-after: auto; }
  h2 { font-size: 18px; margin: 0 0 12px; }
  h3 { font-size: 12px; text-transform: uppercase; letter-spacing: 0.6px; color: #6b7280; margin: 18px 0 6px; }
  .kpis { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
  .kpi { flex: 1; min-width: 110px; border: 1px solid #e5e7eb; border-radius: 8px; padding: 8px 10px; background: #f9fafb; }
  .kpi-label { display: block; font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; }
  .kpi-value { display: block; font-size: 16px; font-weight: 700; margin-top: 2px; }
  .pos { color: #047857; }
  .neg { color: #b91c1c; }
  table { width: 100%; border-collapse: collapse; margin-top: 4px; }
  th, td { padding: 5px 6px; text-align: left; border-bottom: 1px solid #f3f4f6; }
  th { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; border-bottom-color: #e5e7eb; }
  td.amt, th.amt { text-align: right; font-variant-numeric: tabular-nums; }
  td.pct, th.pct { text-align: right; width: 80px; color: #6b7280; }
  td.day, th.day { width: 64px; color: #6b7280; }
  td.acct { color: #6b7280; }
  .dot { display: inline-block; width: 8px; height: 8px; border-radius: 4px; margin-right: 6px; vertical-align: middle; }
  td.amt.expense { color: #b91c1c; }
  td.amt.income { color: #047857; }
  td.amt.transfer { color: #2563eb; }
  .empty { color: #6b7280; font-style: italic; }
  footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 9px; text-align: center; }
`;

function buildHtml(title: string, sections: string): string {
  const generatedAt = new Date().toISOString().slice(0, 10);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>${STYLE}</style>
  </head>
  <body>
    <header>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">${escapeHtml(APP_NAME)} · generated ${generatedAt}</div>
    </header>
    ${sections}
    <footer>For personal use only. Not financial, tax, or religious advice.</footer>
  </body>
</html>`;
}

async function shareHtmlAsPdf(html: string, fileNameStem: string): Promise<void> {
  const Print = getPrint();
  if (!Print) {
    Alert.alert(
      'PDF unavailable',
      'Reinstall the app to enable PDF export.',
    );
    return;
  }
  const { uri } = await Print.printToFileAsync({
    html,
    base64: false,
  });
  const ok = await Sharing.isAvailableAsync();
  if (ok) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: fileNameStem,
      UTI: 'com.adobe.pdf',
    });
  } else {
    Alert.alert('Saved', `PDF written to ${uri}`);
  }
}

export async function exportMonthlyPdf(monthKey: string, currency: CurrencyCode): Promise<void> {
  const sections = renderMonthSection(monthKey, currency);
  const { label } = monthBounds(monthKey);
  await shareHtmlAsPdf(buildHtml(label, sections), `${APP_NAME}-${monthKey}`);
}

export async function exportYearlyPdf(year: number, currency: CurrencyCode): Promise<void> {
  const sections: string[] = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, '0')}`;
    sections.push(renderMonthSection(key, currency));
  }
  await shareHtmlAsPdf(
    buildHtml(`${year} — annual report`, sections.join('')),
    `${APP_NAME}-${year}`,
  );
}
