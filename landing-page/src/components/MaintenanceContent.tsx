"use client";

import { X } from "lucide-react";

interface MaintenanceContentProps {
  message: string;
  reason: string;
  /** Jika diisi, tampilkan tombol tutup (popup login). */
  onClose?: () => void;
}

/** Isi maintenance: maskot offline + penjelasan singkat. Dipakai overlay dashboard dan popup login. */
export function MaintenanceContent({ message, reason, onClose }: MaintenanceContentProps) {
  return (
    <div className="relative w-full max-w-lg border-2 border-[#163A55] bg-white p-6 shadow-[8px_8px_0_0_#9CC6E0] sm:p-8">
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup pemberitahuan maintenance"
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center text-secondary transition-colors hover:text-foreground"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#B45309]">
        <span className="h-1.5 w-1.5 bg-[#B45309]" aria-hidden="true" />
        Maintenance
      </div>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/maskot/mura-offline.png"
        alt="Maskot Mira sedang offline"
        width={160}
        height={160}
        className="mx-auto mt-4 h-32 w-32 object-contain sm:h-40 sm:w-40"
      />

      <h1 className="mt-4 text-center font-display text-2xl font-bold uppercase leading-tight tracking-tight text-foreground">
        {message}
      </h1>
      <p className="mt-3 text-center text-sm leading-relaxed text-secondary">{reason}</p>
      <p className="mt-4 text-center font-mono text-[11px] text-secondary">
        Kami kabari lewat kanal resmi begitu sudah bisa dipakai lagi.
      </p>
    </div>
  );
}
