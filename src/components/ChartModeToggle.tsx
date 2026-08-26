"use client";

export type ChartMode = "line" | "candle";

type Props = {
  value: ChartMode;
  onChange: (mode: ChartMode) => void;
};

export function ChartModeToggle({ value, onChange }: Props) {
  return (
    <div
      className="inline-flex rounded-full border border-white/10 bg-white/5 p-0.5"
      role="tablist"
      aria-label="Chart-Darstellung"
    >
      {(
        [
          { id: "line", label: "Linie" },
          { id: "candle", label: "Kerzen" },
        ] as const
      ).map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={`rounded-full px-3.5 py-2 text-sm font-medium transition touch-manipulation ${
              active
                ? "bg-orange-500 text-black shadow-lg shadow-orange-500/20"
                : "text-zinc-300 hover:text-white"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
