import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS eur_pairs (
  symbol TEXT PRIMARY KEY,
  base_asset TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tickers (
  symbol TEXT PRIMARY KEY,
  last_price REAL NOT NULL,
  price_change_24h REAL NOT NULL,
  price_change_pct_24h REAL NOT NULL,
  last_updated TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS klines (
  symbol TEXT NOT NULL,
  interval TEXT NOT NULL,
  open_time INTEGER NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  volume REAL NOT NULL,
  close_time INTEGER NOT NULL,
  PRIMARY KEY (symbol, interval, open_time)
);

CREATE INDEX IF NOT EXISTS idx_klines_symbol_interval_time
  ON klines (symbol, interval, open_time DESC);

CREATE INDEX IF NOT EXISTS idx_tickers_fetched_at
  ON tickers (fetched_at DESC);

CREATE TABLE IF NOT EXISTS watchlist (
  symbol TEXT PRIMARY KEY,
  symbol_short TEXT NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);
`

type GlobalDb = typeof globalThis & {
  __cryptoDb?: Database.Database;
};

function resolveDbPath(): string {
  if (process.env.CRYPTO_DB_PATH) {
    return path.resolve(process.env.CRYPTO_DB_PATH);
  }
  return path.join(process.cwd(), "data", "crypto.db");
}

export function getDb(): Database.Database {
  const g = globalThis as GlobalDb;
  if (g.__cryptoDb) return g.__cryptoDb;

  const dbPath = resolveDbPath();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("synchronous = NORMAL");
  db.exec(SCHEMA);

  g.__cryptoDb = db;
  return db;
}

export function getMeta(key: string): string | undefined {
  const row = getDb()
    .prepare("SELECT value FROM meta WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value;
}

export function setMeta(key: string, value: string): void {
  getDb()
    .prepare(
      `INSERT INTO meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .run(key, value);
}
