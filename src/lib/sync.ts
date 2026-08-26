import {
  fetchEurPairsFromBinance,
  fetchHistoryPagesFromBinance,
  fetchKlinesPageFromBinance,
  fetchTickersFromBinance,
  isEurSymbol,
  klineRowsToDb,
  normalizeSymbol,
  scoreSearch,
  tickerToPrice,
} from "./binance";
import { getMeta, setMeta } from "./db";
import { aggregateOhlc, fillCandleGaps } from "./aggregate";
import {
  candleTipMaxAgeMs,
  getCandleRange,
  type CandleIntervalId,
} from "./candle-ranges";
import { getRange, type RangeId } from "./ranges";
import {
  countKlines,
  getCandles,
  getEurPairsFetchedAt,
  getHistoryPoints,
  getLatestKlineOpenTime,
  getTicker,
  getTickerFetchedAt,
  listEurPairs,
  listRecentTickerSymbols,
  pruneOldKlines,
  replaceEurPairs,
  upsertKlines,
  upsertTickers,
} from "./repository";
import {
  BG_HISTORY_EVERY_MS,
  BG_PRUNE_EVERY_MS,
  EUR_PAIRS_TTL_MS,
  INTERVAL_MS,
  KLINE_RETENTION_MS,
  META_BG_HISTORY_AT,
  META_BG_PRUNE_AT,
  TICKER_TTL_MS,
} from "./sync-config";
import type { CandlePoint, CoinPrice, HistoryPoint, SearchResult } from "./types";

function isFresh(fetchedAt: number | undefined, ttlMs: number): boolean {
  if (fetchedAt == null) return false;
  return Date.now() - fetchedAt < ttlMs;
}

