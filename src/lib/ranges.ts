export type RangeId = "5m" | "15m" | "1h" | "1d" | "7d" | "30d" | "180d" | "365d" | "max";

export type KlineInterval = "1s" | "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export type RangeConfig = {
  id: RangeId;
  label: string;
  interval: KlineInterval;
  /** Max candles to fetch (Binance limit 1000 per request) */
  limit: number;
  /** For "max": paginate up to this many pages of daily candles */
  maxPages?: number;
  cacheSeconds: number;
};

export const RANGES: RangeConfig[] = [
  { id: "5m", label: "5 Min", interval: "1s", limit: 300, cacheSeconds: 0 },
  { id: "15m", label: "15 Min", interval: "1s", limit: 900, cacheSeconds: 0 },
  { id: "1h", label: "1 Std", interval: "1m", limit: 60, cacheSeconds: 30 },
  { id: "1d", label: "Tag", interval: "5m", limit: 288, cacheSeconds: 60 },
  { id: "7d", label: "Woche", interval: "1h", limit: 168, cacheSeconds: 120 },
  { id: "30d", label: "Monat", interval: "1h", limit: 720, cacheSeconds: 180 },
  { id: "180d", label: "6 Mon", interval: "4h", limit: 1080, cacheSeconds: 300 },
  { id: "365d", label: "Jahr", interval: "1d", limit: 365, cacheSeconds: 600 },
  { id: "max", label: "Alles", interval: "1d", limit: 1000, maxPages: 8, cacheSeconds: 900 },
];

export function getRange(id: string): RangeConfig | undefined {
  return RANGES.find((r) => r.id === id);
}
