"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, GraduationCap, Link2 } from "lucide-react";
import { useApi } from "@/lib/api";
import { EmptyState, ErrorState, LoadingState, ghostButtonClass, primaryButtonClass } from "@/components/dashboard-ui";

interface KhsItem {
  no: number;
  kode: string;
  mata_kuliah: string;
  sks: number;
  nilai: string;
  mutu: number;
  keterangan?: string;
}

interface KhsSemesterData {
  items: KhsItem[];
  total_mutu: number;
  total_sks: number;
  ipk: number;
  ips: number | null;
  semester: number | string | null;
  semesters: { semester: number | string; label: string; selected: boolean }[];
}

/**
 * KHS per semester dari SIAKAD. `ips` = Indeks Prestasi Semester, sedangkan
 * `ipk` di payload tetap kumulatif karena parser memakai ulang `parse_khs`.
 *
 * SIAKAD hanya aktif setelah user menautkannya di Sesi & Keamanan, jadi 401 di
 * sini adalah keadaan normal dan ditampilkan sebagai ajakan, bukan error.
 */
export function KhsSemesterCard() {
  const [semester, setSemester] = useState<string>("");
  const path = semester ? `/v1/studentv2/khs-semester?semester=${encodeURIComponent(semester)}` : "/v1/studentv2/khs-semester";
  const khs = useApi<KhsSemesterData>(path);

  if (khs.loading && !khs.data) return <LoadingState label="Memuat KHS semester" />;

  if (khs.error?.status === 401) {
    return (
      <section className="glass-card space-y-4 border-l-4 border-l-[#0369A1] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-[#0369A1]" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-foreground">
              KHS ada di SIAKAD, dan SIAKAD belum tertaut
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-secondary">
              Nilai akhir, IPS, dan IPK dibaca dari SIAKAD. Tautkan sekali di Sesi &amp; Keamanan
              memakai password SIAKAD-mu sendiri (bukan password MyBest).
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/dashboard/sesi" className={`${primaryButtonClass} text-xs`}>
            <Link2 className="h-4 w-4" aria-hidden="true" />
            Tautkan SIAKAD
          </Link>
          <a
            href="https://students.bsi.ac.id"
            target="_blank"
            rel="noopener noreferrer"
            className={`${ghostButtonClass} text-xs`}
          >
            Buka portal kampus
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
        </div>
      </section>
    );
  }

  if (khs.error) return <ErrorState error={khs.error} onRetry={khs.reload} />;

  const data = khs.data;
  const graded = data?.items ?? [];
  const options = data?.semesters ?? [];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 font-display text-base font-bold text-foreground">
            <GraduationCap className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
            Kartu Hasil Studi per Semester
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-secondary">
            Nilai akhir mata kuliah dan Indeks Prestasi Semester (IPS) dari SIAKAD.
          </p>
        </div>

        {options.length > 1 && (
          <label className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-wider text-secondary">
            Semester
            <select
              value={String(semester || data?.semester || options[0]?.semester || "")}
              onChange={(e) => setSemester(e.target.value)}
              className="min-h-10 border-2 border-stroke bg-white px-2 font-mono text-xs text-foreground"
            >
              {options.map((opt) => (
                <option key={String(opt.semester)} value={String(opt.semester)}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {graded.length === 0 ? (
        <EmptyState
          mascot="/maskot/mura-nilai.png"
          title="Nilai semester ini belum diterbitkan"
          description="Kampus belum merilis nilai untuk semester ini. KHS muncul otomatis begitu nilainya dipublikasikan."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "IPS", value: data?.ips != null ? data.ips.toFixed(2) : "-" },
              { label: "Total mutu", value: String(data?.total_mutu ?? 0) },
              { label: "SKS diambil", value: String(data?.total_sks ?? 0) },
              { label: "Mata kuliah", value: String(graded.length) },
            ].map((stat) => (
              <div key={stat.label} className="glass-card p-4">
                <p className="font-mono text-[11px] uppercase tracking-wider text-secondary">{stat.label}</p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="glass-card overflow-hidden">
            <ul className="divide-y divide-stroke/60">
              {graded.map((item) => (
                <li key={`${item.kode}-${item.no}`} className="flex items-center justify-between gap-3 p-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 font-mono text-[11px] font-bold text-secondary">{item.no}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{item.mata_kuliah}</p>
                      <p className="font-mono text-[11px] text-secondary">
                        {item.kode} · {item.sks} SKS
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-[11px] text-secondary">{item.mutu.toFixed(1)} mutu</span>
                    <span className="rounded border border-[#0F766E]/30 bg-[#F0FDFA] px-2 py-0.5 font-mono text-sm font-bold text-[#0F766E]">
                      {item.nilai || "-"}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  );
}
