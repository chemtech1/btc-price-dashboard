"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  candlePollMs,
  DEFAULT_CANDLE_INTERVAL,
  isCandleInterval,
  type CandleIntervalId,
} from "../lib/candle-ranges";
import type { RangeId } from "../lib/ranges";
import { chartPollMs, DEFAULT_PRICE_POLL_MS } from "../lib/sync-config";
import type { CandlePoint, CoinPrice, HistoryPoint, WatchedCoin } from "../lib/types";
import {
  loadActiveCoinId,
  loadWatchlist,
  saveActiveCoinId,
  saveWatchlist,
} from "../lib/watchlist";
import { CandleChart } from "./CandleChart";
import { CandleIntervalSelector } from "./CandleIntervalSelector";
import { ChartModeToggle, type ChartMode } from "./ChartModeToggle";
import { CoinMenu } from "./CoinMenu";
import { PriceChart } from "./PriceChart";
import { PriceHeader } from "./PriceHeader";
import { RangeSelector } from "./RangeSelector";

const CANDLE_INTERVAL_KEY = "crypto-candle-interval-v1";
const CHART_MODE_KEY = "crypto-chart-mode-v1";

function loadChartMode(): ChartMode {
  try {
    const raw = localStorage.getItem(CHART_MODE_KEY);
    if (raw === "line" || raw === "candle") return raw;
  } catch {
    /* ignore */
  }
  return "line";
}

function loadCandleInterval(): CandleIntervalId {
  try {
    const raw = localStorage.getItem(CANDLE_INTERVAL_KEY);
    if (raw && isCandleInterval(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_CANDLE_INTERVAL;
}

function persistWatchlistToServer(coins: WatchedCoin[], activeId: string) {
  saveWatchlist(coins);
  saveActiveCoinId(activeId);
  void fetch("/api/watchlist", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coins, activeId }),
  }).catch(() => {
    /* localStorage already written */
  });
}

