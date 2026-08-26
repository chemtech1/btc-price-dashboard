"use client";

import { formatEur, formatPercent, formatUsd } from "../lib/format";
import type { CoinPrice } from "../lib/types";

type Props = {
  coin: CoinPrice | null;
  loading: boolean;
};

export function PriceHeader({ coin, loading }: Props) {
  if (loading && !coin) {
    return (
      <div className="animate-pulse space-y-2 sm:space-y-3">
        <div className="h-5 w-32 rounded bg-white/10 sm:w-40" />
        <div className="h-10 w-48 rounded bg-white/10 sm:h-12 sm:w-64" />
        <div className="h-4 w-40 rounded bg-white/10 sm:w-48" />
      </div>
    );
  }

  if (!coin) {
    return <p className="text-zinc-400">Keine Preisdaten verfügbar.</p>;
  }

  const up = coin.price_change_percentage_24h >= 0;
  const updated = coin.last_updated
    ? new Date(coin.last_updated).toLocaleString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "–";

  return (
    <div className="space-y-1.5 sm:space-y-2">
      <div className="flex items-center gap-2.5 sm:gap-3">
        {coin.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coin.image} alt="" className="h-8 w-8 rounded-full sm:h-10 sm:w-10" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[10px] uppercase text-zinc-300 sm:h-10 sm:w-10 sm:text-xs">
            {coin.symbol.slice(0, 3)}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-white sm:text-2xl">{coin.name}</h1>
          <p className="text-xs uppercase tracking-wide text-zinc-400 sm:text-sm">{coin.symbol}</p>
        </div>
      </div>

      <p className="text-3xl font-bold tracking-tight text-white tabular-nums sm:text-5xl">
        {formatEur(coin.current_price)}
        {coin.current_price_usd != null && (
          <span className="ml-2 text-lg font-normal text-zinc-400 sm:text-2xl">
            ({formatUsd(coin.current_price_usd)})
          </span>
        )}
      </p>

      <div className="flex flex-col gap-1 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
        <span className={up ? "text-emerald-400" : "text-rose-400"}>
          {up ? "▲" : "▼"} {formatEur(coin.price_change_24h)} (
          {formatPercent(coin.price_change_percentage_24h)}) · 24 Std
        </span>
        <span className="text-xs text-zinc-500 sm:text-sm">Aktualisiert: {updated}</span>
      </div>
    </div>
  );
}
