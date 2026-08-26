import { NextRequest, NextResponse } from "next/server";
import { isEurSymbol, normalizeSymbol } from "../../../lib/binance";
import { ensureTickers } from "../../../lib/sync";

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get("ids") ?? "BTCEUR";
  const ids = idsParam
    .split(",")
    .map((id) => normalizeSymbol(id))
    .filter(isEurSymbol)
    .slice(0, 50);

  if (ids.length === 0) {
    return NextResponse.json({ error: "Keine gültigen EUR-Symbole" }, { status: 400 });
  }

  try {
    const prices = await ensureTickers(ids);
    return NextResponse.json(
      { prices },
      {
        headers: {
          "Cache-Control": "public, s-maxage=20, stale-while-revalidate=40",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
