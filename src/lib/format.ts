const eur = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});

const eurCompact = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  notation: "compact",
  maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat("de-DE", {
  style: "percent",
  signDisplay: "exceptZero",
  maximumFractionDigits: 2,
});

const usd = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function formatEur(value: number, compact = false): string {
  if (!Number.isFinite(value)) return "–";
  return compact && Math.abs(value) >= 10_000 ? eurCompact.format(value) : eur.format(value);
}

export function formatUsd(value: number): string {
  if (!Number.isFinite(value)) return "–";
  return usd.format(value);
}

export function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return "–";
  return percent.format(value / 100);
}

export function formatChartTick(timestamp: number, rangeId: string): string {
  const d = new Date(timestamp);
  if (rangeId === "5m" || rangeId === "15m") {
    return d.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  if (rangeId === "1h" || rangeId === "1d") {
    return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  if (rangeId === "7d" || rangeId === "30d") {
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  }
  return d.toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
}

export function formatTooltipTime(timestamp: number, rangeId: string): string {
  const d = new Date(timestamp);
  if (rangeId === "5m" || rangeId === "15m") {
    return d.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  if (rangeId === "1h" || rangeId === "1d" || rangeId === "7d") {
    return d.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/** Tick/tooltip labels for candlestick intervals (10s…1d). */
export function formatCandleTick(timestamp: number, intervalId: string): string {
  const d = new Date(timestamp);
  if (intervalId === "10s") {
    return d.toLocaleTimeString("de-DE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  if (intervalId === "1m" || intervalId === "5m" || intervalId === "15m") {
    return d.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (intervalId === "1h" || intervalId === "4h") {
    return d.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function formatCandleTooltipTime(timestamp: number, intervalId: string): string {
  const d = new Date(timestamp);
  if (intervalId === "1d") {
    return d.toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  if (intervalId === "10s") {
    return d.toLocaleString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
