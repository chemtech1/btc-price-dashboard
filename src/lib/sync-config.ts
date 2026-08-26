import type { RangeId } from "./ranges";
import { getRange } from "./ranges";

/** On-demand freshness (API requests while the UI is open). */
export const EUR_PAIRS_TTL_MS = 60 * 60 * 1000;
/** Short enough for 5m/15m live polling (~1s) without hammering Binance via DB reuse. */
export const TICKER_TTL_MS = 1_000;

/** UI ranges that should poll price + chart about once per second. */
export const LIVE_RANGE_IDS = ["5m", "15m"] as const;
export const LIVE_POLL_MS = 1_000;
export const DEFAULT_PRICE_POLL_MS = 60_000;

export function isLiveRange(range: RangeId): boolean {
  return (LIVE_RANGE_IDS as readonly string[]).includes(range);
}

/** Client chart/price poll interval aligned with candle freshness (`cacheSeconds`). */
export function chartPollMs(rangeId: RangeId): number {
  if (isLiveRange(rangeId)) return LIVE_POLL_MS;
  const range = getRange(rangeId);
  if (!range) return DEFAULT_PRICE_POLL_MS;
  // At least 15s for longer ranges so the tip still moves while the tab is open
  return Math.max(range.cacheSeconds, 15) * 1000;
}

/** Background job cadence (instrumentation tick stays at 60s; work is staggered). */
export const BG_TICK_MS = 60_000;
export const BG_HISTORY_EVERY_MS = 15 * 60 * 1000;
export const BG_PRUNE_EVERY_MS = 60 * 60 * 1000;

/** How long to keep klines per candle interval (not UI range id). */
export const KLINE_RETENTION_MS: Record<string, number> = {
  "1s": 2 * 60 * 60 * 1000, // 2 hours (line-chart live ranges)
  "1m": 2 * 24 * 60 * 60 * 1000, // 2 days
  "5m": 2 * 24 * 60 * 60 * 1000,
  "15m": 3 * 24 * 60 * 60 * 1000,
  "30m": 5 * 24 * 60 * 60 * 1000,
  "1h": 21 * 24 * 60 * 60 * 1000, // 5h window needs ~2 weeks of 1h
  "4h": 365 * 24 * 60 * 60 * 1000,
  // "1d" / "1w" / "1M" unlimited — omitted on purpose
};

export const INTERVAL_MS: Record<string, number> = {
  "1s": 1_000,
  "1m": 60_000,
  "5m": 5 * 60_000,
  "15m": 15 * 60_000,
  "30m": 30 * 60_000,
  "1h": 60 * 60_000,
  "4h": 4 * 60 * 60_000,
  "5h": 5 * 60 * 60_000,
  "1d": 24 * 60 * 60_000,
  "1w": 7 * 24 * 60 * 60_000,
  "1M": 30 * 24 * 60 * 60_000,
};

export const META_BG_HISTORY_AT = "bg_history_at";
export const META_BG_PRUNE_AT = "bg_prune_at";
