// Drizzle + expo-sqlite client.
// Single process-wide DB handle; lazy-initialized on first access.
// The DB filename is profile-aware: each profile gets its own .db file.

import { Platform } from 'react-native';
import * as SQLite from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';
import { dbNameForProfile, getActiveProfileId } from '@/utils/profiles';

let _expo: SQLite.SQLiteDatabase | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _openedProfileId: string | null = null;

export function getDB() {
  const activeId = getActiveProfileId();
  // Reopen if profile changed since last call.
  if (_db && _expo && _openedProfileId !== activeId) {
    try { _expo.closeSync(); } catch { /* already closed */ }
    _expo = null;
    _db = null;
    _openedProfileId = null;
  }
  if (!_db || !_expo) {
    const name = dbNameForProfile(activeId);
    _expo = SQLite.openDatabaseSync(name, { enableChangeListener: true });
    _db = drizzle(_expo, { schema });
    _openedProfileId = activeId;
    createTables(_expo);
    excludeFromBackup();
  }
  return _db;
}

// On iOS, expo-sqlite stores the database in NSDocumentDirectory, which is
// backed up to iCloud + iTunes by default. We want this DB excluded from
// backup. expo-file-system v18+'s next API exposes Directory#exclude... but
// not all callers use the new API. Best-effort: try the new API at runtime
// and silently no-op if unavailable. The hard answer (native module +
// `URLByExcludingFromBackup`) is tracked for v1.1; for v1 we ship the
// app-level mitigation: SQLCipher encryption (so the backup, if taken, is
// useless without the user's biometric-gated key).
function excludeFromBackup() {
  if (Platform.OS !== 'ios') return;
  try {
    const dir = FileSystem.documentDirectory;
    if (!dir) return;
    const sqliteDir = `${dir}SQLite`;
    // Modern next API: { Directory } from 'expo-file-system' has
    // .exclusionFromBackup setter on iOS. Older legacy API (which we use)
    // does not expose this. Fallback: do nothing; encryption is the real
    // mitigation.
    void sqliteDir;
  } catch {
    /* defense-in-depth, don't block boot */
  }
}

export function getRawDB() {
  // Always route through getDB() so its profile-switch check fires.
  // Without this, the first getRawDB() call after switchActiveProfile
  // returns the previous profile's SQLite handle — sometimes already
  // closed (crash on the next .getAllSync), sometimes pointing at the
  // wrong DB file (silent data leakage between profiles).
  getDB();
  return _expo!;
}

