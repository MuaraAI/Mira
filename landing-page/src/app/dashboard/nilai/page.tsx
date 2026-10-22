"use client";

import { useState } from "react";
import {
  GraduationCap,
  Award,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  TrendingUp,
  BookOpen,
  CheckSquare,
  Clock,
  MessageSquare,
} from "lucide-react";
import { useApi } from "@/lib/api";
import { gradeValue } from "@/lib/assignments";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/dashboard-ui";

interface KhsItem {
  no: number;
  kode: string;
  mata_kuliah: string;
  sks: number;
  nilai: string;
  mutu: number;
  keterangan?: string;
}

interface KhsData {
  items: KhsItem[];
  total_mutu: number;
  total_sks: number;
  ipk: number;
}

interface GradeItem {
  id: string;
  kode: string;
  nama: string;
  sks: number;
  uts: number | null;
  uas: number | null;
  tugas: number | null;
  absen: number | null;
  total: number | null;
  grade: string | null;
}

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

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);

/** MyBest memakai 0 untuk tugas yang belum diperiksa dosen: hitung ulang supaya 0 tidak dianggap nilai. */
function normalizeElearningGrades(data: ElearningGradesData | null): ElearningGradesData | null {
  if (!data) return data;
  const perPertemuan = (data.per_pertemuan ?? []).map((pert) => {
    const graded = pert.items.map((item) => gradeValue(item.nilai)).filter((v): v is number => v !== null);
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
  const graded = items.map((item) => gradeValue(item.nilai)).filter((v): v is number => v !== null);
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
  const khsApi = useApi<KhsData>("/v1/studentv2/khs");
  const gradesApi = useApi<GradeItem[]>("/v1/studentv2/grades");
  const elearningRaw = useApi<ElearningGradesData>("/v1/elearning/grades");
  const elearningApi = { ...elearningRaw, data: normalizeElearningGrades(elearningRaw.data) };
  const [activeTab, setActiveTab] = useState<"khs" | "murni" | "elearning">("khs");

  if (khsApi.loading && gradesApi.loading && elearningApi.loading) {
    return <LoadingState label="Memuat transkrip nilai akademik" />;
  }
  if (khsApi.error) return <ErrorState error={khsApi.error} onRetry={khsApi.reload} />;

  const khs = khsApi.data;
  const khsItems = khs?.items ?? [];
  const rawGrades = gradesApi.data ?? [];

  const ipkFormatted = khs?.ipk ? khs.ipk.toFixed(2) : "0.00";
  const totalSks = khs?.total_sks ?? 0;
  const totalMutu = khs?.total_mutu ? khs.total_mutu.toFixed(1) : "0.0";

  return (
    <div className="space-y-6">
      <div className="flex flex-col">
        <PageHeader
          title="Nilai & Kartu Hasil Studi (KHS)"
          description="IPK, nilai per mata kuliah, dan rincian komponennya dari SIAKAD."
        />

        <div className="w-full">
          <div className="px-seg">
          <button
            type="button"
            onClick={() => setActiveTab("khs")}
            className={`px-seg-btn ${
              activeTab === "khs"
                ? "px-seg-on"
                : ""
            }`}
          >
            Kartu KHS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("murni")}
            className={`px-seg-btn ${
              activeTab === "murni"
                ? "px-seg-on"
                : ""
            }`}
          >
            Rincian Nilai Murni
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("elearning")}
            className={`px-seg-btn ${
              activeTab === "elearning"
                ? "px-seg-on"
                : ""
            }`}
          >
            Nilai Tugas MyBest
          </button>
          </div>
        </div>
      </div>

      {/* Top Academic Stat Cards */}
      {activeTab === "elearning" ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card p-5 border-l-4 border-l-[#0369A1]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-secondary">
                Rata-Rata Skor Tugas
              </span>
              <Award className="w-5 h-5 text-[#0369A1]" aria-hidden="true" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-display font-bold text-foreground">
                {elearningApi.data?.rata_nilai != null ? elearningApi.data.rata_nilai.toFixed(1) : "-"}
              </span>
              <span className="text-xs text-secondary font-mono">/ 100</span>
            </div>
            <p className="mt-1 text-xs text-secondary">
              Rata-rata seluruh tugas yang telah dinilai
            </p>
          </div>

          <div className="glass-card p-5 border-l-4 border-l-[#0F766E]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-secondary">
                Tugas Sudah Dinilai
              </span>
              <CheckSquare className="w-5 h-5 text-[#0F766E]" aria-hidden="true" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-display font-bold text-foreground">
                {elearningApi.data?.sudah_dinilai ?? 0}
              </span>
              <span className="text-xs text-secondary">
                / {elearningApi.data?.total_tugas ?? 0} Tugas
              </span>
            </div>
            <p className="mt-1 text-xs text-secondary">
              {elearningApi.data?.belum_dinilai
                ? `${elearningApi.data.belum_dinilai} tugas menunggu penilaian dosen`
                : "Semua tugas terkumpul telah dinilai"}
            </p>
          </div>

          <div className="glass-card p-5 border-l-4 border-l-[#3B5A70]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-secondary">
                Rentang Skor
              </span>
              <TrendingUp className="w-5 h-5 text-[#3B5A70]" aria-hidden="true" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-sm font-semibold text-foreground">
                Tertinggi: <strong className="font-mono text-[#0F766E]">{elearningApi.data?.nilai_max ?? "-"}</strong>
              </span>
              <span className="text-xs text-secondary">|</span>
              <span className="text-sm font-semibold text-foreground">
                Terendah: <strong className="font-mono text-[#BE123C]">{elearningApi.data?.nilai_min ?? "-"}</strong>
              </span>
            </div>
            <p className="mt-1 text-xs text-secondary">
              Berdasarkan evaluasi tugas pertemuan
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass-card p-5 border-l-4 border-l-[#0369A1]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-secondary">
                Indeks Prestasi Kumulatif
              </span>
              <GraduationCap className="w-5 h-5 text-[#0369A1]" aria-hidden="true" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-display font-bold text-foreground">
                {ipkFormatted}
              </span>
              <span className="text-xs text-secondary font-mono">/ 4.00</span>
            </div>
            <p className="mt-1 text-xs text-secondary">
              Berdasarkan KHS semester berjalan
            </p>
          </div>

          <div className="glass-card p-5 border-l-4 border-l-[#0F766E]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-secondary">
                Total SKS Lulus
              </span>
              <Layers className="w-5 h-5 text-[#0F766E]" aria-hidden="true" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-display font-bold text-foreground">
                {totalSks}
              </span>
              <span className="text-xs text-secondary">SKS</span>
            </div>
            <p className="mt-1 text-xs text-secondary">
              Beban sks terdaftar di sistem
            </p>
          </div>

          <div className="glass-card p-5 border-l-4 border-l-[#3B5A70]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-secondary">
                Total Bobot Mutu
              </span>
              <TrendingUp className="w-5 h-5 text-[#3B5A70]" aria-hidden="true" />
            </div>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-display font-bold text-foreground">
                {totalMutu}
              </span>
              <span className="text-xs text-secondary">Poin</span>
            </div>
            <p className="mt-1 text-xs text-secondary">
              Akumulasi (SKS x Bobot Mutu)
            </p>
          </div>
        </div>
      )}

      {/* Tab 1: KHS Table */}
      {activeTab === "khs" && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-stroke flex items-center justify-between flex-wrap gap-x-4 gap-y-1">
            <h3 className="font-display font-bold text-sm text-foreground">
              Tabel Kartu Hasil Studi (KHS)
            </h3>
            <span className="text-xs text-secondary font-mono">
              Total {khsItems.length} Mata Kuliah
            </span>
          </div>

          {khsItems.length === 0 ? (
            <div className="p-8 text-center text-secondary text-sm">
              Belum ada nilai KHS yang dirilis untuk semester ini.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="px-table w-full md:min-w-[640px] text-sm text-left">
                <thead>
                  <tr className="border-b border-stroke bg-[#F7FAFC] text-xs font-mono uppercase tracking-wider text-secondary">
                    <th scope="col" className="px-4 py-3">No</th>
                    <th scope="col" className="px-4 py-3">Kode</th>
                    <th scope="col" className="px-4 py-3">Mata Kuliah</th>
                    <th scope="col" className="px-4 py-3 text-center">SKS</th>
                    <th scope="col" className="px-4 py-3 text-center">Nilai Huruf</th>
                    <th scope="col" className="px-4 py-3 text-center">Bobot Mutu</th>
                    <th scope="col" className="px-4 py-3">Keterangan</th>
                  </tr>
                </thead>
                <tbody>
                  {khsItems.map((item) => (
                    <tr
                      key={item.kode || item.no}
                      className="border-b border-stroke/60 last:border-0 hover:bg-[#F0F7FB]/50"
                    >
                      <td data-label="No" className="px-4 py-3 text-secondary font-mono text-xs">
                        {item.no}
                      </td>
                      <td data-label="Kode" className="px-4 py-3 font-mono font-bold text-[#0369A1] text-xs">
                        {item.kode}
                      </td>
                      <td data-label="Mata Kuliah" data-primary="" className="px-4 py-3 font-semibold text-foreground">
                        {item.mata_kuliah}
                      </td>
                      <td data-label="SKS" className="px-4 py-3 text-center text-secondary">
                        {item.sks}
                      </td>
                      <td data-label="Nilai Huruf" className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs ${
                            item.nilai === "A"
                              ? "bg-[#0F766E]/15 text-[#0F766E]"
                              : item.nilai === "B"
                              ? "bg-[#0369A1]/15 text-[#0369A1]"
                              : item.nilai === "C"
                              ? "bg-[#9A3412]/15 text-[#9A3412]"
                              : "bg-[#BE123C]/15 text-[#BE123C]"
                          }`}
                        >
                          {item.nilai || "-"}
                        </span>
                      </td>
                      <td data-label="Bobot Mutu" className="px-4 py-3 text-center font-mono font-semibold text-foreground">
                        {item.mutu}
                      </td>
                      <td data-label="Keterangan" className="px-4 py-3 text-xs text-secondary">
                        {item.keterangan || "LULUS"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Nilai Murni Breakdown */}
      {activeTab === "murni" && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-stroke flex items-center justify-between flex-wrap gap-x-4 gap-y-1">
            <h3 className="font-display font-bold text-sm text-foreground">
              Rincian Komponen Nilai Murni
            </h3>
            <span className="text-xs text-secondary font-mono">
              Bobot Absen (20%), Tugas (25%), UTS (25%), UAS (30%)
            </span>
          </div>

          {rawGrades.length === 0 ? (
            <div className="p-8 text-center text-secondary text-sm">
              Belum ada rincian nilai murni yang dirilis dari dosen.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="px-table w-full md:min-w-[720px] text-sm text-left">
                <thead>
                  <tr className="border-b border-stroke bg-[#F7FAFC] text-xs font-mono uppercase tracking-wider text-secondary">
                    <th scope="col" className="px-4 py-3">Mata Kuliah</th>
                    <th scope="col" className="px-4 py-3 text-center">SKS</th>
                    <th scope="col" className="px-4 py-3 text-center">Absen</th>
                    <th scope="col" className="px-4 py-3 text-center">Tugas</th>
                    <th scope="col" className="px-4 py-3 text-center">UTS</th>
                    <th scope="col" className="px-4 py-3 text-center">UAS</th>
                    <th scope="col" className="px-4 py-3 text-center">Total Akhir</th>
                    <th scope="col" className="px-4 py-3 text-center">Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {rawGrades.map((g) => (
                    <tr
                      key={g.id || g.kode}
                      className="border-b border-stroke/60 last:border-0 hover:bg-[#F0F7FB]/50"
                    >
                      <td data-label="Mata Kuliah" data-primary="" className="px-4 py-3 font-semibold text-foreground">
                        <div>
                          <span>{g.nama}</span>
                          <span className="block text-[10px] font-mono text-[#0369A1]">
                            {g.kode}
                          </span>
                        </div>
                      </td>
                      <td data-label="SKS" className="px-4 py-3 text-center text-secondary font-mono">
                        {g.sks}
                      </td>
                      <td data-label="Absen" className="px-4 py-3 text-center font-mono text-secondary">
                        {g.absen ?? "-"}
                      </td>
                      <td data-label="Tugas" className="px-4 py-3 text-center font-mono text-secondary">
                        {g.tugas ?? "-"}
                      </td>
                      <td data-label="UTS" className="px-4 py-3 text-center font-mono text-secondary">
                        {g.uts ?? "-"}
                      </td>
                      <td data-label="UAS" className="px-4 py-3 text-center font-mono text-secondary">
                        {g.uas ?? "-"}
                      </td>
                      <td data-label="Total Akhir" className="px-4 py-3 text-center font-mono font-bold text-foreground">
                        {g.total ?? "-"}
                      </td>
                      <td data-label="Grade" className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-xs ${
                            g.grade === "A"
                              ? "bg-[#0F766E]/15 text-[#0F766E]"
                              : g.grade === "B"
                              ? "bg-[#0369A1]/15 text-[#0369A1]"
                              : g.grade === "C"
                              ? "bg-[#9A3412]/15 text-[#9A3412]"
                              : "bg-[#BE123C]/15 text-[#BE123C]"
                          }`}
                        >
                          {g.grade || "-"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Elearning MyBest Grades */}
      {activeTab === "elearning" && (
        <div className="space-y-6">
          {elearningApi.loading ? (
            <LoadingState label="Memuat rekapitulasi nilai tugas MyBest" />
          ) : elearningApi.error ? (
            <ErrorState error={elearningApi.error} onRetry={elearningApi.reload} />
          ) : !elearningApi.data || elearningApi.data.total_tugas === 0 ? (
            <EmptyState
              title="Belum ada riwayat tugas yang dinilai."
              description="Nilai tugas muncul di sini setelah kamu kumpulin tugas dan dosen selesai menilai."
            />
          ) : (
            <>
              {/* Ringkasan Rata-Rata Per Matkul */}
              {Object.keys(elearningApi.data.per_matkul || {}).length > 0 && (
                <div className="glass-card p-5">
                  <h3 className="font-display font-bold text-sm text-foreground mb-3 flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-[#0369A1]" aria-hidden="true" />
                    Rata-Rata Nilai Tugas Per Mata Kuliah
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {Object.entries(elearningApi.data.per_matkul).map(([kode, val]) => (
                      <div
                        key={kode}
                        className="p-3.5 rounded-sm bg-[#F7FAFC] border border-stroke/70 flex items-center justify-between"
                      >
                        <div>
                          <span className="text-xs font-mono font-bold text-[#0369A1]">
                            {kode}
                          </span>
                          <span className="block text-[11px] text-secondary">
                            {val.total_tugas} Tugas Dinilai
                          </span>
                        </div>
                        <span className="text-lg font-mono font-bold text-foreground bg-white px-2.5 py-1 rounded border border-stroke">
                          {val.rata_nilai.toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rincian Per Pertemuan */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-[#0369A1]" aria-hidden="true" />
                    Rincian Penilaian Tugas Per Pertemuan
                  </h3>
                  <span className="text-xs text-secondary font-mono">
                    Total {elearningApi.data.per_pertemuan.length} Pertemuan Terdaftar
                  </span>
                </div>

                {elearningApi.data.per_pertemuan.map((pert) => (
                  <div key={pert.pertemuan} className="glass-card overflow-hidden">
                    <div className="p-4 bg-[#F7FAFC] border-b border-stroke flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="inline-block px-2.5 py-1 rounded text-xs font-mono font-bold bg-[#0369A1] text-white">
                          Pertemuan {pert.pertemuan}
                        </span>
                        <span className="text-xs text-secondary">
                          {pert.total_tugas} Tugas ({pert.sudah_dinilai} dinilai)
                        </span>
                      </div>
                      {pert.rata_nilai != null && (
                        <span className="text-xs font-mono font-semibold text-[#0F766E] bg-[#F0F7FB] px-2.5 py-0.5 rounded-pill border border-[#0F766E]/20">
                          Rata-rata: {pert.rata_nilai.toFixed(1)}
                        </span>
                      )}
                    </div>

                    <div className="divide-y divide-stroke/60">
                      {pert.items.map((item) => {
                        const numericScore = gradeValue(item.nilai) ?? 0;
                        const hasScore = gradeValue(item.nilai) !== null;

                        return (
                          <div
                            key={item.id || item.judul}
                            className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-[#F0F7FB]/40 transition-colors"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono font-bold uppercase text-[#0369A1] bg-[#F0F7FB] px-2 py-0.5 rounded">
                                  {item.kode || "MATKUL"}
                                </span>
                                <span className="text-xs font-semibold text-secondary">
                                  {item.mata_kuliah}
                                </span>
                              </div>
                              <h4 className="text-sm font-bold text-foreground">
                                {item.judul}
                              </h4>
                              {item.tanggal_kumpul && (
                                <p className="text-[11px] text-secondary flex items-center gap-1">
                                  <Clock className="w-3 h-3" aria-hidden="true" />
                                  Dikumpulkan: {item.tanggal_kumpul}
                                </p>
                              )}
                              {item.komentar_dosen && (
                                <p className="text-xs text-secondary bg-[#F7FAFC] p-2.5 rounded border border-stroke/60 flex items-start gap-1.5 mt-2">
                                  <MessageSquare className="w-3.5 h-3.5 text-[#0369A1] shrink-0 mt-0.5" aria-hidden="true" />
                                  <span>Catatan Dosen: &quot;{item.komentar_dosen}&quot;</span>
                                </p>
                              )}
                            </div>

                            <div className="shrink-0 self-start sm:self-center">
                              {hasScore ? (
                                <div className="text-right">
                                  <span
                                    className={`inline-flex items-center justify-center px-3 py-1 rounded-pill font-mono font-bold text-sm ${
                                      numericScore >= 80
                                        ? "bg-[#0F766E]/15 text-[#0F766E] border border-[#0F766E]/20"
                                        : numericScore >= 70
                                        ? "bg-[#0369A1]/15 text-[#0369A1] border border-[#0369A1]/20"
                                        : "bg-[#9A3412]/15 text-[#9A3412] border border-[#9A3412]/20"
                                    }`}
                                  >
                                    {numericScore}
                                  </span>
                                  <span className="block text-[10px] text-secondary font-mono text-center mt-0.5">
                                    Nilai
                                  </span>
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-[11px] font-semibold bg-[#F7FAFC] text-secondary border border-stroke">
                                  <Clock className="w-3 h-3" aria-hidden="true" />
                                  Menunggu Koreksi
                                </span>
                              )}
                            </div>
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
      )}
    </div>
  );
}
