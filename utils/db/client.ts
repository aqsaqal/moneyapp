// Drizzle + expo-sqlite client.
// Single process-wide DB handle; lazy-initialized on first access.

import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from './schema';

const DB_NAME = 'moneyflow.db';

let _expo: SQLite.SQLiteDatabase | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDB() {
  if (!_db || !_expo) {
    _expo = SQLite.openDatabaseSync(DB_NAME, { enableChangeListener: true });
    _db = drizzle(_expo, { schema });
    createTables(_expo);
  }
  return _db;
}

export function getRawDB() {
  if (!_expo) getDB();
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
      halal_status TEXT
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
      sort_order INTEGER NOT NULL DEFAULT 0
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
  `);
}

/** Close and reset. Useful for tests and "erase all data" flows. */
export function resetDB() {
  _expo?.closeSync();
  SQLite.deleteDatabaseSync(DB_NAME);
  _expo = null;
  _db = null;
}
