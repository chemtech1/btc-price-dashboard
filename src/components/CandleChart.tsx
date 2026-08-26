"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  createChart,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { CandleIntervalId } from "../lib/candle-ranges";
import { formatAxisPrice, formatCandleTooltipTime, formatEur } from "../lib/format";
import type { CandlePoint } from "../lib/types";
import { useNarrow } from "../lib/use-narrow";

type Props = {
  candles: CandlePoint[];
  intervalId: CandleIntervalId;
  loading: boolean;
  error: string | null;
};

const UP = "#26a69a";
const DOWN = "#ef5350";
const TEXT = "#a1a1aa";
const GRID = "rgba(255,255,255,0.06)";

type AxisTick = { price: number; y: number };

function makeTicks(min: number, max: number, count: number): number[] {
  const span = max - min || Math.abs(max) * 0.01 || 1;
  const lo = min - span * 0.08;
  const hi = max + span * 0.08;
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step =
    ([1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw) || 1;
  const start = Math.ceil(lo / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= hi + step * 0.001; v += step) {
    ticks.push(v);
  }
  return ticks;
}

function toSeries(candles: CandlePoint[]): CandlestickData<Time>[] {
  const out: CandlestickData<Time>[] = [];
  let lastTime = -1;
  for (const c of candles) {
    const time = Math.floor(c.t / 1000) as UTCTimestamp;
    if (time <= lastTime) continue;
    lastTime = time;
    out.push({
      time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    });
  }
  return out;
}

export function CandleChart({ candles, intervalId, loading, error }: Props) {
  const narrow = useNarrow();
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const candlesRef = useRef(candles);
  candlesRef.current = candles;

  const [hover, setHover] = useState<CandlePoint | null>(null);
  const [ticks, setTicks] = useState<AxisTick[]>([]);
  const [lastMark, setLastMark] = useState<{
    y: number;
    price: number;
    bullish: boolean;
  } | null>(null);

  const syncOverlay = useCallback(() => {
    const series = seriesRef.current;
    const data = candlesRef.current;
    if (!series || data.length === 0) {
      setTicks([]);
      setLastMark(null);
      return;
    }
    const min = Math.min(...data.map((c) => c.low));
    const max = Math.max(...data.map((c) => c.high));
    const nextTicks: AxisTick[] = [];
    for (const price of makeTicks(min, max, 5)) {
      const y = series.priceToCoordinate(price);
      if (y == null || !Number.isFinite(y)) continue;
      nextTicks.push({ price, y });
    }
    setTicks(nextTicks);
    const last = data[data.length - 1];
    const y = series.priceToCoordinate(last.close);
    if (y == null || !Number.isFinite(y)) {
      setLastMark(null);
      return;
    }
    setLastMark({
      y,
      price: last.close,
      bullish: last.close >= last.open,
    });
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const chart = createChart(host, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: TEXT,
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        attributionLogo: false,
        fontSize: 10,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: GRID },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "rgba(255,255,255,0.25)", width: 1 },
        horzLine: { color: "rgba(255,255,255,0.25)", width: 1 },
      },
      leftPriceScale: { visible: false, borderVisible: false },
      rightPriceScale: { visible: false, borderVisible: false },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
      },
      localization: {
        locale: "de-DE",
        priceFormatter: (price: number) => formatAxisPrice(price),
      },
      handleScroll: false,
      handleScale: false,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceScaleId: "",
      lastValueVisible: false,
      priceLineVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;

    const onMove = (param: MouseEventParams<Time>) => {
      const raw = param.seriesData.get(series) as
        | CandlestickData<Time>
        | undefined;
      if (!raw || typeof raw.time !== "number") {
        setHover(null);
        return;
      }
      setHover({
        t: raw.time * 1000,
        open: raw.open,
        high: raw.high,
        low: raw.low,
        close: raw.close,
        volume: 0,
      });
    };

    chart.subscribeCrosshairMove(onMove);

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(syncOverlay);
    });
    ro.observe(host);

    return () => {
      ro.disconnect();
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [syncOverlay]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    series.setData(toSeries(candles));
    requestAnimationFrame(() => {
      chart.timeScale().fitContent();
      requestAnimationFrame(syncOverlay);
    });
    setHover(null);
  }, [candles, syncOverlay]);

  const shown = hover ?? candles[candles.length - 1];
  const bullish = shown ? shown.close >= shown.open : false;
  const showStatus = Boolean(error) || (loading && candles.length === 0) || candles.length === 0;

  return (
    <div className="relative h-[55vh] min-h-64 max-h-[28rem] w-full rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-1.5 sm:h-96 sm:p-4">
      {shown && !showStatus && (
        <p className="pointer-events-none absolute left-3 top-3 z-10 max-w-[calc(100%-5rem)] truncate text-[11px] text-zinc-400 sm:left-6 sm:top-5 sm:text-xs">
          <span className="text-zinc-500">
            {formatCandleTooltipTime(shown.t, intervalId)}
          </span>{" "}
          <span className="text-zinc-500">O</span> {formatEur(shown.open)}{" "}
          <span className="text-zinc-500">H</span> {formatEur(shown.high)}{" "}
          <span className="text-zinc-500">L</span> {formatEur(shown.low)}{" "}
          <span className={bullish ? "text-teal-400" : "text-red-400"}>
            C {formatEur(shown.close)}
          </span>
        </p>
      )}
      {error ? (
        <p className="absolute inset-0 z-20 flex items-center justify-center px-4 text-center text-rose-300">
          {error}
        </p>
      ) : loading && candles.length === 0 ? (
        <p className="absolute inset-0 z-20 flex items-center justify-center text-zinc-400">
          Kerzen werden geladen…
        </p>
      ) : candles.length === 0 ? (
        <p className="absolute inset-0 z-20 flex items-center justify-center text-zinc-400">
          Keine Kerzendaten für dieses Intervall.
        </p>
      ) : null}
      <div className="relative h-full w-full">
        <div ref={hostRef} className="h-full w-full" />
        {!showStatus && (
          <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
            {ticks.map((tick) => (
              <span
                key={tick.price}
                className="absolute left-1 -translate-y-1/2 text-[10px] text-zinc-400 sm:left-2 sm:text-[11px]"
                style={{
                  top: tick.y,
                  textShadow: "0 1px 2px rgba(0,0,0,0.85)",
                }}
              >
                {formatAxisPrice(tick.price)}
              </span>
            ))}
            {lastMark && (
              <>
                <div
                  className="absolute right-0 left-0 border-t border-dashed opacity-70"
                  style={{
                    top: lastMark.y,
                    borderColor: lastMark.bullish ? UP : DOWN,
                  }}
                />
                <span
                  className="absolute left-1 -translate-y-1/2 rounded px-1 py-0.5 text-[10px] font-medium text-black sm:left-2 sm:text-[11px]"
                  style={{
                    top: lastMark.y,
                    background: lastMark.bullish ? UP : DOWN,
                  }}
                >
                  {narrow
                    ? formatAxisPrice(lastMark.price)
                    : formatEur(lastMark.price, true)}
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
