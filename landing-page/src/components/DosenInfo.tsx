"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { formatLecturerName, lecturerName, useLecturers } from "@/lib/lecturers";
import { Skeleton } from "@/components/dashboard-ui";
import { SideSheet } from "@/components/SideSheet";

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

      <SideSheet
        open={open}
        onClose={() => setOpen(false)}
        eyebrow="Info dosen"
        title={nama ?? "Nama belum ada di direktori"}
        subtitle={code ? `Kode dosen ${code}` : undefined}
        titleId="dosen-info-title"
        width="md"
        footer={
          <div className={`grid gap-3 ${nama && code ? "grid-cols-2" : "grid-cols-1"}`}>
            {nama && <CopyButton value={nama} label="Salin nama" />}
            {code && <CopyButton value={code} label="Salin kode" />}
          </div>
        }
      >
        <div className="space-y-4">
          {courses && courses.length > 0 ? (
            <div>
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-secondary">Mengajar kamu di</p>
              <ul className="mt-2 space-y-2">
                {courses.map((c) => (
                  <li key={`${c.nama}-${c.hari}-${c.jam}`} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 bg-[#0369A1]" aria-hidden="true" />
                    <span className="min-w-0">
                      {c.nama}
                      {(c.hari || c.jam) && <span className="block font-mono text-xs text-secondary">{[c.hari, c.jam].filter(Boolean).join(" ")}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-secondary">Belum ada mata kuliahmu yang tercatat untuk dosen ini.</p>
          )}
          <p className="font-mono text-[10px] text-secondary">{isFullName ? "Sumber: MyBest" : "Sumber: direktori dosen SIAKAD"}</p>
        </div>
      </SideSheet>
    </>
  );
}
