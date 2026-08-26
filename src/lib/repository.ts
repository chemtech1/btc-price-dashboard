import { getDb, getMeta, setMeta } from "./db";
import type { CandlePoint, CoinPrice, EurPair, HistoryPoint } from "./types";

export type KlineRowDb = {
  symbol: string;
  interval: string;
  open_time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  close_time: number;
};

export function getEurPairsFetchedAt(): number | undefined {
  const raw = getMeta("eur_pairs_fetched_at");
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export function listEurPairs(): EurPair[] {
  const rows = getDb()
    .prepare("SELECT symbol, base_asset FROM eur_pairs ORDER BY base_asset ASC")
    .all() as { symbol: string; base_asset: string }[];

  return rows.map((r) => ({
    symbol: r.symbol,
    baseAsset: r.base_asset,
    quoteAsset: "EUR" as const,
  }));
}

export function replaceEurPairs(pairs: EurPair[]): void {
  const db = getDb();
  const now = Date.now();
  const tx = db.transaction((items: EurPair[]) => {
    db.prepare("DELETE FROM eur_pairs").run();
    const insert = db.prepare(
      "INSERT INTO eur_pairs (symbol, base_asset, updated_at) VALUES (?, ?, ?)",
    );
    for (const p of items) {
      insert.run(p.symbol, p.baseAsset, now);
    }
    setMeta("eur_pairs_fetched_at", String(now));
  });
  tx(pairs);
}

export function getTicker(symbol: string): CoinPrice | undefined {
  const row = getDb()
    .prepare(
      `SELECT symbol, last_price, price_change_24h, price_change_pct_24h, last_updated, fetched_at
       FROM tickers WHERE symbol = ?`,
    )
    .get(symbol) as
    | {
        symbol: string;
        last_price: number;
        price_change_24h: number;
        price_change_pct_24h: number;
        last_updated: string;
        fetched_at: number;
      }
    | undefined;

  if (!row) return undefined;

  const base = row.symbol.replace(/EUR$/, "");
  return {
    id: row.symbol,
    symbol: base.toLowerCase(),
    name: base,
    image: "",
    current_price: row.last_price,
    price_change_24h: row.price_change_24h,
    price_change_percentage_24h: row.price_change_pct_24h,
    last_updated: row.last_updated,
  };
}

export function getTickerFetchedAt(symbol: string): number | undefined {
  const row = getDb()
    .prepare("SELECT fetched_at FROM tickers WHERE symbol = ?")
    .get(symbol) as { fetched_at: number } | undefined;
  return row?.fetched_at;
}

export function upsertTickers(
  prices: Array<{
    symbol: string;
    last_price: number;
    price_change_24h: number;
    price_change_pct_24h: number;
    last_updated: string;
  }>,
): void {
  const db = getDb();
  const now = Date.now();
  const stmt = db.prepare(
    `INSERT INTO tickers (
       symbol, last_price, price_change_24h, price_change_pct_24h, last_updated, fetched_at
     ) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(symbol) DO UPDATE SET
       last_price = excluded.last_price,
       price_change_24h = excluded.price_change_24h,
       price_change_pct_24h = excluded.price_change_pct_24h,
       last_updated = excluded.last_updated,
       fetched_at = excluded.fetched_at`,
  );

  const tx = db.transaction((items: typeof prices) => {
    for (const p of items) {
      stmt.run(
        p.symbol,
        p.last_price,
        p.price_change_24h,
        p.price_change_pct_24h,
        p.last_updated,
        now,
      );
    }
  });
  tx(prices);
}

export function listRecentTickerSymbols(maxAgeMs: number, limit = 50): string[] {
  const cutoff = Date.now() - maxAgeMs;
  const rows = getDb()
    .prepare(
      `SELECT symbol FROM tickers
       WHERE fetched_at >= ?
       ORDER BY fetched_at DESC
       LIMIT ?`,
    )
    .all(cutoff, limit) as { symbol: string }[];
  return rows.map((r) => r.symbol);
}

export function getLatestKlineOpenTime(symbol: string, interval: string): number | undefined {
  const row = getDb()
    .prepare(
      `SELECT open_time FROM klines
       WHERE symbol = ? AND interval = ?
       ORDER BY open_time DESC
       LIMIT 1`,
    )
    .get(symbol, interval) as { open_time: number } | undefined;
  return row?.open_time;
}

export function countKlines(symbol: string, interval: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM klines WHERE symbol = ? AND interval = ?`,
    )
    .get(symbol, interval) as { c: number };
  return row.c;
}

export function upsertKlines(rows: KlineRowDb[]): void {
  if (rows.length === 0) return;
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO klines (
       symbol, interval, open_time, open, high, low, close, volume, close_time
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(symbol, interval, open_time) DO UPDATE SET
       open = excluded.open,
       high = excluded.high,
       low = excluded.low,
       close = excluded.close,
       volume = excluded.volume,
       close_time = excluded.close_time`,
  );

  const tx = db.transaction((items: KlineRowDb[]) => {
    for (const r of items) {
      stmt.run(
        r.symbol,
        r.interval,
        r.open_time,
        r.open,
        r.high,
        r.low,
        r.close,
        r.volume,
        r.close_time,
      );
    }
  });
  tx(rows);
}

export function getHistoryPoints(
  symbol: string,
  interval: string,
  limit: number,
): HistoryPoint[] {
  const rows = getDb()
    .prepare(
      `SELECT open_time AS t, close AS price
       FROM klines
       WHERE symbol = ? AND interval = ?
       ORDER BY open_time DESC
       LIMIT ?`,
    )
    .all(symbol, interval, limit) as HistoryPoint[];

  return rows.reverse();
}

export function getCandles(
  symbol: string,
  interval: string,
  limit: number,
): CandlePoint[] {
  const rows = getDb()
    .prepare(
      `SELECT open_time AS t, open, high, low, close, volume
       FROM klines
       WHERE symbol = ? AND interval = ?
       ORDER BY open_time DESC
       LIMIT ?`,
    )
    .all(symbol, interval, limit) as CandlePoint[];

  return rows.reverse();
}

export function pruneOldKlines(retentionMs: Record<string, number>): void {
  const db = getDb();
  const now = Date.now();
  const stmt = db.prepare(
    `DELETE FROM klines WHERE interval = ? AND open_time < ?`,
  );
  const tx = db.transaction(() => {
    for (const [interval, keepMs] of Object.entries(retentionMs)) {
      stmt.run(interval, now - keepMs);
    }
  });
  tx();
}
