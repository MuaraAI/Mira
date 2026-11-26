"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

interface CopyCodeBlockProps {
  title?: string;
  hint?: string;
  code: string;
  copyLabel?: string;
  accent?: boolean;
  wrap?: boolean;
}

export function CopyCodeBlock({
  title,
  hint,
  code,
  copyLabel = "Salin",
  accent = false,
  wrap = false,
}: CopyCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API tidak tersedia
    }
  }

  const label = title || "kode";

  return (
    <div
      className={`min-w-0 overflow-hidden rounded-[8px] border ${
        accent ? "border-[#0369A1]/40 bg-[#F0F7FB]" : "border-stroke bg-[#131b26]"
      }`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 ${
          accent
            ? "border-[#0369A1]/20 bg-[#F0F7FB] text-foreground"
            : "border-white/10 bg-[#131b26] text-[#cdd6f4]"
        }`}
      >
        <div className="min-w-0">
          {title && (
            <p
              className={`font-mono text-[11px] font-bold uppercase tracking-[0.12em] ${
                accent ? "text-[#0369A1]" : "text-[#7DD3FC]"
              }`}
            >
              {title}
            </p>
          )}
          {hint && (
            <p className={`mt-0.5 text-xs ${accent ? "text-secondary" : "text-[#9fb3c8]"}`}>
              {hint}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Salin ${label}`}
          className={`inline-flex min-h-[34px] shrink-0 items-center gap-1.5 rounded-[6px] border px-3 py-1 text-xs font-medium transition-colors ${
            accent
              ? "border-[#072033] bg-[#072033] text-white hover:bg-white hover:text-[#072033]"
              : "border-white/20 bg-white/5 text-[#e2f1fc] hover:bg-white/15"
          }`}
        >
          {copied ? (
            <>
              <Check
                className={`h-3.5 w-3.5 ${accent ? "text-white" : "text-emerald-400"}`}
                aria-hidden="true"
              />
              <span>Tersalin</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{copyLabel}</span>
            </>
          )}
        </button>
      </div>

      <div className={accent ? "p-3" : ""}>
        <div
          className={`min-w-0 overflow-x-auto bg-[#131b26] p-4 font-mono text-xs leading-relaxed text-[#E2F1FC] ${
            accent ? "rounded-[6px]" : ""
          }`}
        >
          <pre className={wrap ? "whitespace-pre-wrap break-words" : ""}>{code}</pre>
        </div>
      </div>
    </div>
  );
}
