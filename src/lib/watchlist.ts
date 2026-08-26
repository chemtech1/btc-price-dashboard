import type { WatchedCoin } from "./types";

export const DEFAULT_WATCHLIST: WatchedCoin[] = [
  { id: "BTCEUR", symbol: "btc", name: "BTC" },
];

const STORAGE_KEY = "crypto-watchlist-v2";
const ACTIVE_KEY = "crypto-active-coin-v2";

export function isValidWatched(c: WatchedCoin): boolean {
  return Boolean(c?.id && c?.symbol && c?.name && /^[A-Z0-9]+EUR$/.test(c.id));
}

export function sanitizeWatchlistPayload(
  coinsRaw: unknown,
  activeIdRaw: unknown,
): { coins: WatchedCoin[]; activeId: string } | null {
  if (!Array.isArray(coinsRaw) || coinsRaw.length === 0) return null;
  const coins = (coinsRaw as WatchedCoin[]).filter(isValidWatched);
  if (coins.length === 0) return null;
  const seen = new Set<string>();
  const unique = coins.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
  const activeId =
    typeof activeIdRaw === "string" && unique.some((c) => c.id === activeIdRaw)
      ? activeIdRaw
      : unique[0].id;
  return { coins: unique, activeId };
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
