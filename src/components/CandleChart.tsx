"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  CANDLE_LIMIT_MOBILE,
  type CandleIntervalId,
} from "../lib/candle-ranges";
import {
  formatAxisPrice,
  formatCandleTooltipTime,
  formatEur,
  formatVolume,
} from "../lib/format";
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
const HAIR = "#60a5fa";

type AxisTick = { price: number; y: number };
type Tip = { candle: CandlePoint; x: number; y: number };

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

function toVolumeSeries(candles: CandlePoint[]): HistogramData<Time>[] {
  const out: HistogramData<Time>[] = [];
  let lastTime = -1;
  for (const c of candles) {
    const time = Math.floor(c.t / 1000) as UTCTimestamp;
    if (time <= lastTime) continue;
    lastTime = time;
    out.push({
      time,
      value: c.volume,
      color: c.close >= c.open ? `${UP}99` : `${DOWN}99`,
    });
  }
  return out;
}

function barFromParam(
  param: MouseEventParams<Time>,
  series: ISeriesApi<"Candlestick">,
  candles: CandlePoint[],
): CandlePoint | null {
  const raw = param.seriesData.get(series) as CandlestickData<Time> | undefined;
  if (!raw || typeof raw.time !== "number") return null;
  const t = raw.time * 1000;
  const vol = candles.find((c) => c.t === t)?.volume ?? 0;
  return {
    t,
    open: raw.open,
    high: raw.high,
    low: raw.low,
    close: raw.close,
    volume: vol,
  };
}

function CandleTipBox({
  tip,
  intervalId,
  hostWidth,
}: {
  tip: Tip;
  intervalId: CandleIntervalId;
  hostWidth: number;
}) {
  const c = tip.candle;
  const up = c.close >= c.open;
  const boxW = 184;
  let left = tip.x + 12;
  if (left + boxW > hostWidth - 8) left = Math.max(8, tip.x - boxW - 8);
  const top = Math.max(8, tip.y - 72);
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[11.5rem] rounded-lg border border-white/15 bg-zinc-900/95 px-3 py-2 text-xs shadow-xl"
      style={{ left, top }}
    >
      <p className="mb-1 text-zinc-400">{formatCandleTooltipTime(c.t, intervalId)}</p>
      <p className="flex justify-between gap-4 text-zinc-300">
        <span>Eröffn.</span>
        <span>{formatEur(c.open)}</span>
      </p>
      <p className="flex justify-between gap-4 text-zinc-300">
        <span>Hoch</span>
        <span>{formatEur(c.high)}</span>
      </p>
      <p className="flex justify-between gap-4 text-zinc-300">
        <span>Tief</span>
        <span>{formatEur(c.low)}</span>
      </p>
      <p
        className={`flex justify-between gap-4 font-medium ${up ? "text-teal-400" : "text-red-400"}`}
      >
        <span>Schließen</span>
        <span>{formatEur(c.close)}</span>
      </p>
      <p className="flex justify-between gap-4 text-zinc-300">
        <span>Volumen</span>
        <span>{formatVolume(c.volume)}</span>
      </p>
    </div>
  );
}

