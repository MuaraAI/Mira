"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SiakadGateNotice, siakadGateIssue } from "@/components/SiakadGateNotice";
import { ArrowUpDown, ExternalLink, FileText, Link2, Printer } from "lucide-react";
import { useApi } from "@/lib/api";
import { KRS_SORT_OPTIONS, sortKrsItems, type KrsSortKey } from "@/lib/dashboard-sort";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  ghostButtonClass,
  primaryButtonClass,
} from "@/components/dashboard-ui";

interface KrsItem {
  no: number;
  kode: string;
  mata_kuliah: string;
  sks: number;
}

interface KrsData {
  items: KrsItem[];
  total_sks: number;
  semester: number;
  kelompok_ujian: string | null;
  can_print: boolean;
  cetak_url: string;
}

/**
 * SIAKAD hanya aktif bila user menautkannya sendiri di Sesi & Keamanan, jadi
 * 401 di sini adalah keadaan normal, bukan kesalahan.
 */
export default function KrsPage() {
  const krs = useApi<KrsData>("/v1/studentv2/krs");
  const [sortBy, setSortBy] = useState<KrsSortKey>("no");
  const sortedItems = useMemo(() => sortKrsItems(krs.data?.items ?? [], sortBy), [krs.data?.items, sortBy]);
  if (krs.loading && !krs.data) return <LoadingState label="Memuat Kartu Rencana Studi" />;

  const notLinked = krs.error?.status === 401;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kartu Rencana Studi (KRS)"
        description="Mata kuliah yang kamu ambil semester ini, total SKS, dan kelompok ruang ujian."
      />

      {notLinked ? (
        <div className="glass-card space-y-4 border-l-4 border-l-[#0369A1] p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-[#0369A1]" aria-hidden="true" />
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-foreground">
                KRS dibaca dari SIAKAD, dan SIAKAD belum tertaut
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-secondary">
                Mira memakai password MyBest untuk login. SIAKAD punya password sendiri,
                jadi kamu perlu menautkannya sekali di Sesi &amp; Keamanan.
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
        </div>
      ) : krs.error ? (
        siakadGateIssue(krs.error) ? (
          <SiakadGateNotice kind={siakadGateIssue(krs.error)!} />
        ) : (
          <ErrorState error={krs.error} onRetry={krs.reload} />
        )
      ) : !krs.data?.items?.length ? (
        <EmptyState
          mascot="/maskot/mura-nilai.png"
          title="Belum ada mata kuliah di KRS semester ini"
          description="KRS muncul di sini setelah kampus menerbitkannya."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Mata kuliah", value: String(krs.data.items.length) },
              { label: "Total SKS", value: String(krs.data.total_sks) },
              { label: "Semester", value: String(krs.data.semester) },
            ].map((stat) => (
              <div key={stat.label} className="glass-card p-4">
                <p className="font-mono text-[11px] uppercase tracking-wider text-secondary">{stat.label}</p>
                <p className="mt-1 font-display text-2xl font-bold tabular-nums text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>

          {krs.data.kelompok_ujian && (
            <p className="glass-card p-4 text-sm text-secondary">
              Kelompok ujian:{" "}
              <span className="font-mono font-bold text-foreground">{krs.data.kelompok_ujian}</span>
            </p>
          )}

          <div className="glass-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stroke bg-[#F7FAFC] p-4">
              <h3 className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                <FileText className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
                Daftar Mata Kuliah
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                {krs.data.items.length > 1 && (
                  <label className="relative flex items-center">
                    <span className="sr-only">Urutkan mata kuliah KRS</span>
                    <ArrowUpDown className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as KrsSortKey)}
                      aria-label="Urutkan mata kuliah KRS"
                      className="min-h-10 rounded-[8px] border border-stroke bg-white py-1.5 pl-8 pr-3 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-[#0369A1]"
                    >
                      {KRS_SORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {krs.data.can_print && (
                  <a
                    href={krs.data.cetak_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${ghostButtonClass} text-xs`}
                  >
                    <Printer className="h-3.5 w-3.5" aria-hidden="true" />
                    Cetak kartu KRS
                  </a>
                )}
              </div>
            </div>

            <ul className="divide-y divide-stroke/60">
              {sortedItems.map((item) => (
                <li key={`${item.kode}-${item.no}`} className="flex items-center justify-between gap-3 p-3.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="shrink-0 font-mono text-[11px] font-bold text-secondary">{item.no}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{item.mata_kuliah}</p>
                      <p className="font-mono text-[11px] text-secondary">{item.kode}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded border border-stroke bg-white px-2 py-0.5 font-mono text-xs font-bold text-foreground">
                    {item.sks} SKS
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