function readMetaTime(key: string): number | undefined {
  const raw = getMeta(key);
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export async function ensureEurPairs(force = false) {
  const fetchedAt = getEurPairsFetchedAt();
  if (!force && isFresh(fetchedAt, EUR_PAIRS_TTL_MS)) {
    const cached = listEurPairs();
    if (cached.length > 0) return cached;
  }

  try {
    const pairs = await fetchEurPairsFromBinance();
    replaceEurPairs(pairs);
    return pairs;
  } catch (err) {
    const stale = listEurPairs();
    if (stale.length > 0) return stale;
    throw err;
  }
}

export async function ensureTickers(symbols: string[]): Promise<CoinPrice[]> {
  const unique = [...new Set(symbols.map(normalizeSymbol).filter(isEurSymbol))];
  if (unique.length === 0) return [];

  const pairs = await ensureEurPairs();
  const baseBySymbol = new Map(pairs.map((p) => [p.symbol, p.baseAsset]));

  const stale: string[] = [];
  const fresh: CoinPrice[] = [];

  for (const symbol of unique) {
    const fetchedAt = getTickerFetchedAt(symbol);
    const cached = getTicker(symbol);
    if (cached && isFresh(fetchedAt, TICKER_TTL_MS)) {
      fresh.push(cached);
    } else {
      stale.push(symbol);
    }
  }

  if (stale.length > 0) {
    try {
      const tickers = await fetchTickersFromBinance(stale);
      const fetched = tickers.map((ticker) =>
        tickerToPrice(ticker, baseBySymbol.get(ticker.symbol)),
      );

      upsertTickers(
        fetched.map((p) => ({
          symbol: p.id,
          last_price: p.current_price,
          price_change_24h: p.price_change_24h,
          price_change_pct_24h: p.price_change_percentage_24h,
          last_updated: p.last_updated,
        })),
      );

      fresh.push(...fetched);
    } catch (err) {
      for (const symbol of stale) {
        const cached = getTicker(symbol);
        if (cached) fresh.push(cached);
      }
      if (fresh.length === 0) throw err;
    }
  }

  const byId = new Map(fresh.map((p) => [p.id, p]));
  return unique.map((id) => byId.get(id)).filter((p): p is CoinPrice => p != null);
}

function historyNeedsRefresh(
  symbol: string,
  interval: string,
  limit: number,
  cacheSeconds: number,
): boolean {
  const count = countKlines(symbol, interval);
  if (count < limit) return true;

  const latest = getLatestKlineOpenTime(symbol, interval);
  if (latest == null) return true;

  const intervalMs = INTERVAL_MS[interval] ?? 60_000;
  // 1s charts: refresh as soon as a new second candle can exist
  if (interval === "1s") {
    return Date.now() - latest >= intervalMs;
  }
  const maxAge = intervalMs + cacheSeconds * 1000;
  return Date.now() - latest > maxAge;
}

async function pullHistoryIntoDb(
  symbol: string,
  interval: string,
  limit: number,
  maxPages?: number,
): Promise<void> {
  const pages = maxPages ?? Math.max(1, Math.ceil(limit / 1000));

  // Short/medium windows: always replace with a continuous recent slice from
  // Binance (avoids holes between an old DB tip and a fresh "latest page").
  if (!maxPages && limit <= 2000) {
    const rows = await fetchHistoryPagesFromBinance(
      symbol,
      interval,
      Math.max(limit, 50),
      Math.max(1, Math.ceil(Math.max(limit, 50) / 1000)),
    );
    upsertKlines(klineRowsToDb(symbol, interval, rows));
    return;
  }

  const have = countKlines(symbol, interval);
  if (have < limit) {
    const rows = await fetchHistoryPagesFromBinance(
      symbol,
      interval,
      Math.max(limit, pages * 1000),
      pages,
    );
    upsertKlines(klineRowsToDb(symbol, interval, rows));
  }

  const recent = await fetchKlinesPageFromBinance(
    symbol,
    interval,
    Math.min(1000, Math.max(limit, 50)),
  );
  upsertKlines(klineRowsToDb(symbol, interval, recent));
}

export async function ensureHistory(
  symbolRaw: string,
  rangeId: RangeId,
): Promise<HistoryPoint[]> {
  const symbol = normalizeSymbol(symbolRaw);
  if (!isEurSymbol(symbol)) {
    throw new Error(`Ungültiges EUR-Symbol: ${symbolRaw}`);
  }

  const range = getRange(rangeId);
  if (!range) {
    throw new Error(`Unbekannter Zeitraum: ${rangeId}`);
  }

  const targetLimit =
    rangeId === "max" ? (range.maxPages ?? 8) * 1000 : range.limit;

  const needs = historyNeedsRefresh(
    symbol,
    range.interval,
    targetLimit,
    range.cacheSeconds,
  );

  if (needs) {
    try {
      await pullHistoryIntoDb(
        symbol,
        range.interval,
        targetLimit,
        rangeId === "max" ? range.maxPages : undefined,
      );
    } catch (err) {
      const stale = getHistoryPoints(symbol, range.interval, targetLimit);
      if (stale.length === 0) throw err;
      return stale;
    }
  }

  return getHistoryPoints(symbol, range.interval, targetLimit);
}

function candleSourceNeedsRefresh(
  symbol: string,
  sourceInterval: string,
  sourceLimit: number,
  tipMaxAgeMs: number,
): boolean {
  const count = countKlines(symbol, sourceInterval);
  if (count < sourceLimit) return true;
  const latest = getLatestKlineOpenTime(symbol, sourceInterval);
  if (latest == null) return true;
  return Date.now() - latest >= tipMaxAgeMs;
}

export async function ensureCandles(
  symbolRaw: string,
  intervalId: CandleIntervalId,
): Promise<CandlePoint[]> {
  const symbol = normalizeSymbol(symbolRaw);
  if (!isEurSymbol(symbol)) {
    throw new Error(`Ungültiges EUR-Symbol: ${symbolRaw}`);
  }

  const range = getCandleRange(intervalId);
  if (!range) {
    throw new Error(`Unbekanntes Kerzen-Intervall: ${intervalId}`);
  }

  const sourceInterval = range.sourceInterval;
  const sourceLimit = range.limit * (range.sourceFactor ?? 1);
  const tipMaxAgeMs = candleTipMaxAgeMs(intervalId);

  const needs = candleSourceNeedsRefresh(
    symbol,
    sourceInterval,
    sourceLimit,
    tipMaxAgeMs,
  );

  if (needs) {
    try {
      await pullHistoryIntoDb(symbol, sourceInterval, sourceLimit);
    } catch (err) {
      const staleSource = getCandles(symbol, sourceInterval, sourceLimit);
      if (staleSource.length === 0) throw err;
      if (range.aggregateMs) {
        return aggregateOhlc(staleSource, range.aggregateMs).slice(-range.limit);
      }
      const intervalMs = INTERVAL_MS[sourceInterval] ?? 60_000;
      return fillCandleGaps(staleSource.slice(-range.limit), intervalMs);
    }
  }

  const source = getCandles(symbol, sourceInterval, sourceLimit);
  if (range.aggregateMs) {
    return aggregateOhlc(source, range.aggregateMs).slice(-range.limit);
  }
  const intervalMs = INTERVAL_MS[sourceInterval] ?? 60_000;
  return fillCandleGaps(source.slice(-range.limit), intervalMs);
}

export async function searchCoins(query: string): Promise<SearchResult[]> {
  const pairs = await ensureEurPairs();
  return scoreSearch(query, pairs);
}

/** Symbols the background job should keep warm. */
export function symbolsForBackgroundSync(): string[] {
  const recent = listRecentTickerSymbols(24 * 60 * 60 * 1000, 40);
  return [...new Set(["BTCEUR", ...recent])].filter(isEurSymbol);
}

/**
 * Staggered background work:
 * - every tick: EUR pairs (TTL-gated) + tickers
 * - every ~15 min: warm 1d (5m) history — never 1s ranges
 * - every ~1h: prune old fine-grained klines
 */
export async function runBackgroundSync(): Promise<void> {
  const now = Date.now();

  try {
    await ensureEurPairs();
  } catch (err) {
    console.error("[sync] eur pairs", err);
  }

  const symbols = symbolsForBackgroundSync();

  try {
    await ensureTickers(symbols);
  } catch (err) {
    console.error("[sync] tickers", err);
  }

  const lastHistory = readMetaTime(META_BG_HISTORY_AT) ?? 0;
  if (now - lastHistory >= BG_HISTORY_EVERY_MS) {
    for (const symbol of symbols.slice(0, 10)) {
      try {
        await ensureHistory(symbol, "1d");
      } catch (err) {
        console.error(`[sync] history ${symbol}`, err);
      }
    }
    setMeta(META_BG_HISTORY_AT, String(now));
  }

  const lastPrune = readMetaTime(META_BG_PRUNE_AT) ?? 0;
  if (now - lastPrune >= BG_PRUNE_EVERY_MS) {
    try {
      pruneOldKlines(KLINE_RETENTION_MS);
      setMeta(META_BG_PRUNE_AT, String(now));
    } catch (err) {
      console.error("[sync] prune", err);
    }
  }
}