export function CandleChart({ candles, intervalId, loading, error }: Props) {
  const narrow = useNarrow();
  const visible = useMemo(
    () => (narrow ? candles.slice(-CANDLE_LIMIT_MOBILE) : candles),
    [candles, narrow],
  );

  const wrapRef = useRef<HTMLDivElement>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  const candlesRef = useRef(visible);
  candlesRef.current = visible;
  const pinnedRef = useRef(false);
  const tipRef = useRef<Tip | null>(null);

  const [tip, setTip] = useState<Tip | null>(null);
  const [ticks, setTicks] = useState<AxisTick[]>([]);
  const [lastMark, setLastMark] = useState<{
    y: number;
    price: number;
    bullish: boolean;
  } | null>(null);

  tipRef.current = tip;

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
        mode: CrosshairMode.MagnetOHLC,
        vertLine: {
          color: HAIR,
          width: 1,
          style: LineStyle.Dashed,
          labelVisible: false,
        },
        horzLine: {
          color: HAIR,
          width: 1,
          style: LineStyle.Dashed,
          labelVisible: false,
        },
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
    series.priceScale().applyOptions({
      scaleMargins: { top: 0.08, bottom: 0.24 },
    });

    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: "volume",
      lastValueVisible: false,
      priceLineVisible: false,
    });
    volume.priceScale().applyOptions({
      scaleMargins: { top: 0.78, bottom: 0 },
      borderVisible: false,
    });

    chartRef.current = chart;
    seriesRef.current = series;
    volumeRef.current = volume;

    const onMove = (param: MouseEventParams<Time>) => {
      if (pinnedRef.current) return;
      const bar = barFromParam(param, series, candlesRef.current);
      if (!bar || !param.point) {
        setTip(null);
        return;
      }
      setTip({ candle: bar, x: param.point.x, y: param.point.y });
    };

    const onClick = (param: MouseEventParams<Time>) => {
      const bar = barFromParam(param, series, candlesRef.current);
      if (!bar || !param.point) {
        pinnedRef.current = false;
        setTip(null);
        chart.clearCrosshairPosition();
        return;
      }
      if (pinnedRef.current && tipRef.current?.candle.t === bar.t) {
        pinnedRef.current = false;
        setTip(null);
        chart.clearCrosshairPosition();
        return;
      }
      pinnedRef.current = true;
      setTip({ candle: bar, x: param.point.x, y: param.point.y });
      chart.setCrosshairPosition(
        bar.close,
        Math.floor(bar.t / 1000) as UTCTimestamp,
        series,
      );
    };

    chart.subscribeCrosshairMove(onMove);
    chart.subscribeClick(onClick);

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(syncOverlay);
    });
    ro.observe(host);

    const dismissIfOutside = (e: PointerEvent) => {
      const root = wrapRef.current;
      if (!root || root.contains(e.target as Node)) return;
      pinnedRef.current = false;
      setTip(null);
      chart.clearCrosshairPosition();
    };
    document.addEventListener("pointerdown", dismissIfOutside, true);

    return () => {
      document.removeEventListener("pointerdown", dismissIfOutside, true);
      ro.disconnect();
      chart.unsubscribeCrosshairMove(onMove);
      chart.unsubscribeClick(onClick);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      volumeRef.current = null;
    };
  }, [syncOverlay]);

  useEffect(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series || !chart) return;
    series.setData(toSeries(visible));
    volumeRef.current?.setData(toVolumeSeries(visible));
    if (!pinnedRef.current) {
      setTip(null);
    }
    requestAnimationFrame(() => {
      chart.timeScale().fitContent();
      requestAnimationFrame(() => {
        syncOverlay();
        if (!pinnedRef.current || !tipRef.current) return;
        const prev = tipRef.current;
        const updated = visible.find((c) => c.t === prev.candle.t);
        if (!updated) {
          pinnedRef.current = false;
          setTip(null);
          chart.clearCrosshairPosition();
          return;
        }
        setTip({ ...prev, candle: updated });
        chart.setCrosshairPosition(
          updated.close,
          Math.floor(updated.t / 1000) as UTCTimestamp,
          series,
        );
      });
    });
  }, [visible, syncOverlay]);

  const showStatus =
    Boolean(error) || (loading && candles.length === 0) || candles.length === 0;

  return (
    <div
      ref={wrapRef}
      className="relative h-[58vh] min-h-64 max-h-[32rem] w-full select-none rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-1.5 outline-none touch-manipulation [-webkit-tap-highlight-color:transparent] sm:h-[26rem] sm:p-4"
    >
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
        {!showStatus && tip && (
          <CandleTipBox
            tip={tip}
            intervalId={intervalId}
            hostWidth={hostRef.current?.clientWidth ?? 320}
          />
        )}
      </div>
    </div>
  );
}
