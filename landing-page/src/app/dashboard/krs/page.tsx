"use client";

import { useState } from "react";
import {
  FileSpreadsheet,
  Printer,
  Download,
  Award,
  Calendar,
  AlertCircle,
  Building2,
  CheckCircle2,
} from "lucide-react";
import { useApi, apiFetch } from "@/lib/api";
import { LockedSiakadCard } from "@/components/LockedSiakadCard";
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
  can_print?: boolean;
  cetak_url?: string | null;
}

export default function KrsPage() {
  const { data, loading, error, reload } = useApi<KrsData>("/v1/studentv2/krs");
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState<string | null>(null);

  if (loading) return <LoadingState label="Memuat Kartu Rencana Studi (KRS)" />;
  if (error) {
    if (error.status === 401) {
      return (
        <div className="space-y-6">
          <PageHeader
            title="Kartu Rencana Studi (KRS)"
            description="Mata kuliah yang kamu ambil semester ini, kelompok ruang ujian, dan lembar kartu ujian fisik resmi."
          />
          <LockedSiakadCard
            title="KRS Terkunci"
            description="Data KRS (Kartu Rencana Studi) diambil langsung dari SIAKAD. Hubungkan akun SIAKAD untuk melihat daftar mata kuliah aktif, total SKS semester, dan mencetak kartu ujian fisik."
            onConnected={reload}
          />
        </div>
      );
    }
    return <ErrorState error={error} onRetry={reload} />;
  }

  const krs = data;
  const items = krs?.items ?? [];
  const totalSks = krs?.total_sks ?? 0;
  const semester = krs?.semester ?? 1;
  const kelompok = krs?.kelompok_ujian || "-";

  const handlePrintKrs = async (download = false) => {
    setPrinting(true);
    setPrintError(null);
    try {
      const res = await apiFetch<{ html: string }>("/v1/studentv2/krs/print?format=json");
      if (!res?.html) {
        throw new Error("Gagal mengambil lembar cetak KRS dari server.");
      }

      if (download) {
        const blob = new Blob([res.html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Cetak_KRS_${kelompok.replace(/[^a-zA-Z0-9_-]/g, "_")}.html`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else {
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.open();
          printWindow.document.write(res.html);
          printWindow.document.close();
          setTimeout(() => {
            try {
              printWindow.focus();
              printWindow.print();
            } catch {}
          }, 350);
        } else {
          // Jika popup diblokir peramban, unduh berkas HTML
          const blob = new Blob([res.html], { type: "text/html;charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `Cetak_KRS_${kelompok.replace(/[^a-zA-Z0-9_-]/g, "_")}.html`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }
    } catch (err) {
      setPrintError(err instanceof Error ? err.message : "Terjadi kesalahan saat memproses cetak KRS.");
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <PageHeader
          title="Kartu Rencana Studi (KRS)"
          description="Mata kuliah yang kamu ambil semester ini, kelompok ruang ujian, dan lembar kartu ujian fisik resmi."
        />
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => handlePrintKrs(false)}
            disabled={printing || items.length === 0}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-[#0369A1] hover:bg-[#075985] text-white text-xs font-bold shadow-sm transition-all disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{printing ? "Menyiapkan Dokumen..." : "Cetak KRS / Kartu Ujian"}</span>
          </button>
          <button
            type="button"
            onClick={() => handlePrintKrs(true)}
            disabled={printing || items.length === 0}
            title="Unduh Berkas HTML Siap Cetak"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-pill border border-stroke bg-white hover:bg-[#F0F7FB] text-secondary hover:text-foreground text-xs font-semibold transition-all disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Simpan Berkas</span>
          </button>
        </div>
      </div>

      {printError && (
        <div className="p-3 bg-rose-50 border-l-4 border-rose-500 text-xs text-rose-900 flex items-center justify-between gap-3">
          <span>{printError}</span>
          <button
            type="button"
            onClick={() => setPrintError(null)}
            className="font-bold underline text-rose-700"
          >
            Tutup
          </button>
        </div>
      )}

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

      {/* Kartu Ujian Fisik Notice */}
      <div className="p-4 bg-[#F0F7FB] border border-[#CFE2EE] flex items-start gap-3">
        <Award className="w-5 h-5 text-[#0369A1] shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-xs text-secondary leading-relaxed">
          <p className="font-bold text-foreground">
            Lembar KRS Berfungsi Sebagai Kartu Peserta Ujian Fisik
          </p>
          <p className="mt-0.5">
            Dokumen Cetak KRS resmi memuat barcode Security Print Key, kelompok ruang ujian, dan kolom paraf pengawas untuk UTS & UAS. Cetak dan bawa lembar ini saat mengikuti ujian di kampus.
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
