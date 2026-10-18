"use client";

import { useState } from "react";
import {
  GraduationCap,
  Award,
  Layers,
  FileSpreadsheet,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
import { useApi } from "@/lib/api";
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

export default function NilaiPage() {
  const khsApi = useApi<KhsData>("/v1/studentv2/khs");
  const gradesApi = useApi<GradeItem[]>("/v1/studentv2/grades");
  const [activeTab, setActiveTab] = useState<"khs" | "murni">("khs");

  if (khsApi.loading && gradesApi.loading) {
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Nilai & Kartu Hasil Studi (KHS)"
          description="Transkrip nilai resmi dari sistem SIAKAD UBSI. Pantau IPK, mutu, dan rincian komponen nilai."
        />

        <div className="flex items-center gap-1.5 p-1 bg-[#F0F7FB] border border-stroke rounded-pill self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab("khs")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-pill transition-all ${
              activeTab === "khs"
                ? "bg-[#0369A1] text-white shadow-sm"
                : "text-secondary hover:text-foreground"
            }`}
          >
            Kartu KHS
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("murni")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-pill transition-all ${
              activeTab === "murni"
                ? "bg-[#0369A1] text-white shadow-sm"
                : "text-secondary hover:text-foreground"
            }`}
          >
            Rincian Nilai Murni
          </button>
        </div>
      </div>

      {/* Top Academic Stat Cards */}
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

      {/* Tab 1: KHS Table */}
      {activeTab === "khs" && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-stroke flex items-center justify-between">
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
              <table className="w-full min-w-[640px] text-sm text-left">
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
                      <td className="px-4 py-3 text-secondary font-mono text-xs">
                        {item.no}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-[#0369A1] text-xs">
                        {item.kode}
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {item.mata_kuliah}
                      </td>
                      <td className="px-4 py-3 text-center text-secondary">
                        {item.sks}
                      </td>
                      <td className="px-4 py-3 text-center">
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
                      <td className="px-4 py-3 text-center font-mono font-semibold text-foreground">
                        {item.mutu}
                      </td>
                      <td className="px-4 py-3 text-xs text-secondary">
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
          <div className="p-4 border-b border-stroke flex items-center justify-between">
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
              <table className="w-full min-w-[720px] text-sm text-left">
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
                      <td className="px-4 py-3 font-semibold text-foreground">
                        <div>
                          <span>{g.nama}</span>
                          <span className="block text-[10px] font-mono text-[#0369A1]">
                            {g.kode}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center text-secondary font-mono">
                        {g.sks}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-secondary">
                        {g.absen ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-secondary">
                        {g.tugas ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-secondary">
                        {g.uts ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-center font-mono text-secondary">
                        {g.uas ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-center font-mono font-bold text-foreground">
                        {g.total ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-center">
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
    </div>
  );
}
