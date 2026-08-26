"use client";

import { useEffect, useMemo, useState } from "react";
import { formatEur, formatPercent } from "../lib/format";
import type { CoinPrice, SearchResult, WatchedCoin } from "../lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  watchlist: WatchedCoin[];
  activeId: string;
  prices: Record<string, CoinPrice>;
  onSelect: (id: string) => void;
  onAdd: (coin: WatchedCoin) => void;
  onRemove: (id: string) => void;
};

export function CoinMenu({
  open,
  onClose,
  watchlist,
  activeId,
  prices,
  onSelect,
  onAdd,
  onRemove,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const watchedIds = useMemo(() => new Set(watchlist.map((c) => c.id)), [watchlist]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearchError(null);
      setSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Suche fehlgeschlagen");
        setResults(data.results ?? []);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setSearchError(err instanceof Error ? err.message : "Suche fehlgeschlagen");
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query, open]);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Menü schließen"
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 left-0 z-50 flex w-full max-w-md flex-col border-r border-white/10 bg-zinc-950 pt-[env(safe-area-inset-top)] shadow-2xl sm:w-[min(100%,22rem)]">
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 sm:py-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Meine Coins</h2>
            <p className="text-xs text-zinc-400">Nur Binance-EUR-Märkte</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-zinc-400 touch-manipulation hover:bg-white/10 hover:text-white"
            aria-label="Menü schließen"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-white/10 p-4">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-zinc-400">
            Coin suchen
          </label>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="z. B. ETH, SOL, BTC…"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-base text-white outline-none placeholder:text-zinc-500 focus:border-orange-500/60 sm:py-2 sm:text-sm"
            autoFocus
            enterKeyHint="search"
          />
          {searching && <p className="mt-2 text-xs text-zinc-500">Suche…</p>}
          {searchError && <p className="mt-2 text-xs text-rose-400">{searchError}</p>}
          {results.length > 0 && (
            <ul className="mt-3 max-h-48 space-y-1 overflow-y-auto">
              {results.map((coin) => {
                const already = watchedIds.has(coin.id);
                return (
                  <li key={coin.id}>
                    <button
                      type="button"
                      disabled={already}
                      onClick={() => {
                        onAdd({
                          id: coin.id,
                          name: coin.name,
                          symbol: coin.symbol.toLowerCase(),
                        });
                        setQuery("");
                        setResults([]);
                      }}
                      className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5 disabled:cursor-default disabled:opacity-50"
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold uppercase text-zinc-300">
                        {coin.symbol.slice(0, 3)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-white">{coin.name}</span>
                        <span className="block text-xs uppercase text-zinc-500">{coin.id}</span>
                      </span>
                      <span className="text-xs text-orange-400">{already ? "dabei" : "+ Add"}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <ul className="flex-1 space-y-1 overflow-y-auto p-3">
          {watchlist.map((coin) => {
            const price = prices[coin.id];
            const active = coin.id === activeId;
            const up = (price?.price_change_percentage_24h ?? 0) >= 0;
            return (
              <li key={coin.id} className="group relative">
                <button
                  type="button"
                  onClick={() => {
                    onSelect(coin.id);
                    onClose();
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${
                    active ? "bg-orange-500/15 ring-1 ring-orange-500/40" : "hover:bg-white/5"
                  }`}
                >
                  {price?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={price.image} alt="" className="h-8 w-8 rounded-full" />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs uppercase text-zinc-300">
                      {coin.symbol.slice(0, 3)}
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-white">{coin.name}</span>
                    <span className="block text-xs text-zinc-400">
                      {price ? formatEur(price.current_price) : "…"}
                      {price && (
                        <span className={up ? " text-emerald-400" : " text-rose-400"}>
                          {" "}
                          {formatPercent(price.price_change_percentage_24h)}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
                {watchlist.length > 1 && (
                  <button
                    type="button"
                    title="Entfernen"
                    onClick={() => onRemove(coin.id)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 text-xs text-zinc-500 opacity-0 hover:bg-rose-500/20 hover:text-rose-300 group-hover:opacity-100"
                  >
                    Entf.
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </aside>
    </>
  );
}
