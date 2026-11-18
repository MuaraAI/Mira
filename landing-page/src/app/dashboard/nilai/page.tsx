"use client";

import { BookOpen, FileSpreadsheet } from "lucide-react";
import { useApi } from "@/lib/api";
import { gradeValue } from "@/lib/assignments";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/dashboard-ui";
import { SiaKadLockedCard } from "@/components/SiaKadLockedCard";

interface ElearningSubmissionItem {
  id: string;
  kode?: string;
  mata_kuliah?: string;
  judul: string;
  pertemuan?: string;
  tanggal_kumpul?: string;
  nilai?: number | string | null;
  komentar_dosen?: string | null;
}

interface ElearningPertemuanGrade {
  pertemuan: string;
  total_tugas: number;
  sudah_dinilai: number;
  belum_dinilai: number;
  rata_nilai: number | null;
  nilai_max: number | null;
  nilai_min: number | null;
  items: ElearningSubmissionItem[];
}

interface ElearningGradesData {
  total_tugas: number;
  sudah_dinilai: number;
  belum_dinilai: number;
  rata_nilai: number | null;
  nilai_max: number | null;
  nilai_min: number | null;
  per_matkul: Record<string, { total_tugas: number; rata_nilai: number }>;
  per_pertemuan: ElearningPertemuanGrade[];
}

const average = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

/** MyBest memakai 0 untuk tugas yang belum diperiksa dosen: hitung ulang supaya 0 tidak dianggap nilai. */
function normalizeElearningGrades(data: ElearningGradesData | null): ElearningGradesData | null {
  if (!data) return data;
  const perPertemuan = (data.per_pertemuan ?? []).map((pert) => {
    const graded = pert.items
      .map((item) => gradeValue(item.nilai))
      .filter((v): v is number => v !== null);
    return {
      ...pert,
      sudah_dinilai: graded.length,
      belum_dinilai: pert.items.length - graded.length,
      rata_nilai: average(graded),
      nilai_max: graded.length ? Math.max(...graded) : null,
      nilai_min: graded.length ? Math.min(...graded) : null,
    };
  });
  const items = perPertemuan.flatMap((pert) => pert.items);
  const graded = items
    .map((item) => gradeValue(item.nilai))
    .filter((v): v is number => v !== null);
  const perMatkul: ElearningGradesData["per_matkul"] = {};
  for (const item of items) {
    const value = gradeValue(item.nilai);
    if (value === null) continue;
    const key = item.kode || "-";
    const current = perMatkul[key] ?? { total_tugas: 0, rata_nilai: 0 };
    perMatkul[key] = { total_tugas: current.total_tugas + 1, rata_nilai: current.rata_nilai + value };
  }
  for (const key of Object.keys(perMatkul)) perMatkul[key].rata_nilai /= perMatkul[key].total_tugas;
  return {
    total_tugas: items.length,
    sudah_dinilai: graded.length,
    belum_dinilai: items.length - graded.length,
    rata_nilai: average(graded),
    nilai_max: graded.length ? Math.max(...graded) : null,
    nilai_min: graded.length ? Math.min(...graded) : null,
    per_matkul: perMatkul,
    per_pertemuan: perPertemuan,
  };
}

