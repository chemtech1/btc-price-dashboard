import { NextRequest, NextResponse } from "next/server";
import { isEurSymbol, normalizeSymbol } from "../../../lib/binance";
import {
  getCandleRange,
  isCandleInterval,
} from "../../../lib/candle-ranges";
import { getRange, type RangeId } from "../../../lib/ranges";
import { ensureCandles, ensureHistory } from "../../../lib/sync";

export async function GET(request: NextRequest) {
  const id = normalizeSymbol(request.nextUrl.searchParams.get("id") ?? "BTCEUR");
  const intervalParam = request.nextUrl.searchParams.get("interval")?.trim() ?? "";

  if (!isEurSymbol(id)) {
    return NextResponse.json(
      { error: "Ungültiges Symbol — nur Binance-EUR-Paare (z. B. BTCEUR)" },
      { status: 400 },
    );
  }

  // Candlestick mode: ?interval=1h
  if (intervalParam) {
    if (!isCandleInterval(intervalParam)) {
      return NextResponse.json({ error: "Ungültiges Kerzen-Intervall" }, { status: 400 });
    }
    const candleRange = getCandleRange(intervalParam)!;
    try {
      const candles = await ensureCandles(id, intervalParam);
      return NextResponse.json(
        { id, interval: intervalParam, candles },
        {
          headers: {
            "Cache-Control": `public, s-maxage=${candleRange.cacheSeconds}, stale-while-revalidate=${candleRange.cacheSeconds * 2}`,
          },
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unbekannter Fehler";
      return NextResponse.json({ error: message }, { status: 502 });
    }
  }

  // Line chart mode: ?range=1d
  const rangeId = (request.nextUrl.searchParams.get("range")?.trim() || "1d") as RangeId;
  const range = getRange(rangeId);

  if (!range) {
    return NextResponse.json({ error: "Ungültiger Zeitraum" }, { status: 400 });
  }

  try {
    const points = await ensureHistory(id, rangeId);
    return NextResponse.json(
      { id, range: rangeId, points },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${range.cacheSeconds}, stale-while-revalidate=${range.cacheSeconds * 2}`,
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
