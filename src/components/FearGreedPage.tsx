"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAxisPrice, formatEur } from "../lib/format";
import { fngColor, type FngPoint } from "../lib/fng";
import type { CandlePoint } from "../lib/types";
import { useNarrow } from "../lib/use-narrow";
import { SiteNav } from "./SiteNav";

type ChartRow = FngPoint & { btc?: number };

function utcDay(t: number): number {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function mergeBtc(fng: FngPoint[], candles: CandlePoint[]): ChartRow[] {
  const byDay = new Map<number, number>();
  for (const c of candles) {
    byDay.set(utcDay(c.t), c.close);
  }
  const days = [...byDay.keys()].sort((a, b) => a - b);
  return fng.map((p) => {
    const day = utcDay(p.t);
    let btc = byDay.get(day);
    if (btc == null) {
      const prev = days.filter((d) => d <= day).at(-1);
      if (prev != null) btc = byDay.get(prev);
    }
    return { ...p, btc };
  });
}

export function FearGreedPage() {
  const narrow = useNarrow();
  const [latest, setLatest] = useState<FngPoint | null>(null);
  const [points, setPoints] = useState<FngPoint[]>([]);
  const [btcCandles, setBtcCandles] = useState<CandlePoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [fngRes, btcRes] = await Promise.all([
          fetch("/api/fng", { cache: "no-store" }),
          fetch("/api/history?id=BTCEUR&interval=1d", { cache: "no-store" }),
        ]);
        const fngData = await fngRes.json();
        if (!fngRes.ok) {
          throw new Error(fngData.error || "Index konnte nicht geladen werden");
        }
        let candles: CandlePoint[] = [];
        if (btcRes.ok) {
          const btcData = await btcRes.json();
          candles = Array.isArray(btcData.candles) ? btcData.candles : [];
        }
        if (cancelled) return;
        setLatest(fngData.latest ?? null);
        setPoints(Array.isArray(fngData.points) ? fngData.points : []);
        setBtcCandles(candles);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Index konnte nicht geladen werden");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const chartRows = useMemo(
    () => mergeBtc(points, btcCandles),
    [points, btcCandles],
  );
  const hasBtc = chartRows.some((r) => r.btc != null);
  const btcDomain = useMemo((): [number, number] | undefined => {
    const prices = chartRows
      .map((r) => r.btc)
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (prices.length === 0) return undefined;
    const minBtc = Math.min(...prices);
    const maxBtc = Math.max(...prices);
    const span = maxBtc - minBtc || Math.abs(maxBtc) * 0.02 || 1;
    const pad = span / 18;
    return [minBtc - pad, maxBtc + pad];
  }, [chartRows]);

  const value = latest?.value ?? 0;
  const color = fngColor(value);
  const updated = latest
    ? new Date(latest.t).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : null;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-4 px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-6 sm:px-6 sm:py-8">
      <header className="flex items-center justify-between gap-3">
        <SiteNav />
        <p className="text-xs text-zinc-500 sm:text-sm">Fear &amp; Greed</p>
      </header>

      <section className="rounded-3xl border border-white/10 bg-zinc-900/40 p-6 sm:p-8">
        {error ? (
          <p className="text-rose-400">{error}</p>
        ) : loading && !latest ? (
          <p className="text-zinc-400">Index wird geladen…</p>
        ) : latest ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
              Heute
            </p>
            <p className="text-7xl font-semibold tabular-nums sm:text-8xl" style={{ color }}>
              {latest.value}
            </p>
            <p className="text-xl font-medium" style={{ color }}>
              {latest.labelDe}
            </p>
            <div className="relative mt-2 h-3 w-full max-w-md overflow-hidden rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-400">
              <span
                className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-zinc-950 shadow"
                style={{ left: `${value}%` }}
              />
            </div>
            {updated && (
              <p className="text-xs text-zinc-500">Stand {updated}</p>
            )}
          </div>
        ) : (
          <p className="text-zinc-400">Keine Daten.</p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400 sm:text-sm">
            30 Tage
          </h2>
          <p className="text-[11px] text-zinc-500 sm:text-xs">
            <span className="text-orange-400">■</span> Stimmung
            {hasBtc && (
              <>
                {" "}
                <span className="text-zinc-200">—</span> BTC
              </>
            )}
          </p>
        </div>
        <div className="h-64 w-full select-none rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-2 outline-none touch-manipulation [-webkit-tap-highlight-color:transparent] sm:h-80 sm:p-4">
          {chartRows.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartRows}
                margin={{ top: 8, right: narrow ? 4 : 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="t"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(t) =>
                    new Date(Number(t)).toLocaleDateString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                    })
                  }
                  stroke="#71717a"
                  tick={{ fill: "#a1a1aa", fontSize: 11 }}
                  minTickGap={28}
                />
                <YAxis
                  yAxisId="fng"
                  domain={[0, 100]}
                  width={28}
                  stroke="#71717a"
                  tick={{ fill: "#a1a1aa", fontSize: 10 }}
                />
                {hasBtc && btcDomain && (
                  <YAxis
                    yAxisId="btc"
                    orientation="right"
                    domain={btcDomain}
                    tickFormatter={(v) =>
                      narrow ? formatAxisPrice(Number(v)) : formatEur(Number(v), true)
                    }
                    width={narrow ? 36 : 72}
                    stroke="#a1a1aa"
                    tick={{ fill: "#d4d4d8", fontSize: 10 }}
                  />
                )}
                <Tooltip
                  cursor={{ fill: "transparent" }}
                  wrapperStyle={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    boxShadow: "none",
                  }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const p = payload[0].payload as ChartRow;
                    return (
                      <div className="rounded-lg border border-white/10 bg-zinc-900/95 px-3 py-2 text-sm">
                        <p className="text-zinc-400">
                          {new Date(p.t).toLocaleDateString("de-DE")}
                        </p>
                        <p className="font-semibold" style={{ color: fngColor(p.value) }}>
                          {p.value} · {p.labelDe}
                        </p>
                        {p.btc != null && (
                          <p className="text-zinc-200">BTC {formatEur(p.btc)}</p>
                        )}
                      </div>
                    );
                  }}
                />
                <Area
                  yAxisId="fng"
                  type="monotone"
                  dataKey="value"
                  name="Stimmung"
                  stroke="#f97316"
                  strokeWidth={2}
                  fill="rgba(249,115,22,0.2)"
                  isAnimationActive={false}
                />
                {hasBtc && (
                  <Line
                    yAxisId="btc"
                    type="monotone"
                    dataKey="btc"
                    name="BTC"
                    stroke="#e4e4e7"
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    isAnimationActive={false}
                  />
                )}
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-500">
              {loading ? "…" : "Kein Verlauf"}
            </div>
          )}
        </div>
      </section>

      <p className="text-xs leading-relaxed text-zinc-500">
        Stimmung des Krypto-Marktes (0–100), stark an Bitcoin gekoppelt. BTC-Linie:
        Tages-Schluss in EUR (Binance). Kein Kauf- oder Verkaufssignal. Index:{" "}
        <a
          href="https://alternative.me/crypto/fear-and-greed-index/"
          className="text-zinc-400 underline decoration-white/20 underline-offset-2 hover:text-white"
          target="_blank"
          rel="noreferrer"
        >
          alternative.me
        </a>
        .
      </p>
    </div>
  );
}
