import { NextRequest, NextResponse } from "next/server";
import { isEurSymbol, normalizeSymbol } from "../../../lib/binance";
import {
  ensureEurPairs,
  ensureHistory,
  ensureTickers,
  runBackgroundSync,
  symbolsForBackgroundSync,
} from "../../../lib/sync";

export async function POST(request: NextRequest) {
  const symbolsParam = request.nextUrl.searchParams.get("symbols");
  const full = request.nextUrl.searchParams.get("full") === "1";

  try {
    if (full) {
      await runBackgroundSync();
      return NextResponse.json({
        ok: true,
        mode: "full",
        symbols: symbolsForBackgroundSync(),
      });
    }

    await ensureEurPairs(true);
    const symbols = (
      symbolsParam
        ? symbolsParam.split(",")
        : ["BTCEUR"]
    )
      .map(normalizeSymbol)
      .filter(isEurSymbol)
      .slice(0, 20);

    const prices = await ensureTickers(symbols);
    for (const symbol of symbols) {
      await ensureHistory(symbol, "1d");
    }

    return NextResponse.json({ ok: true, mode: "symbols", symbols, count: prices.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