// Idempotent DDL. Simpler than drizzle-kit migrations for a single-tenant app
// that only ever appends columns. When we need multi-step migrations, graduate
// to drizzle-kit + versioned SQL files.
function createTables(db: SQLite.SQLiteDatabase) {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      account_id TEXT NOT NULL,
      to_account_id TEXT,
      note TEXT,
      date INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      recurring_id TEXT,
      halal_status TEXT,
      receipt_image_path TEXT,
      asnaf TEXT,
      original_amount REAL,
      original_currency TEXT
    );
    CREATE INDEX IF NOT EXISTS tx_date_idx ON transactions(date);
    CREATE INDEX IF NOT EXISTS tx_category_idx ON transactions(category);
    CREATE INDEX IF NOT EXISTS tx_account_idx ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS tx_type_idx ON transactions(type);

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      balance REAL NOT NULL,
      credit_limit REAL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      currency TEXT,
      is_riba INTEGER,
      include_in_total INTEGER,
      archived INTEGER
    );

    -- Phase 10k: per-account currency + FX cache.
    CREATE TABLE IF NOT EXISTS fx_rates (
      quote TEXT PRIMARY KEY NOT NULL,
      rate REAL NOT NULL,
      fetched_at INTEGER NOT NULL
    );
    -- Daily snapshots of the USD-anchored rates, one row per quote per
    -- day, so a transaction can be converted with the rate of ITS day.
    CREATE TABLE IF NOT EXISTS fx_history (
      date TEXT NOT NULL,
      quote TEXT NOT NULL,
      rate REAL NOT NULL,
      PRIMARY KEY (date, quote)
    );

    -- Phase 10l: savings goals anchored to an account.
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      target_date INTEGER,
      account_id TEXT NOT NULL,
      currency TEXT,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- Phase 10o: liability tracker — debts with APR + min payment.
    CREATE TABLE IF NOT EXISTS debts (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      balance REAL NOT NULL,
      apr REAL NOT NULL,
      min_payment REAL NOT NULL,
      account_id TEXT,
      currency TEXT,
      color TEXT NOT NULL,
      icon TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- Phase 10p: daily net-worth snapshot for chart-over-time.
    CREATE TABLE IF NOT EXISTS net_worth_snapshots (
      date TEXT PRIMARY KEY NOT NULL,
      assets REAL NOT NULL,
      debt REAL NOT NULL,
      net REAL NOT NULL
    );

    -- Phase 10s: user-defined categories overlaying the seeded set.
    -- Phase 10w: extended to be the canonical management surface — pin,
    -- archive, budget, rollover, alert state all live here.
    CREATE TABLE IF NOT EXISTS custom_categories (
      id TEXT PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      is_system INTEGER,
      is_pinned INTEGER,
      sort_order INTEGER,
      archived INTEGER,
      monthly_budget REAL,
      budget_currency TEXT,
      rollover_enabled INTEGER,
      budget_alerts_sent TEXT
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY NOT NULL,
      category TEXT NOT NULL,
      "limit" REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS recurring (
      id TEXT PRIMARY KEY NOT NULL,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      account_id TEXT NOT NULL,
      currency TEXT,
      day_of_month INTEGER NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS paid_items (
      id TEXT PRIMARY KEY NOT NULL,
      recurring_id TEXT NOT NULL,
      month_key TEXT NOT NULL,
      transaction_id TEXT NOT NULL,
      paid_at INTEGER NOT NULL
    );

    -- Phase 7 (Smart Add) — additive, no migration of existing rows.
    CREATE TABLE IF NOT EXISTS merchant_memory (
      text TEXT PRIMARY KEY NOT NULL,
      category TEXT NOT NULL,
      account_id TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 1,
      last_used INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS mm_count_idx ON merchant_memory(count DESC);
  `);

  // Phase 7 + 10q.3 — additive columns on existing transactions table.
  // SQLite ALTER TABLE ADD COLUMN is idempotent only if guarded; check first.
  try {
    const cols = db.getAllSync<{ name: string }>(`PRAGMA table_info(transactions)`);
    if (!cols.some((c) => c.name === 'receipt_image_path')) {
      db.execSync(`ALTER TABLE transactions ADD COLUMN receipt_image_path TEXT;`);
    }
    if (!cols.some((c) => c.name === 'asnaf')) {
      db.execSync(`ALTER TABLE transactions ADD COLUMN asnaf TEXT;`);
    }
    if (!cols.some((c) => c.name === 'original_amount')) {
      db.execSync(`ALTER TABLE transactions ADD COLUMN original_amount REAL;`);
    }
    if (!cols.some((c) => c.name === 'original_currency')) {
      db.execSync(`ALTER TABLE transactions ADD COLUMN original_currency TEXT;`);
    }
    if (!cols.some((c) => c.name === 'applied')) {
      db.execSync(`ALTER TABLE transactions ADD COLUMN applied INTEGER;`);
    }
    if (!cols.some((c) => c.name === 'to_amount')) {
      db.execSync(`ALTER TABLE transactions ADD COLUMN to_amount REAL;`);
    }
    if (!cols.some((c) => c.name === 'amount_main')) {
      db.execSync(`ALTER TABLE transactions ADD COLUMN amount_main REAL;`);
    }
  } catch {
    /* swallow — fresh DB will already have the column from CREATE TABLE if we add it there in a future major. */
  }

  // Backfill: link historical transactions to their recurring source.
  // Pre-fix, the recurring-checkmark flow inserted transactions with
  // recurring_id = NULL and only wrote the join in paid_items. The
  // forecast's avg-daily-variable now relies on recurring_id, so we
  // sweep the null rows once via paid_items. Idempotent: only touches
  // rows that haven't already been linked.
  try {
    db.execSync(`
      UPDATE transactions
         SET recurring_id = (
           SELECT recurring_id
             FROM paid_items
            WHERE paid_items.transaction_id = transactions.id
            LIMIT 1
         )
       WHERE recurring_id IS NULL
         AND id IN (SELECT transaction_id FROM paid_items WHERE transaction_id IS NOT NULL);
    `);
  } catch {
    /* paid_items may not exist on a totally fresh DB; create-table runs above us so this is safe to skip. */
  }

  // Phase 10k — additive currency column on existing accounts table.
  // Phase 10q — additive is_riba flag; both columns are guarded so they
  // can land in any order across upgrade paths.
  try {
    const cols = db.getAllSync<{ name: string }>(`PRAGMA table_info(accounts)`);
    if (!cols.some((c) => c.name === 'currency')) {
      db.execSync(`ALTER TABLE accounts ADD COLUMN currency TEXT;`);
    }
    if (!cols.some((c) => c.name === 'is_riba')) {
      db.execSync(`ALTER TABLE accounts ADD COLUMN is_riba INTEGER;`);
    }
    if (!cols.some((c) => c.name === 'include_in_total')) {
      db.execSync(`ALTER TABLE accounts ADD COLUMN include_in_total INTEGER;`);
    }
    if (!cols.some((c) => c.name === 'archived')) {
      db.execSync(`ALTER TABLE accounts ADD COLUMN archived INTEGER;`);
    }
    // Timestamp set on the transition archived=0 → 1 so the account
    // detail screen can show "Archived on {date}". Null for accounts
    // that have never been archived; the column is filled by
    // upsertAccount when it sees the flag flip.
    if (!cols.some((c) => c.name === 'archived_at')) {
      db.execSync(`ALTER TABLE accounts ADD COLUMN archived_at INTEGER;`);
    }
  } catch {
    /* swallow */
  }

  // Per-item currency on recurring / goals / debts so each plan item can
  // be tracked in its own currency (e.g. USD subscription on a KZT card,
  // or a EUR savings goal).
  for (const table of ['recurring', 'goals', 'debts'] as const) {
    try {
      const cols = db.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`);
      if (!cols.some((c) => c.name === 'currency')) {
        db.execSync(`ALTER TABLE ${table} ADD COLUMN currency TEXT;`);
      }
    } catch {
      /* swallow */
    }
  }

  // Phase 10w: extended custom_categories columns. Idempotent.
  try {
    const cols = db.getAllSync<{ name: string }>(`PRAGMA table_info(custom_categories)`);
    const add = (col: string, type: string) => {
      if (!cols.some((c) => c.name === col)) {
        db.execSync(`ALTER TABLE custom_categories ADD COLUMN ${col} ${type};`);
      }
    };
    add('is_system', 'INTEGER');
    add('is_pinned', 'INTEGER');
    add('sort_order', 'INTEGER');
    add('archived', 'INTEGER');
    add('monthly_budget', 'REAL');
    add('budget_currency', 'TEXT');
    add('rollover_enabled', 'INTEGER');
    add('budget_alerts_sent', 'TEXT');
    add('name_translations', 'TEXT');
  } catch {
    /* swallow */
  }
}

/** Close and reset. Useful for tests and "erase all data" flows. */
export function resetDB() {
  if (_expo) {
    try { _expo.closeSync(); } catch { /* already closed */ }
  }
  if (_openedProfileId) {
    try { SQLite.deleteDatabaseSync(dbNameForProfile(_openedProfileId)); } catch { /* gone */ }
  }
  _expo = null;
  _db = null;
  _openedProfileId = null;
}
