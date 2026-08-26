import type { WatchedCoin } from "./types";

export const DEFAULT_WATCHLIST: WatchedCoin[] = [
  { id: "BTCEUR", symbol: "btc", name: "BTC" },
];

const STORAGE_KEY = "crypto-watchlist-v2";
const ACTIVE_KEY = "crypto-active-coin-v2";

function isValidWatched(c: WatchedCoin): boolean {
  return Boolean(c?.id && c?.symbol && c?.name && /^[A-Z0-9]+EUR$/.test(c.id));
}

export function loadWatchlist(): WatchedCoin[] {
  if (typeof window === "undefined") return DEFAULT_WATCHLIST;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WATCHLIST;
    const parsed = JSON.parse(raw) as WatchedCoin[];
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_WATCHLIST;
    const valid = parsed.filter(isValidWatched);
    return valid.length > 0 ? valid : DEFAULT_WATCHLIST;
  } catch {
    return DEFAULT_WATCHLIST;
  }
}

export function saveWatchlist(coins: WatchedCoin[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(coins));
}

export function loadActiveCoinId(watchlist: WatchedCoin[]): string {
  if (typeof window === "undefined") return watchlist[0]?.id ?? "BTCEUR";
  const stored = localStorage.getItem(ACTIVE_KEY);
  if (stored && watchlist.some((c) => c.id === stored)) return stored;
  return watchlist[0]?.id ?? "BTCEUR";
}

export function saveActiveCoinId(id: string): void {
  localStorage.setItem(ACTIVE_KEY, id);
}
