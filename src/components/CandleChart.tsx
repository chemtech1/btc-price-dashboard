"use client";

import {
  Bar,
  BarChart,
  Cell,
  ErrorBar,
  CartesianGrid,
  Rectangle,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CandleIntervalId } from "../lib/candle-ranges";
import { formatAxisPrice, formatCandleTick, formatCandleTooltipTime, formatEur } from "../lib/format";
import type { CandlePoint } from "../lib/types";
import { useNarrow } from "../lib/use-narrow";

type Props = {
  candles: CandlePoint[];
  intervalId: CandleIntervalId;
  loading: boolean;
  error: string | null;
};

type CandleRow = CandlePoint & {
  body: [number, number];
  wick: [number, number];
  bullish: boolean;
};

function toRows(candles: CandlePoint[], priceEps: number): CandleRow[] {
  return candles.map((c) => {
    let bodyLow = Math.min(c.open, c.close);
    let bodyHigh = Math.max(c.open, c.close);
    // Doji / flat: give the body a tiny value range so Recharts renders a visible bar
    if (bodyHigh - bodyLow < priceEps) {
      const mid = (bodyLow + bodyHigh) / 2;
      bodyLow = mid - priceEps / 2;
      bodyHigh = mid + priceEps / 2;
    }
    return {
      ...c,
      body: [bodyLow, bodyHigh],
      // ErrorBar offsets from the top of the body (bodyHigh)
      wick: [bodyHigh - c.low, c.high - bodyHigh],
      bullish: c.close >= c.open,
    };
  });
}

function CandleTooltip({
  active,
  payload,
  intervalId,
}: {
  active?: boolean;
  payload?: Array<{ payload: CandleRow }>;
  intervalId: CandleIntervalId;
}) {
  if (!active || !payload?.[0]) return null;
  const c = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/95 px-3 py-2 text-sm shadow-xl">
      <p className="text-zinc-400">{formatCandleTooltipTime(c.t, intervalId)}</p>
      <p className="text-zinc-300">O {formatEur(c.open)}</p>
      <p className="text-zinc-300">H {formatEur(c.high)}</p>
      <p className="text-zinc-300">L {formatEur(c.low)}</p>
      <p className={`font-semibold ${c.bullish ? "text-emerald-400" : "text-rose-400"}`}>
        C {formatEur(c.close)}
      </p>
    </div>
  );
}

function CandleBody(props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: CandleRow;
}) {
  const color = props.payload?.bullish ? "#34d399" : "#fb7185";
  return (
    <Rectangle
      x={props.x}
      y={props.y}
      width={props.width}
      height={Math.max(props.height ?? 0, 2)}
      fill={color}
      stroke={color}
    />
  );
}

export function CandleChart({ candles, intervalId, loading, error }: Props) {
  const narrow = useNarrow();

  if (error) {
    return (
      <div className="flex h-[55vh] min-h-64 max-h-[28rem] items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/5 px-4 text-center text-rose-300 sm:h-96">
        {error}
      </div>
    );
  }

  if (loading && candles.length === 0) {
    return (
      <div className="flex h-[55vh] min-h-64 max-h-[28rem] items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400 sm:h-96">
        Kerzen werden geladen…
      </div>
    );
  }

  if (candles.length === 0) {
    return (
      <div className="flex h-[55vh] min-h-64 max-h-[28rem] items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400 sm:h-96">
        Keine Kerzendaten für dieses Intervall.
      </div>
    );
  }

  const lows = candles.map((c) => c.low);
  const highs = candles.map((c) => c.high);
  const min = Math.min(...lows);
  const max = Math.max(...highs);
  const span = max - min || max * 0.01 || 1;
  const pad = span * 0.08;
  const priceEps = span * 0.004;
  const rows = toRows(candles, priceEps);

  return (
    <div className="h-[55vh] min-h-64 max-h-[28rem] w-full rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-1.5 sm:h-96 sm:p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={rows}
          margin={{ top: 8, right: 4, left: narrow ? 0 : 4, bottom: 0 }}
        >
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="t"
            tickFormatter={(t) => formatCandleTick(Number(t), intervalId)}
            stroke="#71717a"
            tick={{ fill: "#a1a1aa", fontSize: 11 }}
            minTickGap={36}
          />
          <YAxis
            domain={[min - pad, max + pad]}
            tickFormatter={(v) =>
              narrow ? formatAxisPrice(Number(v)) : formatEur(Number(v), true)
            }
            width={narrow ? 32 : 88}
            mirror={narrow}
            axisLine={!narrow}
            tickLine={!narrow}
            stroke="#71717a"
            tick={{ fill: "#a1a1aa", fontSize: narrow ? 10 : 11 }}
          />
          <Tooltip
            content={<CandleTooltip intervalId={intervalId} />}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Bar
            dataKey={(entry: CandleRow) => entry.body}
            isAnimationActive={false}
            maxBarSize={14}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            shape={(props: any) => <CandleBody {...props} />}
          >
            {rows.map((row) => (
              <Cell key={row.t} fill={row.bullish ? "#34d399" : "#fb7185"} />
            ))}
            <ErrorBar
              dataKey={(entry: CandleRow) => entry.wick}
              width={1}
              strokeWidth={1.5}
              stroke="#a1a1aa"
              direction="y"
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
