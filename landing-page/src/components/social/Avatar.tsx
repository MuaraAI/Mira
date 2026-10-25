"use client";

import { Bookmark, Hash } from "lucide-react";
import { initials, toneFor } from "@/lib/social";

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-14 w-14 text-base",
} as const;

/** Avatar kotak pixel: inisial di atas warna turunan username, titik hijau saat online. */
export function Avatar({
  name,
  seed,
  size = "md",
  online,
  saved = false,
}: {
  name: string;
  seed: string;
  size?: keyof typeof SIZES;
  online?: boolean;
  saved?: boolean;
}) {
  const tone = saved ? { bg: "#0369A1", fg: "#FFFFFF" } : toneFor(seed || name);
  return (
    <span className="relative inline-flex shrink-0" aria-hidden="true">
      <span
        className={`flex items-center justify-center font-mono font-bold shadow-[2px_2px_0_0_#CFE2EE] ${SIZES[size]}`}
        style={{ background: tone.bg, color: tone.fg }}
      >
        {saved ? <Bookmark className="h-1/2 w-1/2" /> : initials(name)}
      </span>
      {online !== undefined && !saved && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 border-2 border-white ${online ? "bg-[#0F766E]" : "bg-[#9CC6E0]"}`}
        />
      )}
    </span>
  );
}

export function ChannelGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return <Hash className={className} aria-hidden="true" />;
}

/** Ikon ruang di rail: inisial nama ruang, aktif = tinta gelap dengan drop biru (sama seperti bottom nav). */
export function SpaceTile({ name, active }: { name: string; active: boolean }) {
  return (
    <span
      className={`flex h-11 w-11 items-center justify-center font-mono text-xs font-bold transition-[background-color,color,box-shadow,transform] duration-200 ${
        active
          ? "-translate-x-px -translate-y-px bg-[#072033] text-white shadow-[3px_3px_0_0_#0369A1]"
          : "bg-white text-[#072033] shadow-[0_0_0_2px_#CFE2EE] group-hover:shadow-[0_0_0_2px_#5FA3CC]"
      }`}
    >
      {initials(name)}
    </span>
  );
}
