"use client";

import { ExternalLink, Lock } from "lucide-react";
import { SIAKAD_CTA_FALLBACK, useCapabilities } from "@/lib/capabilities";
import { primaryButtonClass } from "@/components/dashboard-ui";

interface SiaKadLockedCardProps {
  title?: string;
  description?: string;
  /** Strip satu baris: dipakai di dashboard supaya data MyBest tetap terlihat lebih dulu. */
  compact?: boolean;
}

/** Kartu untuk fitur SIAKAD yang dimatikan: penjelasan singkat + tautan ke portal kampus. */
export function SiaKadLockedCard({
  title = "Fitur ini ada di SIAKAD",
  description = "Mira tidak lagi mengambil data dari SIAKAD. Buka students.bsi.ac.id untuk melihat data akademikmu langsung di portal kampus.",
  compact = false,
}: SiaKadLockedCardProps) {
  const { data } = useCapabilities();
  const ctaUrl = data?.siakad.cta_url || SIAKAD_CTA_FALLBACK;

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-2 border-amber-300 bg-amber-50 px-3 py-2.5">
        <Lock className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-amber-900">
          <strong className="font-semibold">{title}.</strong> Nilai akhir, IPK, dan KRS tetap di portal kampus.
        </p>
        <a
          href={ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 shrink-0 items-center gap-1.5 border-2 border-amber-700/40 bg-white px-2.5 font-mono text-[11px] font-bold uppercase tracking-wide text-amber-800 hover:bg-amber-100"
        >
          Buka SIAKAD
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </div>
    );
  }

  return (
    <div className="px-card mx-auto max-w-2xl border-2 border-px-soft bg-white p-6 sm:p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center border-2 border-amber-300 bg-amber-50 text-amber-700">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="mb-2 inline-block bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-wider text-amber-700">
            Di luar Mira
          </span>
          <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground sm:text-2xl">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-secondary">{description}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-px-soft pt-6">
        <p className="font-mono text-xs text-secondary">
          Portal kampus memakai akun dan CAPTCHA sendiri.
        </p>
        <a
          href={ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`${primaryButtonClass} text-xs`}
        >
          Buka SIAKAD
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}