export default function NilaiPage() {
  const gradesRaw = useApi<ElearningGradesData>("/v1/elearning/grades");
  const grades = normalizeElearningGrades(gradesRaw.data);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transkrip Nilai Akademik"
        description="Rekap nilai tugas dan kuis dari MyBest. Nilai akhir, KHS, dan IPK ada di SIAKAD."
      />

      <SiaKadLockedCard
        title="Nilai akhir, KHS, dan KRS ada di SIAKAD"
        description="Mira tidak lagi menyimpan data nilai akhir, IPK, atau KRS. Buka students.bsi.ac.id untuk melihatnya langsung di portal kampus."
      />

      {gradesRaw.loading ? (
        <LoadingState label="Memuat rekapitulasi nilai tugas MyBest" />
      ) : gradesRaw.error ? (
        <ErrorState error={gradesRaw.error} onRetry={gradesRaw.reload} />
      ) : !grades || grades.total_tugas === 0 ? (
        <EmptyState
          mascot="/maskot/mura-nilai.png"
          title="Belum ada riwayat tugas yang dinilai."
          description="Nilai tugas muncul di sini setelah kamu mengumpulkan tugas dan dosen selesai menilai."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total tugas", value: String(grades.total_tugas) },
              { label: "Sudah dinilai", value: String(grades.sudah_dinilai) },
              { label: "Rata-rata", value: grades.rata_nilai?.toFixed(1) ?? "-" },
              { label: "Nilai tertinggi", value: grades.nilai_max?.toFixed(1) ?? "-" },
            ].map((stat) => (
              <div key={stat.label} className="glass-card p-4">
                <p className="font-mono text-[11px] uppercase tracking-wider text-secondary">{stat.label}</p>
                <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
              </div>
            ))}
          </div>

          {Object.keys(grades.per_matkul).length > 0 && (
            <div className="glass-card p-5">
              <h3 className="mb-3 flex items-center gap-2 font-display text-sm font-bold text-foreground">
                <BookOpen className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
                Rata-Rata Nilai Tugas Per Mata Kuliah
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(grades.per_matkul).map(([kode, val]) => (
                  <div
                    key={kode}
                    className="flex items-center justify-between rounded-sm border border-stroke/70 bg-[#F7FAFC] p-3.5"
                  >
                    <div>
                      <span className="font-mono text-xs font-bold text-[#0369A1]">{kode}</span>
                      <span className="block text-[11px] text-secondary">
                        {val.total_tugas} tugas dinilai
                      </span>
                    </div>
                    <span className="rounded border border-stroke bg-white px-2.5 py-1 font-mono text-lg font-bold text-foreground">
                      {val.rata_nilai.toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                <FileSpreadsheet className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
                Rincian Penilaian Tugas Per Pertemuan
              </h3>
              <span className="font-mono text-xs text-secondary">
                Total {grades.per_pertemuan.length} pertemuan terdaftar
              </span>
            </div>

            {grades.per_pertemuan.map((pert) => (
              <div key={pert.pertemuan} className="glass-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stroke bg-[#F7FAFC] p-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-block rounded bg-[#0369A1] px-2.5 py-1 font-mono text-xs font-bold text-white">
                      Pertemuan {pert.pertemuan}
                    </span>
                    <span className="text-xs text-secondary">
                      {pert.total_tugas} tugas ({pert.sudah_dinilai} dinilai)
                    </span>
                  </div>
                  {pert.rata_nilai != null && (
                    <span className="rounded-pill border border-[#0F766E]/20 bg-[#F0F7FB] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#0F766E]">
                      Rata-rata: {pert.rata_nilai.toFixed(1)}
                    </span>
                  )}
                </div>

                <div className="divide-y divide-stroke/60">
                  {pert.items.map((item) => {
                    const score = gradeValue(item.nilai);
                    return (
                      <div key={item.id || item.judul} className="flex flex-wrap items-center justify-between gap-2 p-3.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">{item.judul}</p>
                          <p className="font-mono text-[11px] text-secondary">
                            {[item.kode, item.mata_kuliah, item.tanggal_kumpul].filter(Boolean).join(" · ") || "-"}
                          </p>
                          {item.komentar_dosen && (
                            <p className="mt-1 text-xs text-secondary">{item.komentar_dosen}</p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded border px-2.5 py-1 font-mono text-sm font-bold ${
                            score === null
                              ? "border-stroke bg-[#F7FAFC] text-secondary"
                              : "border-[#0F766E]/30 bg-[#F0F7FB] text-[#0F766E]"
                          }`}
                        >
                          {score === null ? "Belum dinilai" : score.toFixed(0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
