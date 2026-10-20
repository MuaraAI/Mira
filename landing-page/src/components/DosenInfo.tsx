"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, GraduationCap, X } from "lucide-react";
import { formatLecturerName, lecturerName, useLecturers } from "@/lib/lecturers";
import { Skeleton } from "@/components/dashboard-ui";

export interface TaughtCourse {
  nama: string;
  hari?: string;
  jam?: string;
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setDone(true);
    window.setTimeout(() => setDone(false), 1600);
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="px-btn-ghost inline-flex min-h-11 w-full items-center justify-center gap-2 px-3 text-xs font-bold"
    >
      {done ? <Check className="h-4 w-4 text-[#0F766E]" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
      <span role="status">{done ? "Tersalin" : label}</span>
    </button>
  );
}

/**
 * Dosen pengampu ditampilkan sebagai "Nama Dosen (KODE)". Diklik membuka info singkat dengan
 * tombol salin nama/kode dan daftar mata kuliah yang diajarnya. Nama berasal dari direktori SIAKAD.
 */
export function DosenInfo({
  kode,
  courses,
  className = "",
}: {
  kode?: string | null;
  /** Mata kuliah milikmu yang diajar dosen ini (opsional, untuk info tambahan). */
  courses?: TaughtCourse[];
  className?: string;
}) {
  const { names, loading } = useLecturers();
  const [open, setOpen] = useState(false);
  const raw = kode?.trim() && kode.trim() !== "-" ? kode.trim() : "";
  // Nilai berspasi berarti MyBest sudah mengirim nama lengkap, bukan kode.
  const isFullName = /\s/.test(raw);
  const code = isFullName ? "" : raw.toUpperCase();
  const nama = isFullName ? formatLecturerName(raw) : lecturerName(names, code);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!raw) return <span className={className}>-</span>;
  if (loading) return <Skeleton className={`h-4 w-32 ${className}`} />;

  const label = code ? (nama ? `${nama} (${code})` : code) : nama ?? raw;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        title="Lihat info dosen"
        className={`max-w-full text-left font-semibold text-foreground underline decoration-px-water decoration-2 underline-offset-4 transition-colors hover:text-[#0369A1] hover:decoration-[#0369A1] ${className}`}
      >
        <span className="break-words">{label}</span>
      </button>

      {open &&
        createPortal(
        <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4">
          <div className="modal-backdrop fixed inset-0 bg-[#072033]/50 backdrop-blur-[2px]" onClick={() => setOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Info dosen"
            className="sheet-panel relative z-10 w-full max-w-md bg-white shadow-[0_-4px_0_0_#0369A1] sm:shadow-[0_-2px_0_0_#163A55,0_2px_0_0_#163A55,-2px_0_0_0_#163A55,2px_0_0_0_#163A55,8px_8px_0_0_#0369A1]"
          >
            <div className="flex items-start gap-3 border-b-2 border-px-soft bg-px-tint p-4">
              <span className="px-icon h-10 w-10 shrink-0">
                <GraduationCap className="h-5 w-5" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#0369A1]">Info dosen</p>
                <h3 className="break-words text-base font-bold leading-snug text-foreground">{nama ?? "Nama belum ada di direktori"}</h3>
                {code && (
                  <p className="mt-0.5 font-mono text-xs text-secondary">
                    Kode dosen <strong className="text-foreground">{code}</strong>
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup"
                className="px-frame flex min-h-11 min-w-11 shrink-0 items-center justify-center bg-white text-secondary [--px-line:#CFE2EE] hover:text-foreground"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              {courses && courses.length > 0 && (
                <div>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">Mengajar kamu di</p>
                  <ul className="mt-2 space-y-1.5">
                    {courses.map((c) => (
                      <li key={`${c.nama}-${c.hari}-${c.jam}`} className="flex items-start gap-2 text-sm text-foreground">
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-[#0369A1]" aria-hidden="true" />
                        <span className="min-w-0">
                          {c.nama}
                          {(c.hari || c.jam) && (
                            <span className="block font-mono text-xs text-secondary">{[c.hari, c.jam].filter(Boolean).join(" ")}</span>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className={`grid gap-3 ${nama && code ? "grid-cols-2" : "grid-cols-1"}`}>
                {nama && <CopyButton value={nama} label="Salin nama" />}
                {code && <CopyButton value={code} label="Salin kode" />}
              </div>
              <p className="font-mono text-[10px] text-secondary">{isFullName ? "Sumber: MyBest" : "Sumber: direktori dosen SIAKAD"}</p>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
