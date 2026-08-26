"use client";

import { RANGES, type RangeId } from "../lib/ranges";

type Props = {
  value: RangeId;
  onChange: (range: RangeId) => void;
};

export function RangeSelector({ value, onChange }: Props) {
  return (
    <div
      className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="tablist"
      aria-label="Zeitraum"
    >
      {RANGES.map((range) => {
        const active = value === range.id;
        return (
          <button
            key={range.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(range.id)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-medium transition touch-manipulation ${
              active
                ? "bg-orange-500 text-black shadow-lg shadow-orange-500/20"
                : "bg-white/5 text-zinc-300 hover:bg-white/10 hover:text-white"
            }`}
          >
            {range.label}
          </button>
        );
      })}
    </div>
  );
}
