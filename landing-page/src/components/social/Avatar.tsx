"use client";

import { useState } from "react";
import { Bookmark, Hash } from "lucide-react";
import { initials, mediaUrl, toneFor } from "@/lib/social";

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-xs",
  lg: "h-12 w-12 text-sm",
  xl: "h-20 w-20 text-xl",
} as const;

const DOT = { sm: "h-2.5 w-2.5", md: "h-3 w-3", lg: "h-3.5 w-3.5", xl: "h-4 w-4" } as const;

/** Avatar kotak pixel: foto bila ada, kalau tidak inisial di atas warna turunan username. */
export function Avatar({
  name,
  seed,
  src,
  size = "md",
  online,
  saved = false,
}: {
  name: string;
  seed: string;
  /** Id media avatar dari server. */
  src?: string | null;
  size?: keyof typeof SIZES;
  online?: boolean;
  saved?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const tone = saved ? { bg: "#0369A1", fg: "#FFFFFF" } : toneFor(seed || name);
  const url = !saved && !broken ? mediaUrl(src) : null;
  return (
    <span className="relative inline-flex shrink-0" aria-hidden="true">
      <span
        className={`flex items-center justify-center overflow-hidden font-mono font-bold shadow-[2px_2px_0_0_#CFE2EE] ${SIZES[size]}`}
        style={{ background: tone.bg, color: tone.fg }}
      >
        {saved ? (
          <Bookmark className="h-1/2 w-1/2" />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setBroken(true)} />
        ) : (
          initials(name)
        )}
      </span>
      {online !== undefined && !saved && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 border-2 border-white transition-colors duration-300 ${DOT[size]} ${
            online ? "bg-[#16A34A]" : "bg-[#9CC6E0]"
          }`}
        />
      )}
    </span>
  );
}

export function ChannelGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return <Hash className={className} aria-hidden="true" />;
}

/** Ikon ruang di rail: foto ruang atau inisial; aktif = drop biru (sama seperti bottom nav). */
export function SpaceTile({ name, src, active, compact = false }: { name: string; src?: string | null; active: boolean; compact?: boolean }) {
  const [broken, setBroken] = useState(false);
  const url = !broken ? mediaUrl(src) : null;
  return (
    <span
      className={`flex items-center justify-center overflow-hidden font-mono text-xs font-bold transition-[background-color,color,box-shadow,transform] duration-200 ${
        compact ? "h-10 w-10" : "h-11 w-11"
      } ${
        active
          ? "-translate-x-px -translate-y-px bg-[#072033] text-white shadow-[3px_3px_0_0_#0369A1]"
          : "bg-white text-[#072033] shadow-[0_0_0_2px_#CFE2EE] group-hover:shadow-[0_0_0_2px_#5FA3CC]"
      }`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setBroken(true)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ status pesan (pixel) */

type TickState = "sending" | "sent" | "read" | "failed";

const TICK_LABEL: Record<TickState, string> = {
  sending: "Mengirim",
  sent: "Terkirim",
  read: "Dibaca",
  failed: "Gagal terkirim",
};

// Tiap ikon digambar di grid 14x10 dengan kotak 1x1 sehingga tetap tajam di layar mana pun.
const PIXELS: Record<TickState, string> = {
  // Jam pixel: lingkar kotak + jarum.
  sending: "M4 1h4v1H4zM3 2h1v1H3zM8 2h1v1H8zM2 3h1v4H2zM9 3h1v4H9zM3 7h1v1H3zM8 7h1v1H8zM4 8h4v1H4zM6 3h1v3H6zM7 5h1v1H7z",
  // Satu centang.
  sent: "M11 1h1v1h-1zM10 2h1v1h-1zM9 3h1v1H9zM8 4h1v1H8zM7 5h1v1H7zM6 6h1v1H6zM5 7h1v1H5zM4 6h1v1H4zM3 5h1v1H3zM2 4h1v1H2z",
  // Dua centang bertumpuk.
  read:
    "M9 1h1v1H9zM8 2h1v1H8zM7 3h1v1H7zM6 4h1v1H6zM5 5h1v1H5zM4 6h1v1H4zM3 7h1v1H3zM2 6h1v1H2zM1 5h1v1H1zM0 4h1v1H0z" +
    "M13 1h1v1h-1zM12 2h1v1h-1zM11 3h1v1h-1zM10 4h1v1h-1zM9 5h1v1H9zM8 6h1v1H8zM7 7h1v1H7zM6 6h1v1H6z",
  // Tanda seru dalam kotak.
  failed: "M5 0h3v1H5zM4 1h1v7H4zM8 1h1v7H8zM5 8h3v1H5zM6 2h1v3H6zM6 6h1v1H6z",
};

const TICK_COLOR: Record<TickState, string> = {
  sending: "#5F7F95",
  sent: "#5F7F95",
  read: "#0369A1",
  failed: "#BE123C",
};

export function PixelTick({ state }: { state: TickState }) {
  return (
    <svg
      viewBox="0 0 14 10"
      width={state === "read" ? 18 : 14}
      height={11}
      shapeRendering="crispEdges"
      role="img"
      aria-label={TICK_LABEL[state]}
      className="shrink-0"
      style={{ width: state === "read" ? 18 : 14 }}
    >
      <title>{TICK_LABEL[state]}</title>
      <path d={PIXELS[state]} fill={TICK_COLOR[state]} />
    </svg>
  );
}
