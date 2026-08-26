import { NextRequest, NextResponse } from "next/server";
import { getWatchlist, replaceWatchlist } from "../../../lib/repository";
import { sanitizeWatchlistPayload } from "../../../lib/watchlist";

export async function GET() {
  const data = getWatchlist();
  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function PUT(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const payload = body as { coins?: unknown; activeId?: unknown };
  const parsed = sanitizeWatchlistPayload(payload.coins, payload.activeId);
  if (!parsed) {
    return NextResponse.json({ error: "Ungültige Watchlist" }, { status: 400 });
  }

  replaceWatchlist(parsed.coins, parsed.activeId);
  return NextResponse.json(getWatchlist());
}
