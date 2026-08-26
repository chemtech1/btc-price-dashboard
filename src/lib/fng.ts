export type FngPoint = {
  t: number;
  value: number;
  classification: string;
  labelDe: string;
};

const LABELS: Record<string, string> = {
  "Extreme Fear": "Extreme Angst",
  Fear: "Angst",
  Neutral: "Neutral",
  Greed: "Gier",
  "Extreme Greed": "Extreme Gier",
};

export function fngLabelDe(classification: string): string {
  return LABELS[classification] ?? classification;
}

export function fngColor(value: number): string {
  if (value < 25) return "#fb7185";
  if (value < 50) return "#fb923c";
  if (value < 55) return "#a1a1aa";
  if (value < 75) return "#fbbf24";
  return "#34d399";
}

type AltMeRow = {
  value: string;
  value_classification: string;
  timestamp: string;
  time_until_update?: string;
};

type AltMeResponse = {
  data?: AltMeRow[];
  metadata?: { error?: string | null };
};

export async function fetchFng(limit = 30): Promise<FngPoint[]> {
  const res = await fetch(
    `https://api.alternative.me/fng/?limit=${Math.min(Math.max(limit, 1), 365)}`,
    { cache: "no-store", headers: { Accept: "application/json" } },
  );
  if (!res.ok) {
    throw new Error(`Fear & Greed ${res.status}`);
  }
  const body = (await res.json()) as AltMeResponse;
  if (body.metadata?.error) {
    throw new Error(String(body.metadata.error));
  }
  const rows = body.data ?? [];
  return rows
    .map((row) => {
      const value = Number(row.value);
      const t = Number(row.timestamp) * 1000;
      return {
        t,
        value,
        classification: row.value_classification,
        labelDe: fngLabelDe(row.value_classification),
      };
    })
    .filter((p) => Number.isFinite(p.value) && Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
}
