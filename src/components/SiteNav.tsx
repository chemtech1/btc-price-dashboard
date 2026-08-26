"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Kurs" },
  { href: "/stimmung", label: "Stimmung" },
] as const;

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav
      className="flex rounded-xl border border-white/10 bg-white/5 p-0.5 text-sm"
      aria-label="Seiten"
    >
      {ITEMS.map((item) => {
        const active =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`min-h-9 rounded-lg px-3 py-1.5 font-medium touch-manipulation ${
              active
                ? "bg-orange-500 text-black"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
