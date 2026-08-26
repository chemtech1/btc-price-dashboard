import { NextResponse } from "next/server";
import { fetchFng } from "../../../lib/fng";

export async function GET() {
  try {
    const points = await fetchFng(30);
    const latest = points[points.length - 1] ?? null;
    return NextResponse.json(
      { latest, points },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
