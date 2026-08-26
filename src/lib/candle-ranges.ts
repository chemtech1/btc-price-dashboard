export type CandleIntervalId =
  | "1m"
  | "5m"
  | "15m"
  | "30m"
  | "1h"
  | "5h"
  | "1d"
  | "1w"
  | "1M";

export type CandleRangeConfig = {
  id: CandleIntervalId;
  label: string;
  /** Number of candles in the visible window. */
  limit: number;
  cacheSeconds: number;
  sourceInterval: "1m" | "5m" | "15m" | "30m" | "1h" | "1d" | "1w" | "1M";
  aggregateMs?: number;
  sourceFactor?: number;
};

/** Visible candles: desktop 60, smartphone 40. Poll 1s. */
export const CANDLE_LIMIT = 60;
export const CANDLE_LIMIT_MOBILE = 40;
export const CANDLE_LIVE_POLL_MS = 1_000;

export const CANDLE_RANGES: CandleRangeConfig[] = [
  { id: "1m", label: "1m", limit: CANDLE_LIMIT, cacheSeconds: 1, sourceInterval: "1m" },
  { id: "5m", label: "5m", limit: CANDLE_LIMIT, cacheSeconds: 1, sourceInterval: "5m" },
  { id: "15m", label: "15m", limit: CANDLE_LIMIT, cacheSeconds: 1, sourceInterval: "15m" },
  { id: "30m", label: "30m", limit: CANDLE_LIMIT, cacheSeconds: 1, sourceInterval: "30m" },
  { id: "1h", label: "1h", limit: CANDLE_LIMIT, cacheSeconds: 1, sourceInterval: "1h" },
  {
    id: "5h",
    label: "5h",
    limit: CANDLE_LIMIT,
    cacheSeconds: 1,
    sourceInterval: "1h",
    aggregateMs: 5 * 60 * 60 * 1000,
    sourceFactor: 5,
  },
  { id: "1d", label: "1D", limit: CANDLE_LIMIT, cacheSeconds: 1, sourceInterval: "1d" },
  { id: "1w", label: "1W", limit: CANDLE_LIMIT, cacheSeconds: 1, sourceInterval: "1w" },
  { id: "1M", label: "1M", limit: CANDLE_LIMIT, cacheSeconds: 1, sourceInterval: "1M" },
];

export const DEFAULT_CANDLE_INTERVAL: CandleIntervalId = "1h";

export function getCandleRange(id: string): CandleRangeConfig | undefined {
  return CANDLE_RANGES.find((r) => r.id === id);
}

export function candlePollMs(_id: CandleIntervalId): number {
  return CANDLE_LIVE_POLL_MS;
}

export function candleTipMaxAgeMs(_id: CandleIntervalId): number {
  return CANDLE_LIVE_POLL_MS;
}

export function isCandleInterval(id: string): id is CandleIntervalId {
  return CANDLE_RANGES.some((r) => r.id === id);
}
