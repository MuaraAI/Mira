"use client";

import Image from "next/image";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api";

export const inputClass =
  "px-input min-h-11 w-full px-4 py-2.5 text-base sm:text-[13.5px] text-foreground placeholder:text-secondary/60";

export const primaryButtonClass =
  "px-btn inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 text-[13px] font-normal tracking-[0.015em]";

export const ghostButtonClass =
  "px-btn-ghost inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-[13px] font-normal";

export function LoadingState({ label = "Memuat data" }: { label?: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-4 py-16"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-7 w-7 animate-spin text-[#0369A1]" aria-hidden="true" />
      <p className="font-mono text-xs text-secondary">{label}...</p>
    </div>
  );
}

/** Placeholder shimmer selama data belum tiba, mencegah lonjakan tata letak. */
export function Skeleton({ className = "h-4 w-24" }: { className?: string }) {
  return (
    <span
      className={`inline-block rounded-[8px] bg-[#EAF3F9] align-middle ${className}`}
      aria-hidden="true"
    />
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
    <div
      className="rounded-[16px] border-[1px] border-[#FDA4AF] bg-white p-8 text-center shadow-[0_12px_32px_-22px_rgba(190,18,60,0.18)]"
      role="alert"
    >
      <p className="font-mono text-xs uppercase tracking-widest text-[#BE123C]">
        {error?.code ?? "ERROR"}
      </p>
      <p className="mt-2 text-[13.5px] leading-relaxed text-secondary">
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

export function EmptyState({
  title,
  description,
  mascot,
}: {
  title: string;
  description?: string;
  mascot?: string;
}) {
  return (
    <div
      className="rounded-[16px] border-[1px] border-stroke bg-white p-8 text-center"
      role="status"
      aria-live="polite"
    >
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
      <p className="text-[14.5px] text-foreground">{title}</p>
      {description && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-secondary">{description}</p>
      )}
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
    <div className="mb-4 border-b-[1px] border-stroke pb-3.5 sm:mb-6 sm:pb-5">
      <h1 className="text-xl font-semibold tracking-[-0.015em] text-foreground sm:text-[28px] sm:font-normal">
        {title}
      </h1>
      {description && (
        <p className="mt-1 max-w-3xl text-xs leading-relaxed text-secondary sm:mt-2 sm:text-[13.5px]">
          {description}
        </p>
      )}
    </div>
  );
}

export function ChannelTypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center rounded-[4px] border-[1px] border-stroke bg-[#F7FAFC] px-2 py-0.5 font-mono text-[10.5px] uppercase text-secondary">
      {type}
    </span>
  );
}

export function ChannelActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-[9999px] border-[1px] px-3 py-1 text-xs ${
        active
          ? "border-[#0F766E]/30 bg-[#F0F7FB] text-[#0F766E]"
          : "border-stroke bg-white text-secondary"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-[9999px] ${active ? "bg-[#0F766E]" : "bg-secondary/50"}`}
        aria-hidden="true"
      />
      {active ? "Aktif" : "Belum Aktif"}
    </span>
  );
}
