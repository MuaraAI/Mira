"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X } from "lucide-react";
import { FocusDialog } from "@/components/FocusDialog";
import { TraktirForm } from "@/components/TraktirForm";
import { lockScroll } from "@/lib/scroll-lock";

export function TraktirModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    return lockScroll();
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center sm:p-4">
      <div
        className="modal-backdrop fixed inset-0 bg-[#072033]/55 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />

      <FocusDialog
        open={open}
        onClose={onClose}
        labelledBy="traktir-modal-title"
        className="sheet-panel relative z-10 max-h-[92dvh] w-full overflow-y-auto rounded-t-[14px] border-[1px] border-stroke bg-white shadow-2xl sm:max-w-4xl sm:rounded-[14px]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b-[1px] border-stroke bg-white/95 px-4 py-3 backdrop-blur-sm sm:px-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#0369A1]">
            TRAKTIR SERVER MIRA
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup popup traktir"
            className="-mr-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[6px] text-secondary transition-colors hover:bg-[#F0F7FB] hover:text-foreground"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-start lg:gap-8">
          <div className="min-w-0">
            <div className="flex items-center gap-3.5 sm:gap-4">
              <Image
                src="/maskot/mura-traktir.png"
                alt="Maskot Mira mengajak patungan traktir server"
                width={112}
                height={112}
                className="h-20 w-20 shrink-0 object-contain sm:h-24 sm:w-24"
              />
              <h2
                id="traktir-modal-title"
                className="font-home-display text-[clamp(1.25rem,3vw,1.7rem)] leading-[1.18] tracking-[-0.01em] text-foreground"
              >
                Bantu Mira biar tetap hidup dan gratis
              </h2>
            </div>

            <p className="mt-4 text-[13.5px] leading-[1.7] text-secondary sm:text-[14px]">
              Mira 100% gratis, bebas iklan, dan dikerjain bareng komunitas Muara AI biar urusan
              kuliah kamu di UBSI nggak ribet lagi. Tapi server, domain, sama kopi pas begadang
              benerin bug tetap butuh bensin.
            </p>
            <p className="mt-2.5 text-[13.5px] leading-[1.7] text-secondary sm:text-[14px]">
              Kalau Mira ngebantu kamu cek jadwal, ngejar deadline tugas, atau absen lebih cepat,
              boleh banget ikut patungan seikhlasnya lewat SociaBuzz. Nggak ada minimal, yang
              penting Mira jalan terus.
            </p>

            <dl className="mt-5 grid grid-cols-3 divide-x-[1px] divide-stroke rounded-[8px] border-[1px] border-stroke bg-surface-alt">
              <div className="px-2.5 py-2.5 sm:px-3.5 sm:py-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-secondary">
                  Status
                </dt>
                <dd className="mt-1 text-[12px] font-medium text-foreground sm:text-[13px]">
                  Gratis &amp; Open
                </dd>
              </div>
              <div className="px-2.5 py-2.5 sm:px-3.5 sm:py-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-secondary">
                  Metode
                </dt>
                <dd className="mt-1 text-[12px] font-medium text-foreground sm:text-[13px]">
                  QRIS &amp; E-Wallet
                </dd>
              </div>
              <div className="px-2.5 py-2.5 sm:px-3.5 sm:py-3">
                <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-secondary">
                  Alokasi
                </dt>
                <dd className="mt-1 text-[12px] font-medium text-foreground sm:text-[13px]">
                  VPS &amp; Domain
                </dd>
              </div>
            </dl>
          </div>

          <div className="min-w-0">
            <TraktirForm idPrefix="traktir-modal" />
          </div>
        </div>
      </FocusDialog>
    </div>,
    document.body,
  );
}
