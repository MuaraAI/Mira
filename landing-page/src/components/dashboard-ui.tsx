"use client";

import { ApiError } from "@/lib/api";

export const inputClass =
  "w-full rounded-sm border border-stroke bg-white/70 px-4 py-2.5 text-sm text-foreground placeholder:text-secondary/60 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40";

export const primaryButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-pill bg-[#0a1220] border border-[#92EEFF]/30 px-5 py-2.5 text-sm font-bold text-white transition-all duration-200 ease-glass hover:bg-[#131b26] disabled:opacity-50 disabled:cursor-not-allowed";

export const ghostButtonClass =
  "inline-flex items-center justify-center gap-2 rounded-pill border border-stroke bg-white/60 px-4 py-2 text-sm font-semibold text-foreground transition-all duration-200 ease-glass hover:border-accent/50 hover:bg-white/80 disabled:opacity-50 disabled:cursor-not-allowed";

export function LoadingState({ label = "Memuat data" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16" role="status" aria-live="polite">
      <div className="pyramid-loader" aria-hidden="true">
        <div className="pyramid-wrapper">
          <div className="pyramid-side pyramid-side1" />
          <div className="pyramid-side pyramid-side2" />
          <div className="pyramid-side pyramid-side3" />
          <div className="pyramid-side pyramid-side4" />
          <div className="pyramid-shadow" />
        </div>
      </div>
      <p className="text-sm text-secondary font-medium">{label}</p>
    </div>
  );
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
      <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#b42318]">
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

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="glass-card p-8 text-center">
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
    <div className="mb-6">
      <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-foreground">
        {title}
      </h1>
      {description && <p className="mt-1 text-sm text-secondary">{description}</p>}
    </div>
  );
}

export function ChannelTypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded-pill bg-[#08738a]/10 border border-[#08738a]/30 px-2.5 py-0.5 text-[11px] font-bold font-mono text-[#08738a] uppercase">
      {type}
    </span>
  );
}

export function ChannelActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-pill px-3 py-1 text-xs font-bold ${
        active
          ? "bg-[#0a1220] text-[#92EEFF] border border-[#92EEFF]/35"
          : "bg-white/60 text-secondary border border-stroke"
      }`}
    >
      {active ? "Aktif" : "Belum Aktif"}
    </span>
  );
}
