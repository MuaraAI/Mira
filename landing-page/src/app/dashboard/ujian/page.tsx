"use client";

import { useState } from "react";
import {
  Award,
  ExternalLink,
  FileText,
  AlertCircle,
  Calendar,
  Clock,
  Timer,
  FileQuestion,
  Download,
  Printer,
  Building2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useApi, apiDownload, apiFetch, ApiError } from "@/lib/api";
import { safeExternalHref } from "@/lib/links";
import { LockedSiakadCard } from "@/components/LockedSiakadCard";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/dashboard-ui";

interface ExamItem {
  mata_kuliah: string;
  waktu?: string | null;
  kode_dosen?: string | null;
  kode_mtk?: string | null;
  jenis_mtk?: string | null;
  sks?: string | null;
  no_ruang?: string | null;
  tanggal_ujian?: string | null;
  durasi_menit?: string | null;
  soal_pg?: string | null;
  soal_essay?: string | null;
  status?: string | null;
  can_enter?: boolean;
  cetak_bukti_url?: string | null;
  token_bukti?: string | null;
}

interface ExamTypesResponse {
  types: { key: string; label: string }[];
}

interface ExamScheduleResponse {
  identity: {
    nim?: string | null;
    nama?: string | null;
  };
  exams: ExamItem[];
}

interface SiakadExamData {
  title?: string;
  jadwal_online_url?: string | null;
  soal_offline_url?: string | null;
  gate?: string | null;
}

const DEFAULT_TYPES = [
  { key: "uts", label: "UTS" },
  { key: "uas", label: "UAS" },
  { key: "latihan", label: "Latihan" },
  { key: "uts-pengganti", label: "UTS Pengganti" },
  { key: "uas-pengganti", label: "UAS Pengganti" },
  { key: "her", label: "HER" },
];

function formatExamDate(rawDate?: string | null): string {
  if (!rawDate) return "Belum ditentukan";
  const parts = rawDate.split(" - ").map((s) => s.trim());
  if (parts.length === 2 && parts[0] === parts[1]) {
    return parts[0];
  }
  return rawDate;
}


