"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { FocusDialog } from "@/components/FocusDialog";

const WIDTHS = {
  md: "sm:max-w-md",
  lg: "sm:max-w-xl",
  xl: "sm:max-w-4xl",
} as const;

/**
 * Panel samping: di desktop menempel di sisi kanan layar setinggi layar (tidak melayang di tengah),
 * di HP naik dari bawah. Judul dan tombol tutup tetap di atas, isi bisa di-scroll, dan aksi
 * (`footer`) menempel di bawah supaya selalu terjangkau jempol.
 * Elemen dengan atribut `data-autofocus` mendapat fokus saat panel dibuka.
 */
export function SideSheet({
  open,
  onClose,
  eyebrow,
  title,
  subtitle,
  titleId,
  width = "lg",
  footer,
  flush = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  titleId: string;
  width?: keyof typeof WIDTHS;
  footer?: React.ReactNode;
  /** Isi tanpa padding (untuk iframe pratinjau). */
  flush?: boolean;
  children: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => root.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus());
    return () => {
      document.body.style.overflow = previous;
      window.cancelAnimationFrame(frame);
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div ref={root} className="fixed inset-0 z-[60] flex items-end justify-end sm:items-stretch">
      <div className="modal-backdrop fixed inset-0 bg-[#072033]/50 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <FocusDialog
        open={open}
        onClose={onClose}
        labelledBy={titleId}
        className={`side-sheet relative z-10 flex ${flush ? "h-[92dvh]" : ""} max-h-[92dvh] w-full flex-col bg-white shadow-[0_-4px_0_0_#0369A1] sm:h-full sm:max-h-none sm:border-l-2 sm:border-[#163A55] sm:shadow-[-6px_0_0_0_#0369A1] ${WIDTHS[width]}`}
      >
        <div className="flex shrink-0 items-start gap-3 border-b-2 border-px-soft bg-px-tint p-4">
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#0369A1]">{eyebrow}</p>}
            <h3 id={titleId} className="break-words text-base font-display font-bold leading-snug text-foreground">
              {title}
            </h3>
            {subtitle && <p className="mt-0.5 break-words text-xs text-secondary">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel"
            className="px-frame flex min-h-11 min-w-11 shrink-0 items-center justify-center bg-white text-secondary [--px-line:#CFE2EE] hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className={`relative min-h-0 flex-1 overflow-y-auto ${flush ? "" : "p-4 sm:p-6"}`}>{children}</div>

        {footer && (
          <div className="shrink-0 border-t-2 border-dashed border-px-soft bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{footer}</div>
        )}
      </FocusDialog>
    </div>,
    document.body,
  );
}
