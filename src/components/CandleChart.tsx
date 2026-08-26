"use client";

import { useEffect, useRef, useState } from "react";
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
import { formatCandleTooltipTime, formatEur } from "../lib/format";
import type { CandlePoint } from "../lib/types";

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
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const [hover, setHover] = useState<CandlePoint | null>(null);

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
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
      },
      localization: {
        locale: "de-DE",
        priceFormatter: (price: number) => formatEur(price, true),
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

    return () => {
      chart.unsubscribeCrosshairMove(onMove);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    series.setData(toSeries(candles));
    requestAnimationFrame(() => {
      chart.timeScale().fitContent();
    });
    setHover(null);
  }, [candles]);

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
      <div ref={hostRef} className="h-full w-full" />
    </div>
  );
}
