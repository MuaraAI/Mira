"use client";

import { useState } from "react";
import { ArrowUpRight, Bug, Heart } from "lucide-react";
import { ISSUE_URL } from "@/lib/public-links";
import { TraktirModal } from "@/components/TraktirModal";

export function DashboardHeaderActions({ compact = false }: { compact?: boolean }) {
  const [traktirOpen, setTraktirOpen] = useState(false);

  return (
    <>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          type="button"
          onClick={() => setTraktirOpen(true)}
          aria-label="Traktir Server Mira"
          title="Traktir Server Mira"
          aria-haspopup="dialog"
          aria-expanded={traktirOpen}
          className={`inline-flex shrink-0 items-center justify-center rounded-[6px] border-[1px] border-[#FECDD3] bg-[#FFF1F2] text-[#9F1239] transition-colors hover:border-[#9F1239] hover:bg-[#FFE4E6] ${
            compact ? "h-8 w-8" : "h-9 w-9"
          }`}
        >
          <Heart className="h-4 w-4 fill-current" aria-hidden="true" />
        </button>

        <a
          href={ISSUE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Laporkan Bug atau Ide di GitHub"
          title="Laporkan Bug / Ide"
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-[6px] border-[1px] border-stroke bg-white font-medium text-foreground transition-colors hover:border-[#072033] hover:bg-[#F0F7FB] ${
            compact ? "h-8 px-2.5 text-[11px]" : "h-9 px-3 text-xs"
          }`}
        >
          <Bug className="h-3.5 w-3.5 shrink-0 text-[#0369A1]" aria-hidden="true" />
          <span>{compact ? "Bug / Ide" : "Laporkan Bug / Ide"}</span>
          {!compact && <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-secondary" aria-hidden="true" />}
        </a>
      </div>

      <TraktirModal open={traktirOpen} onClose={() => setTraktirOpen(false)} />
    </>
  );
}
