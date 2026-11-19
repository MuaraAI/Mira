"use client";

import Link from "next/link";
import { ExternalLink, FileText, Link2, Lock } from "lucide-react";
import { useApi } from "@/lib/api";
import { ghostButtonClass, primaryButtonClass } from "@/components/dashboard-ui";

interface ExamRoomData {
  title: string;
  jadwal_online_url: string | null;
  soal_offline_url: string | null;
  gate: string | null;
}

const EXAM_ROWS = [
  { key: "uts", label: "UTS" },
  { key: "uas", label: "UAS" },
] as const;

/**
 * Ruang ujian SIAKAD: tautan jadwal online dan berkas soal offline.
 *
 * SIAKAD hanya aktif setelah user menautkannya di Sesi & Keamanan, jadi 401
 * berarti "belum tertaut" dan ditampilkan sebagai ajakan, bukan error.
 */
export function ExamRoomLinks() {
  const uts = useApi<ExamRoomData>("/v1/studentv2/uts");
  const uas = useApi<ExamRoomData>("/v1/studentv2/uas");

  const notLinked = uts.error?.status === 401 || uas.error?.status === 401;
  const rows = [
    { label: "UTS", data: uts.data, error: uts.error, reload: uts.reload },
    { label: "UAS", data: uas.data, error: uas.error, reload: uas.reload },
  ];

  if (notLinked) {
    return (
      <section className="glass-card space-y-4 border-l-4 border-l-[#0369A1] p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <Link2 className="mt-0.5 h-5 w-5 shrink-0 text-[#0369A1]" aria-hidden="true" />
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-foreground">
              Kartu ujian dan soal offline ada di SIAKAD
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-secondary">
              Jadwal ujian daring di bawah tetap dari MyBest. Untuk ruang ujian resmi, kartu
              peserta, dan berkas soal offline, tautkan SIAKAD sekali di Sesi &amp; Keamanan.
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

  return (
    <section className="glass-card overflow-hidden">
      <div className="border-b border-stroke bg-[#F7FAFC] p-4">
        <h2 className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
          <FileText className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
          Kartu &amp; Ruang Ujian SIAKAD
        </h2>
        <p className="mt-1 text-xs text-secondary">
          Jadwal resmi ruang ujian dan berkas soal offline dari portal kampus.
        </p>
      </div>

      <ul className="divide-y divide-stroke/60">
        {rows.map((row) => (
          <li key={row.label} className="space-y-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
                {row.label}
              </span>
              {!row.data && !row.error && (
                <span className="font-mono text-[11px] text-secondary">memuat...</span>
              )}
            </div>

            {row.error && row.error.status !== 401 ? (
              <button
                type="button"
                onClick={row.reload}
                className="text-xs font-semibold text-[#0369A1] hover:underline"
              >
                Gagal memuat {row.label}. Coba lagi.
              </button>
            ) : row.data?.gate ? (
              <p className="flex items-start gap-2 text-xs leading-relaxed text-[#92400E]">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {row.data.gate}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {row.data?.jadwal_online_url && (
                <a
                  href={row.data.jadwal_online_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${ghostButtonClass} text-xs`}
                >
                  Lihat jadwal {row.label}
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
              {row.data?.soal_offline_url && (
                <a
                  href={row.data.soal_offline_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${ghostButtonClass} text-xs`}
                >
                  Soal {row.label} offline
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              )}
              {!row.data?.jadwal_online_url && !row.data?.soal_offline_url && !row.data?.gate && !row.error && row.data && (
                <p className="text-xs text-secondary">
                  Kampus belum merilis jadwal atau soal {row.label}.
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