export default function UjianPage() {
  const [selectedType, setSelectedType] = useState<string>("uts");
  const [downloadingToken, setDownloadingToken] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);

  // 1. Data jenis ujian & jadwal ujian daring dari ujiankampusa.bsi.ac.id
  const typesApi = useApi<ExamTypesResponse>("/v1/elearning/exams");
  const scheduleApi = useApi<ExamScheduleResponse>(`/v1/elearning/exams/${selectedType}`);

  // 2. Data kartu ujian & soal offline dari SIAKAD (students.bsi.ac.id)
  const utsSiakad = useApi<SiakadExamData>("/v1/studentv2/uts");
  const uasSiakad = useApi<SiakadExamData>("/v1/studentv2/uas");

  const isSiakad401 = utsSiakad.error?.status === 401 || uasSiakad.error?.status === 401;
  const currentSiakad = selectedType === "uas" ? uasSiakad.data : utsSiakad.data;

  const rawTypes = typesApi.data?.types;
  const examTypes = rawTypes && rawTypes.length > 0 ? rawTypes : DEFAULT_TYPES;
  const exams = scheduleApi.data?.exams ?? [];
  const currentTypeLabel = (
    examTypes.find((t) => t.key === selectedType)?.label || selectedType.toUpperCase()
  )
    .replace(/^Jadwal\s+/i, "")
    .trim();

  async function handleDownloadProof(token: string, courseName: string) {
    setDownloadingToken(token);
    setDownloadError(null);
    try {
      const filename = `Bukti_Ujian_${courseName.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      await apiDownload(`/v1/elearning/exams/proof/download?token=${encodeURIComponent(token)}`, filename);
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : "Gagal mengunduh berkas bukti ujian.");
    } finally {
      setDownloadingToken(null);
    }
  }
  const [printingKrs, setPrintingKrs] = useState(false);

  async function handlePrintKrs() {
    setPrintingKrs(true);
    setDownloadError(null);
    try {
      const res = await apiFetch<{ html: string }>("/v1/studentv2/krs/print?format=json");
      if (!res?.html) {
        throw new Error("Gagal mengambil lembar cetak Kartu Ujian (KRS) dari SIAKAD.");
      }
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(res.html);
        printWindow.document.close();
      } else {
        const blob = new Blob([res.html], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "Cetak_Kartu_Ujian_KRS.html";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Gagal memproses cetak Kartu Ujian (KRS).");
    } finally {
      setPrintingKrs(false);
    }
  }

  const reloadAll = () => {
    typesApi.reload();
    scheduleApi.reload();
    utsSiakad.reload();
    uasSiakad.reload();
  };

  return (
    <div className="space-y-6">
      {/* Mode MyBest Banner jika SIAKAD belum terhubung */}
      {isSiakad401 && (
        <div className="px-card bg-amber-50 border-2 border-dashed border-amber-300 p-4 text-xs text-amber-950">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-200/80 px-1.5 py-0.5">
                Mode MyBest
              </span>
              <span>
                Jadwal ujian daring ditampilkan langsung dari ujiankampusa. Hubungkan akun SIAKAD untuk mengunduh soal ujian offline resmi.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setConnectOpen((v) => !v)}
              className="font-mono font-bold text-amber-900 underline hover:text-amber-700"
            >
              {connectOpen ? "Tutup Form" : "Hubungkan SIAKAD"}
            </button>
          </div>
          {connectOpen && (
            <div className="mt-4 pt-4 border-t border-amber-200">
              <LockedSiakadCard
                title="Hubungkan Akun SIAKAD"
                description="Masukkan password SIAKAD (students.bsi.ac.id) untuk membuka kartu ujian UTS/UAS dan berkas soal resmi."
                onConnected={() => {
                  setConnectOpen(false);
                  reloadAll();
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Header Halaman */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <PageHeader
          title="Jadwal & Kartu Ujian (UTS & UAS)"
          description="Jadwal pelaksanaan ujian online resmi dari ujiankampusa.bsi.ac.id dan kartu ujian kampus UBSI."
        />
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!isSiakad401 && (
            <button
              type="button"
              onClick={handlePrintKrs}
              disabled={printingKrs}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0369A1] hover:bg-[#075985] shadow-sm transition-all disabled:opacity-50 rounded-sm"
            >
              <Printer className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{printingKrs ? "Menyiapkan Kartu..." : "Cetak Kartu Ujian Fisik (KRS)"}</span>
            </button>
          )}
          <a
            href="https://ujiankampusa.bsi.ac.id/jadwal"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-semibold text-[#0369A1] hover:text-[#075985] bg-[#EAF3F9] hover:bg-[#D9E5ED] border border-[#CFE2EE] transition-all rounded-sm"
          >
            <span>Portal ujiankampusa</span>
            <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
          </a>
        </div>
      </div>

      {/* Tab Switcher Jenis Ujian */}
      <div className="w-full">
        <div className="px-seg flex overflow-x-auto no-scrollbar gap-1">
          {examTypes.map((t) => {
            const active = selectedType === t.key;
            const label = t.label.replace(/^Jadwal\s+/i, "").trim();
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setSelectedType(t.key)}
                className={`px-seg-btn whitespace-nowrap text-xs font-semibold ${
                  active ? "px-seg-on" : ""
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Download Error Alert */}
      {downloadError && (
        <div className="p-3 bg-rose-50 border-l-4 border-rose-500 text-xs text-rose-900 flex items-center justify-between gap-3">
          <span>{downloadError}</span>
          <button
            type="button"
            onClick={() => setDownloadError(null)}
            className="font-bold underline text-rose-700"
          >
            Tutup
          </button>
        </div>
      )}

      {/* SIAKAD Status Gate (jika ada info dari SIAKAD) */}
      {currentSiakad?.gate && (
        <div className="flex items-start gap-3 border-l-4 border-[#F59E0B] bg-[#FEF3F9] px-4 py-3" role="status">
          <AlertCircle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#92400E]">
              Pemberitahuan SIAKAD Kampus
            </p>
            <p className="mt-0.5 text-xs font-medium text-[#78350F]">{currentSiakad.gate}</p>
          </div>
        </div>
      )}

      {/* SIAKAD Download Soal Bar (jika link soal tersedia) */}
      {safeExternalHref(currentSiakad?.soal_offline_url) && (
        <div className="glass-card p-4 border-l-4 border-l-[#0F766E] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <FileText className="w-4 h-4 text-[#0F766E] shrink-0" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold text-foreground">Berkas Soal Ujian Resmi Tersedia</p>
              <p className="text-[11px] text-secondary">Unduh lembar soal ujian offline yang disediakan oleh panitia kampus.</p>
            </div>
          </div>
          <a
            href={safeExternalHref(currentSiakad?.soal_offline_url)!}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F766E] hover:bg-[#0D655E] text-white text-xs font-semibold shadow-sm transition-all shrink-0"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Unduh Soal Ujian (PDF)</span>
          </a>
        </div>
      )}

      {/* Konten Utama Jadwal Ujian */}
      {scheduleApi.loading ? (
        <LoadingState label="Memuat jadwal ujian dari ujiankampusa" />
      ) : scheduleApi.error ? (
        <ErrorState error={scheduleApi.error} onRetry={() => scheduleApi.reload()} />
      ) : exams.length === 0 ? (
        <EmptyState
          title={`Belum Ada Jadwal Ujian untuk ${currentTypeLabel}`}
          description="Jadwal mata kuliah untuk jenis ujian ini belum dibuka atau belum dijadwalkan oleh panitia ujian kampus UBSI."
        />
      ) : (
        <div className="space-y-4">
          {/* Summary Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-[#0369A1] bg-[#0369A1]/10 px-2 py-0.5">
                {currentTypeLabel}
              </span>
              <span className="text-xs font-semibold text-secondary">
                {exams.length} Mata Kuliah Terjadwal
              </span>
            </div>
            {scheduleApi.data?.identity?.nama && (
              <span className="font-mono text-[11px] text-secondary">
                {scheduleApi.data.identity.nim} · {scheduleApi.data.identity.nama}
              </span>
            )}
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {exams.map((exam, idx) => {
              const isDownloading = downloadingToken === exam.token_bukti;
              const hasProof = Boolean(exam.token_bukti || exam.cetak_bukti_url);
              const formattedDate = formatExamDate(exam.tanggal_ujian);

              return (
                <div
                  key={`${exam.kode_mtk || idx}-${exam.mata_kuliah}`}
                  className="glass-card p-5 border-l-4 border-l-[#0369A1] flex flex-col justify-between gap-4 hover:border-l-[#075985] hover:shadow-md transition-all"
                >
                  <div className="space-y-3">
                    {/* Header Badges */}
                    <div className="flex flex-wrap items-center justify-between gap-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {exam.no_ruang && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono font-bold bg-[#EAF3F9] text-[#0369A1] border border-[#CFE2EE]">
                            <Building2 className="w-3 h-3" aria-hidden="true" />
                            <span>{exam.no_ruang}</span>
                          </span>
                        )}
                        {exam.sks && (
                          <span className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-[#F7FAFC] text-secondary border border-stroke">
                            {exam.sks} SKS
                          </span>
                        )}
                      </div>
                      {exam.kode_mtk && (
                        <span className="text-[10px] font-mono font-bold text-secondary">
                          {exam.kode_mtk}
                        </span>
                      )}
                    </div>

                    {/* Mata Kuliah Title */}
                    <div>
                      <h3 className="text-base font-display font-bold text-foreground leading-snug">
                        {exam.mata_kuliah}
                      </h3>
                      {exam.jenis_mtk && (
                        <p className="text-[10px] font-mono uppercase tracking-wider text-secondary mt-0.5">
                          {exam.jenis_mtk}
                        </p>
                      )}
                    </div>

                    {/* Metadata List */}
                    <div className="space-y-1.5 pt-2 border-t border-stroke/60 text-xs">
                      {/* Tanggal */}
                      <div className="flex items-center gap-2 text-foreground">
                        <Calendar className="w-3.5 h-3.5 text-[#0369A1] shrink-0" aria-hidden="true" />
                        <span className="font-semibold">{formattedDate}</span>
                      </div>

                      {/* Jam / Waktu */}
                      {exam.waktu && (
                        <div className="flex items-center gap-2 text-secondary">
                          <Clock className="w-3.5 h-3.5 text-secondary shrink-0" aria-hidden="true" />
                          <span className="font-mono text-[11px]">{exam.waktu}</span>
                        </div>
                      )}

                      {/* Durasi & Soal */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-secondary text-[11px]">
                        {exam.durasi_menit && (
                          <div className="flex items-center gap-1.5">
                            <Timer className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span>{exam.durasi_menit} Menit</span>
                          </div>
                        )}
                        {(exam.soal_pg || exam.soal_essay) && (
                          <div className="flex items-center gap-1.5">
                            <FileQuestion className="w-3 h-3 shrink-0" aria-hidden="true" />
                            <span>
                              {exam.soal_pg ? `${exam.soal_pg} PG` : null}
                              {exam.soal_essay && exam.soal_essay !== "0"
                                ? ` · ${exam.soal_essay} Essay`
                                : null}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions & Status Footer */}
                  <div className="pt-3 border-t border-stroke/60 flex flex-wrap items-center justify-between gap-2">
                    {/* Status Pill */}
                    {exam.can_enter ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-300">
                        <Sparkles className="w-3 h-3 text-emerald-600" aria-hidden="true" />
                        <span>{exam.status || "Sedang Dibuka"}</span>
                      </span>
                    ) : hasProof ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold bg-sky-50 text-sky-800 border border-sky-300">
                        <CheckCircle2 className="w-3 h-3 text-sky-600" aria-hidden="true" />
                        <span>Selesai Dikerjakan</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono text-secondary bg-[#F7FAFC] border border-stroke">
                        <span>{exam.status || "Terjadwal"}</span>
                      </span>
                    )}

                    {/* Action Button: Download Proof PDF */}
                    {exam.token_bukti ? (
                      <button
                        type="button"
                        onClick={() => handleDownloadProof(exam.token_bukti!, exam.mata_kuliah)}
                        disabled={isDownloading}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#EAF3F9] hover:bg-[#D9E5ED] text-[#0369A1] border border-[#CFE2EE] transition-all disabled:opacity-50"
                      >
                        <Download className="w-3 h-3" aria-hidden="true" />
                        <span>{isDownloading ? "Mengunduh..." : "Bukti PDF"}</span>
                      </button>
                    ) : exam.can_enter ? (
                      <a
                        href="https://ujiankampusa.bsi.ac.id/jadwal"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold bg-[#0369A1] hover:bg-[#075985] text-white shadow-sm transition-all"
                      >
                        <span>Kerjakan Ujian</span>
                        <ExternalLink className="w-3 h-3" aria-hidden="true" />
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tata Tertib Pelaksanaan Ujian Kampus */}
      <div className="p-5 bg-[#F0F7FB] border border-[#D9E5ED]">
        <h3 className="text-xs font-mono font-bold uppercase text-[#0369A1] tracking-wider mb-2 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-[#0369A1]" aria-hidden="true" />
          Tata Tertib Pelaksanaan Ujian Kampus UBSI
        </h3>
        <ul className="text-xs text-secondary space-y-1.5 list-disc list-inside leading-relaxed">
          <li>Wajib membawa Kartu Tanda Mahasiswa (KTM) atau Kartu Ujian fisik/digital saat ujian offline di kampus.</li>
          <li>Ujian daring MyBest (ujiankampusa) wajib dikerjakan sesuai rentang jadwal dan waktu server yang ditetapkan panitia ujian.</li>
          <li>Pastikan perangkat terhubung ke koneksi internet stabil sebelum menekan tombol Mulai Ujian.</li>
          <li>Unduh dan simpan berkas Bukti Ujian (PDF) segera setelah kamu menyelesaikan pengerjaan soal ujian online.</li>
          <li>Keterlambatan pada ujian online tidak mendapatkan kompensasi perpanjangan waktu pengerjaan.</li>
        </ul>
      </div>
    </div>
  );
}
