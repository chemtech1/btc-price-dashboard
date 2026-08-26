"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatAxisPrice, formatChartTick, formatEur, formatTooltipTime } from "../lib/format";
import type { HistoryPoint } from "../lib/types";
import type { RangeId } from "../lib/ranges";
import { useNarrow } from "../lib/use-narrow";

type Props = {
  points: HistoryPoint[];
  rangeId: RangeId;
  loading: boolean;
  error: string | null;
};

function ChartTooltip({
  active,
  payload,
  rangeId,
}: {
  active?: boolean;
  payload?: Array<{ payload: HistoryPoint }>;
  rangeId: RangeId;
}) {
  if (!active || !payload?.[0]) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/95 px-3 py-2 text-sm shadow-xl">
      <p className="text-zinc-400">{formatTooltipTime(point.t, rangeId)}</p>
      <p className="font-semibold text-white">{formatEur(point.price)}</p>
    </div>
  );
}

export function PriceChart({ points, rangeId, loading, error }: Props) {
  const narrow = useNarrow();

  if (error) {
    return (
      <div className="flex h-[55vh] min-h-64 max-h-[28rem] items-center justify-center rounded-2xl border border-rose-500/30 bg-rose-500/5 px-4 text-center text-rose-300 sm:h-96">
        {error}
      </div>
    );
  }

  if (loading && points.length === 0) {
    return (
      <div className="flex h-[55vh] min-h-64 max-h-[28rem] items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400 sm:h-96">
        Chart wird geladen…
      </div>
    );
  }

  if (points.length === 0) {
    return (
      <div className="flex h-[55vh] min-h-64 max-h-[28rem] items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-zinc-400 sm:h-96">
        Keine Verlaufsdaten für diesen Zeitraum.
      </div>
    );
  }

  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = (max - min) * 0.08 || max * 0.01;

  return (
    <div className="h-[55vh] min-h-64 max-h-[28rem] w-full select-none rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-transparent p-1.5 outline-none touch-manipulation [-webkit-tap-highlight-color:transparent] sm:h-96 sm:p-4">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          accessibilityLayer={false}
          data={points}
          margin={{ top: 8, right: 4, left: narrow ? 0 : 4, bottom: 0 }}
        >
          <defs>
            <linearGradient id="priceFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f97316" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(t) => formatChartTick(Number(t), rangeId)}
            stroke="#71717a"
            tick={{ fill: "#a1a1aa", fontSize: 12 }}
            minTickGap={40}
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
            cursor={{ stroke: "rgba(255,255,255,0.2)", strokeWidth: 1 }}
            wrapperStyle={{
              background: "transparent",
              border: "none",
              outline: "none",
              boxShadow: "none",
            }}
            content={<ChartTooltip rangeId={rangeId} />}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#f97316"
            strokeWidth={2}
            fill="url(#priceFill)"
            isAnimationActive={false}
            activeDot={{ r: 4 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
