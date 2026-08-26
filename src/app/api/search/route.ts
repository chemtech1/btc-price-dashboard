import { NextRequest, NextResponse } from "next/server";
import { searchCoins } from "../../../lib/sync";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (q.length < 1) {
    return NextResponse.json({ results: [] });
  }

  try {
    const results = await searchCoins(q);
    return NextResponse.json(
      { results },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
