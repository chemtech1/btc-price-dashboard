import type { CandlePoint } from "./types";

/** Merge finer OHLC candles into coarser buckets (e.g. 1s → 10s). */
export function aggregateOhlc(
  candles: CandlePoint[],
  bucketMs: number,
): CandlePoint[] {
  if (candles.length === 0 || bucketMs <= 0) return [];

  const buckets = new Map<number, CandlePoint>();

  for (const c of candles) {
    const t = Math.floor(c.t / bucketMs) * bucketMs;
    const existing = buckets.get(t);
    if (!existing) {
      buckets.set(t, {
        t,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      });
      continue;
    }
    existing.high = Math.max(existing.high, c.high);
    existing.low = Math.min(existing.low, c.low);
    existing.close = c.close;
    existing.volume += c.volume;
  }

  const aggregated = [...buckets.values()].sort((a, b) => a.t - b.t);
  return fillCandleGaps(aggregated, bucketMs);
}

/** Insert flat placeholder candles so the series has no time holes. */
export function fillCandleGaps(
  candles: CandlePoint[],
  intervalMs: number,
): CandlePoint[] {
  if (candles.length < 2 || intervalMs <= 0) return candles;

  const out: CandlePoint[] = [candles[0]];
  for (let i = 1; i < candles.length; i++) {
    let prev = out[out.length - 1];
    let nextT = prev.t + intervalMs;
    while (nextT < candles[i].t) {
      const flat: CandlePoint = {
        t: nextT,
        open: prev.close,
        high: prev.close,
        low: prev.close,
        close: prev.close,
        volume: 0,
      };
      out.push(flat);
      prev = flat;
      nextT += intervalMs;
    }
    out.push(candles[i]);
  }
  return out;
}
