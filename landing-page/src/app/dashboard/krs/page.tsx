"use client";

import { FileSpreadsheet, Layers, Award, Calendar } from "lucide-react";
import { useApi } from "@/lib/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
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
  kelompok_ujian?: string | null;
}

export default function KrsPage() {
  const { data, loading, error, reload } = useApi<KrsData>("/v1/studentv2/krs");

  if (loading) return <LoadingState label="Memuat Kartu Rencana Studi (KRS)" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const krs = data;
  const items = krs?.items ?? [];
  const totalSks = krs?.total_sks ?? 0;
  const semester = krs?.semester ?? 1;
  const kelompok = krs?.kelompok_ujian || "-";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kartu Rencana Studi (KRS)"
        description="Mata kuliah yang kamu ambil semester ini, dari SIAKAD."
      />

      {/* Info Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 border-l-4 border-l-[#0369A1]">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-secondary">
            Semester Aktif
          </span>
          <p className="mt-2 text-2xl font-display font-bold text-foreground">
            Semester {semester}
          </p>
          <p className="mt-1 text-xs text-secondary">
            Tahun Akademik Berjalan
          </p>
        </div>

        <div className="glass-card p-5 border-l-4 border-l-[#0F766E]">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-secondary">
            Beban Belajar
          </span>
          <p className="mt-2 text-2xl font-display font-bold text-foreground">
            {totalSks} SKS
          </p>
          <p className="mt-1 text-xs text-secondary">
            Total SKS Semester Ini
          </p>
        </div>

        <div className="glass-card p-5 border-l-4 border-l-[#3B5A70]">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-secondary">
            Kelompok Ujian
          </span>
          <p className="mt-2 text-2xl font-display font-bold text-foreground font-mono">
            {kelompok}
          </p>
          <p className="mt-1 text-xs text-secondary">
            Grup Ruang Ujian Kampus
          </p>
        </div>
      </div>

      {/* Table KRS */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-stroke flex items-center justify-between flex-wrap gap-x-4 gap-y-1">
          <h2 className="font-display font-bold text-sm text-foreground">
            Daftar Mata Kuliah KRS
          </h2>
          <span className="text-xs text-secondary font-mono">
            {items.length} Mata Kuliah Terdaftar
          </span>
        </div>

        {items.length === 0 ? (
          <EmptyState
            title="Belum ada data KRS untuk semester ini."
            description="Pastikan KRS sudah diisi, atau tanya Dosen PA."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="px-table w-full md:min-w-[600px] text-sm text-left">
              <thead>
                <tr className="border-b border-stroke bg-[#F7FAFC] text-xs font-mono uppercase tracking-wider text-secondary">
                  <th scope="col" className="px-4 py-3">No</th>
                  <th scope="col" className="px-4 py-3">Kode MTK</th>
                  <th scope="col" className="px-4 py-3">Mata Kuliah</th>
                  <th scope="col" className="px-4 py-3 text-center">SKS</th>
                  <th scope="col" className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.kode || item.no}
                    className="border-b border-stroke/60 last:border-0 hover:bg-[#F0F7FB]/50"
                  >
                    <td data-label="No" className="px-4 py-3 text-secondary font-mono text-xs">
                      {item.no}
                    </td>
                    <td data-label="Kode MTK" className="px-4 py-3 font-mono font-bold text-[#0369A1] text-xs">
                      {item.kode}
                    </td>
                    <td data-label="Mata Kuliah" data-primary="" className="px-4 py-3 font-semibold text-foreground">
                      {item.mata_kuliah}
                    </td>
                    <td data-label="SKS" className="px-4 py-3 text-center font-mono text-secondary">
                      {item.sks}
                    </td>
                    <td data-label="Status" className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill bg-[#0F766E]/10 text-[#0F766E] border border-[#0F766E]/20 text-xs font-semibold">
                        Disetujui
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
