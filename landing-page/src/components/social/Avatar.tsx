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

/** Avatar bulat bersih: foto bila ada, kalau tidak inisial di atas warna turunan username. */
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
        className={`flex items-center justify-center overflow-hidden rounded-[9999px] font-sans font-semibold ${SIZES[size]}`}
        style={{ background: tone.bg, color: tone.fg }}
      >
        {saved ? (
          <Bookmark className="h-[46%] w-[46%]" />
        ) : url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" onError={() => setBroken(true)} />
        ) : (
          initials(name)
        )}
      </span>
      {online !== undefined && !saved && (
        <span
          className={`absolute bottom-0 right-0 rounded-[9999px] border-2 border-white transition-colors duration-200 ${DOT[size]} ${
            online ? "bg-[#16A34A]" : "bg-[#CBD5E1]"
          }`}
        />
      )}
    </span>
  );
}

export function ChannelGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return <Hash className={className} aria-hidden="true" />;
}

/** Ikon ruang di rail: foto ruang atau inisial dengan sudut halus ala Telegram/Discord. */
export function SpaceTile({ name, src, active, compact = false }: { name: string; src?: string | null; active: boolean; compact?: boolean }) {
  const [broken, setBroken] = useState(false);
  const url = !broken ? mediaUrl(src) : null;
  return (
    <span
      className={`flex items-center justify-center overflow-hidden font-sans text-xs font-semibold transition-[background-color,color,border-color,border-radius,transform] duration-200 active:scale-95 ${
        compact ? "h-10 w-10" : "h-11 w-11"
      } ${
        active
          ? "rounded-[12px] bg-[#072033] text-white"
          : "rounded-[9999px] border-[1px] border-[#D4E3EE] bg-white text-[#072033] group-hover:rounded-[14px] group-hover:border-[#0369A1]"
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

/* ------------------------------------------------------------------ status pesan (vektor halus) */

type TickState = "sending" | "sent" | "read" | "failed";

const TICK_LABEL: Record<TickState, string> = {
  sending: "Mengirim",
  sent: "Terkirim",
  read: "Dibaca",
  failed: "Gagal terkirim",
};

const TICK_COLOR: Record<TickState, string> = {
  sending: "#648296",
  sent: "#648296",
  read: "#0369A1",
  failed: "#BE123C",
};

export function PixelTick({ state }: { state: TickState }) {
  const color = TICK_COLOR[state];
  if (state === "sending") {
    return (
      <svg viewBox="0 0 14 14" width={13} height={13} fill="none" role="img" aria-label={TICK_LABEL[state]} className="shrink-0">
        <title>{TICK_LABEL[state]}</title>
        <circle cx="7" cy="7" r="5.2" stroke={color} strokeWidth="1.4" />
        <path d="M7 4.2V7.2L9 8.4" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (state === "failed") {
    return (
      <svg viewBox="0 0 14 14" width={13} height={13} fill="none" role="img" aria-label={TICK_LABEL[state]} className="shrink-0">
        <title>{TICK_LABEL[state]}</title>
        <circle cx="7" cy="7" r="5.5" stroke={color} strokeWidth="1.5" />
        <path d="M7 4.2V7.6M7 9.8h.01" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg
      viewBox={state === "read" ? "0 0 18 12" : "0 0 14 12"}
      width={state === "read" ? 16 : 13}
      height={11}
      fill="none"
      role="img"
      aria-label={TICK_LABEL[state]}
      className="shrink-0"
    >
      <title>{TICK_LABEL[state]}</title>
      <path d="M1.5 6.4L4.8 9.6L11.5 2.4" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      {state === "read" && (
        <path d="M6.2 6.4L9.2 9.6L16.2 2.4" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
