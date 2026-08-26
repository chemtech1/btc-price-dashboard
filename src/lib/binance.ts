import type { RangeId } from "./ranges";
import type { CoinPrice, EurPair, HistoryPoint, SearchResult } from "./types";

const BASE = process.env.BINANCE_API_BASE ?? "https://api.binance.com";

const inflight = new Map<string, Promise<unknown>>();

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function binanceFetchOnce<T>(path: string): Promise<T> {
  let lastError = "Binance request failed";

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (res.ok) {
      return (await res.json()) as T;
    }

    const body = await res.text().catch(() => "");
    lastError = `Binance ${res.status}: ${body.slice(0, 200) || res.statusText}`;

    if (res.status === 429 || res.status >= 500) {
      await sleep(500 * (attempt + 1));
      continue;
    }

    throw new Error(lastError);
  }

  throw new Error(lastError);
}

/** Deduplicate concurrent identical Binance GETs (no TTL cache). */
async function binanceFetch<T>(path: string): Promise<T> {
  const cacheKey = `bn:${path}`;
  const existing = inflight.get(cacheKey);
  if (existing) return existing as Promise<T>;

  const promise = binanceFetchOnce<T>(path).finally(() => {
    inflight.delete(cacheKey);
  });

  inflight.set(cacheKey, promise);
  return promise;
}

export function isEurSymbol(symbol: string): boolean {
  return /^[A-Z0-9]{2,20}EUR$/.test(symbol);
}

export function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase();
}

type ExchangeSymbol = {
  symbol: string;
  status: string;
  baseAsset: string;
  quoteAsset: string;
};

type ExchangeInfo = {
  symbols: ExchangeSymbol[];
};

export async function fetchEurPairsFromBinance(): Promise<EurPair[]> {
  const info = await binanceFetch<ExchangeInfo>("/api/v3/exchangeInfo");
  return info.symbols
    .filter((s) => s.quoteAsset === "EUR" && s.status === "TRADING")
    .map((s) => ({
      symbol: s.symbol,
      baseAsset: s.baseAsset,
      quoteAsset: "EUR" as const,
    }))
    .sort((a, b) => a.baseAsset.localeCompare(b.baseAsset));
}

type Ticker24h = {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  closeTime: number;
};

export function tickerToPrice(t: Ticker24h, baseAsset?: string): CoinPrice {
  const base = baseAsset ?? t.symbol.replace(/EUR$/, "");
  return {
    id: t.symbol,
    symbol: base.toLowerCase(),
    name: base,
    image: "",
    current_price: Number(t.lastPrice),
    price_change_24h: Number(t.priceChange),
    price_change_percentage_24h: Number(t.priceChangePercent),
    last_updated: new Date(t.closeTime).toISOString(),
  };
}

export async function fetchTickerFromBinance(symbol: string): Promise<Ticker24h> {
  return binanceFetch<Ticker24h>(
    `/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`,
  );
}

/** Binance kline row */
export type KlineRow = [
  number, // open time
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // close time
  ...unknown[],
];

export async function fetchKlinesPageFromBinance(
  symbol: string,
  interval: string,
  limit: number,
  opts?: { endTime?: number; startTime?: number },
): Promise<KlineRow[]> {
  const params = new URLSearchParams({
    symbol,
    interval,
    limit: String(Math.min(limit, 1000)),
  });
  if (opts?.endTime != null) params.set("endTime", String(opts.endTime));
  if (opts?.startTime != null) params.set("startTime", String(opts.startTime));
  return binanceFetch<KlineRow[]>(`/api/v3/klines?${params}`);
}

export function rowsToPoints(rows: KlineRow[]): HistoryPoint[] {
  return rows.map((row) => ({
    t: row[0],
    price: Number(row[4]),
  }));
}

export function klineRowsToDb(
  symbol: string,
  interval: string,
  rows: KlineRow[],
) {
  return rows.map((row) => ({
    symbol,
    interval,
    open_time: row[0],
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    close_time: row[6],
  }));
}

/** Pull enough historical pages for a range (used when DB is empty / backfilling). */
export async function fetchHistoryPagesFromBinance(
  symbol: string,
  interval: string,
  limit: number,
  maxPages?: number,
): Promise<KlineRow[]> {
  const pages = maxPages ?? Math.max(1, Math.ceil(limit / 1000));
  const all: KlineRow[] = [];
  let endTime: number | undefined;

  for (let i = 0; i < pages; i++) {
    const need = Math.min(1000, limit - all.length);
    if (need <= 0) break;

    const page = await fetchKlinesPageFromBinance(symbol, interval, need, {
      endTime,
    });
    if (page.length === 0) break;

    all.unshift(...page);
    endTime = page[0][0] - 1;

    if (page.length < need) break;
  }

  const byTime = new Map<number, KlineRow>();
  for (const row of all) byTime.set(row[0], row);
  return [...byTime.values()].sort((a, b) => a[0] - b[0]);
}

export function scoreSearch(query: string, pairs: EurPair[]): SearchResult[] {
  const q = query.trim().toUpperCase();
  if (q.length < 1) return [];

  return pairs
    .map((p) => {
      const base = p.baseAsset.toUpperCase();
      const sym = p.symbol.toUpperCase();
      let score = 0;
      if (base === q || sym === q || sym === `${q}EUR`) score = 100;
      else if (base.startsWith(q) || sym.startsWith(q)) score = 80;
      else if (base.includes(q) || sym.includes(q)) score = 40;
      else return null;
      return { pair: p, score };
    })
    .filter((x): x is { pair: EurPair; score: number } => x != null)
    .sort((a, b) => b.score - a.score || a.pair.baseAsset.localeCompare(b.pair.baseAsset))
    .slice(0, 20)
    .map(({ pair }) => ({
      id: pair.symbol,
      name: pair.baseAsset,
      symbol: pair.baseAsset,
      thumb: "",
      market_cap_rank: null,
    }));
}

export type { RangeId };