export function Dashboard() {
  const [watchlist, setWatchlist] = useState<WatchedCoin[]>([]);
  const [activeId, setActiveId] = useState("BTCEUR");
  const [menuOpen, setMenuOpen] = useState(false);
  const [chartMode, setChartMode] = useState<ChartMode>("line");
  const [range, setRange] = useState<RangeId>("1d");
  const [candleInterval, setCandleInterval] =
    useState<CandleIntervalId>(DEFAULT_CANDLE_INTERVAL);
  const [prices, setPrices] = useState<Record<string, CoinPrice>>({});
  const [priceLoading, setPriceLoading] = useState(true);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [points, setPoints] = useState<HistoryPoint[]>([]);
  const [candles, setCandles] = useState<CandlePoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);
  /** Bumped only when coin/range/mode changes — not on every poll. */
  const historyEpochRef = useRef(0);
  const historyInFlightRef = useRef(false);

  useEffect(() => {
    const syncVisible = () =>
      setTabVisible(document.visibilityState !== "hidden");
    syncVisible();
    document.addEventListener("visibilitychange", syncVisible);
    return () => document.removeEventListener("visibilitychange", syncVisible);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      let list = loadWatchlist();
      let active = loadActiveCoinId(list);
      try {
        const res = await fetch("/api/watchlist", { cache: "no-store" });
        if (res.ok) {
          const data = (await res.json()) as {
            coins?: WatchedCoin[];
            activeId?: string;
          };
          if (Array.isArray(data.coins) && data.coins.length > 0) {
            list = data.coins;
            active =
              data.activeId && list.some((c) => c.id === data.activeId)
                ? data.activeId
                : list[0].id;
            saveWatchlist(list);
            saveActiveCoinId(active);
          }
        }
      } catch {
        /* keep localStorage */
      }
      if (cancelled) return;
      setWatchlist(list);
      setActiveId(active);
      setChartMode(loadChartMode());
      setCandleInterval(loadCandleInterval());
      setHydrated(true);
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []);

  const idsKey = useMemo(() => watchlist.map((c) => c.id).join(","), [watchlist]);
  const pollMs =
    chartMode === "candle" ? candlePollMs(candleInterval) : chartPollMs(range);

  function changeChartMode(mode: ChartMode) {
    setChartMode(mode);
    try {
      localStorage.setItem(CHART_MODE_KEY, mode);
    } catch {
      /* ignore */
    }
  }

  function changeCandleInterval(interval: CandleIntervalId) {
    setCandleInterval(interval);
    try {
      localStorage.setItem(CANDLE_INTERVAL_KEY, interval);
    } catch {
      /* ignore */
    }
  }

  const refreshPrices = useCallback(async (signal?: AbortSignal, ids?: string) => {
    const queryIds = ids ?? idsKey;
    if (!queryIds) return;
    try {
      const res = await fetch(`/api/price?ids=${encodeURIComponent(queryIds)}`, {
        signal,
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preise konnten nicht geladen werden");
      setPrices((prev) => {
        const map = { ...prev };
        for (const coin of data.prices as CoinPrice[]) {
          map[coin.id] = coin;
        }
        return map;
      });
      setPriceError(null);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setPriceError(err instanceof Error ? err.message : "Preise konnten nicht geladen werden");
    } finally {
      setPriceLoading(false);
    }
  }, [idsKey]);

  const refreshHistory = useCallback(
    async (signal?: AbortSignal, opts?: { showLoading?: boolean }) => {
      if (!activeId) return;
      // Skip overlapping silent polls (1s live ranges can outpace Binance).
      if (!opts?.showLoading && historyInFlightRef.current) return;

      const epoch = historyEpochRef.current;
      const mode = chartMode;
      const interval = candleInterval;
      const lineRange = range;

      historyInFlightRef.current = true;

      if (opts?.showLoading) {
        setHistoryLoading(true);
        setHistoryError(null);
        // Clear only the other view — avoid empty-state flash on abort.
        if (mode === "candle") setPoints([]);
        else setCandles([]);
      }

      try {
        const url =
          mode === "candle"
            ? `/api/history?id=${encodeURIComponent(activeId)}&interval=${encodeURIComponent(interval)}`
            : `/api/history?id=${encodeURIComponent(activeId)}&range=${encodeURIComponent(lineRange)}`;
        const res = await fetch(url, { signal, cache: "no-store" });
        const data = await res.json();
        if (epoch !== historyEpochRef.current || signal?.aborted) return;
        if (!res.ok) throw new Error(data.error || "Chart konnte nicht geladen werden");
        if (mode === "candle") {
          setCandles(data.candles ?? []);
          setPoints([]);
        } else {
          setPoints(data.points ?? []);
          setCandles([]);
        }
        setHistoryError(null);
      } catch (err) {
        if (epoch !== historyEpochRef.current || signal?.aborted) return;
        if ((err as Error).name === "AbortError") return;
        setHistoryError(err instanceof Error ? err.message : "Chart konnte nicht geladen werden");
      } finally {
        historyInFlightRef.current = false;
        if (opts?.showLoading && epoch === historyEpochRef.current && !signal?.aborted) {
          setHistoryLoading(false);
        }
      }
    },
    [activeId, range, chartMode, candleInterval],
  );

  useEffect(() => {
    if (!hydrated || !idsKey || !tabVisible) return;
    setPriceLoading(true);
    const controller = new AbortController();
    void refreshPrices(controller.signal);

    const watchlistTimer = window.setInterval(() => {
      void refreshPrices();
    }, DEFAULT_PRICE_POLL_MS);

    let rangeTimer: number | undefined;
    if (activeId) {
      rangeTimer = window.setInterval(() => {
        void refreshPrices(undefined, activeId);
      }, pollMs);
    }

    return () => {
      controller.abort();
      window.clearInterval(watchlistTimer);
      if (rangeTimer != null) window.clearInterval(rangeTimer);
    };
  }, [hydrated, idsKey, refreshPrices, activeId, pollMs, tabVisible]);

  useEffect(() => {
    if (!hydrated || !activeId || !tabVisible) return;
    const controller = new AbortController();
    void refreshHistory(controller.signal, { showLoading: true });

    const timer = window.setInterval(() => {
      void refreshHistory();
    }, pollMs);

    return () => {
      // Invalidate only on real view changes (coin/range/mode), not every poll tick.
      historyEpochRef.current += 1;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [hydrated, activeId, range, chartMode, candleInterval, pollMs, refreshHistory, tabVisible]);

  function selectCoin(id: string) {
    setActiveId(id);
    persistWatchlistToServer(watchlist, id);
  }

  function addCoin(coin: WatchedCoin) {
    setWatchlist((prev) => {
      if (prev.some((c) => c.id === coin.id)) return prev;
      const next = [...prev, coin];
      persistWatchlistToServer(next, coin.id);
      return next;
    });
    setActiveId(coin.id);
  }

  function removeCoin(id: string) {
    setWatchlist((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((c) => c.id !== id);
      const nextActive = activeId === id ? next[0].id : activeId;
      if (activeId === id) setActiveId(nextActive);
      persistWatchlistToServer(next, nextActive);
      return next;
    });
  }

  const activePrice = prices[activeId] ?? null;
  const activeMeta = watchlist.find((c) => c.id === activeId);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-4 px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:gap-6 sm:px-6 sm:py-8">
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm font-medium text-white touch-manipulation hover:bg-white/10"
        >
          <span aria-hidden>☰</span>
          Coins
          <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-xs text-orange-300">
            {watchlist.length}
          </span>
        </button>
        <p className="text-xs text-zinc-500 sm:text-sm">Binance · EUR</p>
      </header>

      <section className="sticky top-0 z-30 -mx-3 border-b border-white/10 bg-zinc-950/90 px-3 py-3 backdrop-blur-md sm:static sm:mx-0 sm:rounded-3xl sm:border sm:bg-zinc-900/40 sm:p-8 sm:shadow-2xl sm:shadow-black/30 sm:backdrop-blur-none">
        <PriceHeader
          coin={
            activePrice ??
            (activeMeta && !priceLoading
              ? {
                  id: activeMeta.id,
                  symbol: activeMeta.symbol,
                  name: activeMeta.name,
                  image: "",
                  current_price: Number.NaN,
                  price_change_24h: Number.NaN,
                  price_change_percentage_24h: Number.NaN,
                  last_updated: "",
                }
              : null)
          }
          loading={!hydrated || (priceLoading && !activePrice)}
        />
        {priceError && (
          <p className="mt-2 text-sm text-rose-400 sm:mt-3">Preis-Fehler: {priceError}</p>
        )}
      </section>

      <section className="space-y-3 sm:space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xs font-medium uppercase tracking-wide text-zinc-400 sm:text-sm">
            Verlauf
          </h2>
          <ChartModeToggle value={chartMode} onChange={changeChartMode} />
        </div>
        <div className="min-w-0">
          {chartMode === "line" ? (
            <RangeSelector value={range} onChange={setRange} />
          ) : (
            <CandleIntervalSelector value={candleInterval} onChange={changeCandleInterval} />
          )}
        </div>
        {chartMode === "line" ? (
          <PriceChart
            points={points}
            rangeId={range}
            loading={!hydrated || historyLoading}
            error={historyError}
          />
        ) : (
          <CandleChart
            candles={candles}
            intervalId={candleInterval}
            loading={!hydrated || historyLoading}
            error={historyError}
          />
        )}
      </section>

      <CoinMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        watchlist={watchlist}
        activeId={activeId}
        prices={prices}
        onSelect={selectCoin}
        onAdd={addCoin}
        onRemove={removeCoin}
      />
    </div>
  );
}
