export type CandleIntervalId = "10s" | "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export type CandleRangeConfig = {
  id: CandleIntervalId;
  label: string;
  limit: number;
  /** Soft HTTP cache hint; live tip refresh is driven by candlePollMs / tip age. */
  cacheSeconds: number;
  /** Binance (or synthetic) source interval stored/fetched in SQLite. */
  sourceInterval: "1s" | "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
  /** If set, aggregate source candles into this bucket size (ms). */
  aggregateMs?: number;
  /** How many source candles needed ≈ limit * factor. */
  sourceFactor?: number;
};

export const CANDLE_RANGES: CandleRangeConfig[] = [
  {
    id: "10s",
    label: "10s",
    // 100 × 10s = ~16 Min → exactly one Binance 1s page (1000) when refreshing
    limit: 100,
    cacheSeconds: 1,
    sourceInterval: "1s",
    aggregateMs: 10_000,
    sourceFactor: 10,
  },
  { id: "1m", label: "1m", limit: 120, cacheSeconds: 15, sourceInterval: "1m" },
  { id: "5m", label: "5m", limit: 288, cacheSeconds: 30, sourceInterval: "5m" },
  { id: "15m", label: "15m", limit: 192, cacheSeconds: 60, sourceInterval: "15m" },
  { id: "1h", label: "1h", limit: 168, cacheSeconds: 120, sourceInterval: "1h" },
  { id: "4h", label: "4h", limit: 180, cacheSeconds: 300, sourceInterval: "4h" },
  { id: "1d", label: "1d", limit: 365, cacheSeconds: 600, sourceInterval: "1d" },
];

export const DEFAULT_CANDLE_INTERVAL: CandleIntervalId = "1h";

/** Client poll while a candle chart is open. */
export const CANDLE_LIVE_POLL_MS = 5_000;
export const CANDLE_10S_POLL_MS = 1_000;

export function getCandleRange(id: string): CandleRangeConfig | undefined {
  return CANDLE_RANGES.find((r) => r.id === id);
}

export function candlePollMs(id: CandleIntervalId): number {
  if (id === "10s") return CANDLE_10S_POLL_MS;
  return CANDLE_LIVE_POLL_MS;
}

/** Max age of the open candle tip before we hit Binance again. */
export function candleTipMaxAgeMs(id: CandleIntervalId): number {
  if (id === "10s") return 1_000;
  return 5_000;
}

export function isCandleInterval(id: string): id is CandleIntervalId {
  return CANDLE_RANGES.some((r) => r.id === id);
}
