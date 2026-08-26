export type WatchedCoin = {
  id: string;
  symbol: string;
  name: string;
};

export type CoinPrice = {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  current_price_usd?: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  last_updated: string;
};

export type HistoryPoint = {
  t: number;
  price: number;
};

export type CandlePoint = {
  t: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type SearchResult = {
  id: string;
  name: string;
  symbol: string;
  thumb: string;
  market_cap_rank: number | null;
};

export type EurPair = {
  symbol: string;
  baseAsset: string;
  quoteAsset: "EUR";
};
