"use client";

import Image from "next/image";
import { ApiError } from "@/lib/api";

export const inputClass =
  "px-input min-h-11 w-full px-4 py-2.5 text-base sm:text-sm text-foreground placeholder:text-secondary/60";

export const primaryButtonClass =
  "px-btn inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold";

export const ghostButtonClass =
  "px-btn-ghost inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-sm font-semibold";

export function LoadingState({ label = "Memuat data" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-16" role="status" aria-live="polite">
      <div className="px-loader" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <p className="font-mono text-xs font-semibold text-secondary">
        {label}
        <span className="px-cursor" aria-hidden="true">_</span>
      </p>
    </div>
  );
}

/** Placeholder pixel selama data belum datang, supaya teks tidak berganti dari fallback ke data asli. */
export function Skeleton({ className = "h-4 w-24" }: { className?: string }) {
  return <span className={`px-skeleton inline-block align-middle ${className}`} aria-hidden="true" />;
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: ApiError | null;
  onRetry?: () => void;
}) {
  return (
    <div className="glass-card p-8 text-center" role="alert">
      <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#BE123C]">
        {error?.code ?? "ERROR"}
      </p>
      <p className="mt-2 text-sm text-secondary">
        {error?.message ?? "Terjadi kesalahan saat memuat data."}
      </p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`${ghostButtonClass} mt-5`}>
          Coba Lagi
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, description, mascot }: { title: string; description?: string; mascot?: string }) {
  return (
    <div className="glass-card p-8 text-center" role="status" aria-live="polite">
      {mascot && (
        <Image
          src={mascot}
          alt=""
          width={110}
          height={110}
          className="mx-auto mb-3 object-contain"
          aria-hidden="true"
        />
      )}
      <p className="text-sm font-bold text-foreground">{title}</p>
      {description && <p className="mt-1 text-sm text-secondary">{description}</p>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-6 border-b-2 border-dashed border-px-soft pb-5">
      <h1 className="flex items-center gap-3 text-2xl sm:text-3xl font-display font-bold tracking-tight text-foreground">
        <span className="h-2.5 w-2.5 shrink-0 bg-[#0369A1] shadow-[3px_3px_0_0_#9CC6E0]" aria-hidden="true" />
        {title}
      </h1>
      {description && <p className="mt-2 max-w-3xl text-sm leading-relaxed text-secondary">{description}</p>}
    </div>
  );
}

export function ChannelTypeBadge({ type }: { type: string }) {
  return (
    <span className="px-chip inline-flex items-center bg-px-tint px-2.5 py-0.5 text-[11px] font-bold font-mono text-[#0369A1] uppercase">
      {type}
    </span>
  );
}

export function ChannelActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`px-chip inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold ${
        active ? "bg-[#F0F7FB] text-[#0F766E]" : "bg-white text-secondary"
      }`}
    >
      <span className={`h-1.5 w-1.5 ${active ? "bg-[#0F766E]" : "bg-secondary/50"}`} aria-hidden="true" />
      {active ? "Aktif" : "Belum Aktif"}
    </span>
  );
}
