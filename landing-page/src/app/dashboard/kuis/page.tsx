"use client";

import { useState } from "react";
import {
  HelpCircle,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  BookOpen,
  Search,
  Sparkles,
  Info,
  Layers,
  ChevronRight,
  X,
  FileQuestion,
  Play,
  Maximize2,
  FileDown,
  Loader2,
} from "lucide-react";
import { FocusDialog } from "@/components/FocusDialog";
import { useApi, apiFetch, apiDownload, ApiError } from "@/lib/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  inputClass,
  primaryButtonClass,
  ghostButtonClass,
} from "@/components/dashboard-ui";
import { DosenInfo } from "@/components/DosenInfo";

interface QuizItem {
  id: string;
  kode_mtk?: string | null;
  paket: string;
  dosen?: string | null;
  waktu?: string | null;
  ujian_mulai: string;
  ujian_selesai: string;
  status_aksi?: string | null;
  action_url?: string | null;
  token_ujian?: string | null;
  token_bukti?: string | null;
}

interface QuestionOption {
  key: string;
  text: string;
  id_soal?: string;
  data_jawab?: string;
}

interface QuizQuestionsData {
  csrf_token?: string | null;
  waktu_akhir?: string | null;
  sisa_waktu?: string | null;
  total_soal: number;
  daftar_soal?: { no: number; id_soal: string }[];
  current_soal?: {
    id_soal?: string | null;
    pertanyaan: string;
    opsi: QuestionOption[];
  } | null;
}

function parseSafeDate(dateStr: unknown): Date {
  if (typeof dateStr !== "string") return new Date(NaN);
  const isoLike = dateStr.trim().replace(" ", "T");
  return new Date(isoLike);
}

function formatQuizDate(dateStr: unknown): string {
  if (!dateStr || dateStr === "-" || typeof dateStr !== "string") return "-";
  const d = parseSafeDate(dateStr);
  if (Number.isNaN(d.getTime())) return String(dateStr);
  try {
    return d.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return String(dateStr);
  }
}

function isQuizActive(q: QuizItem | null | undefined): boolean {
  if (!q) return false;
  const status = (q.status_aksi || "").toLowerCase();
  if (
    status.includes("selesai") ||
    status.includes("sudah") ||
    status.includes("lewat") ||
    status.includes("cetak") ||
    Boolean(q.token_bukti) ||
    (typeof q.action_url === "string" && q.action_url.includes("cetak-ujian-pdf"))
  ) {
    return false;
  }
  if (status.includes("mulai") || status.includes("kerjakan") || status.includes("lanjutkan")) {
    return true;
  }

  const now = Date.now();
  const start = parseSafeDate(q.ujian_mulai).getTime();
  const end = parseSafeDate(q.ujian_selesai).getTime();

  if (!Number.isNaN(start) && !Number.isNaN(end)) {
    return now >= start && now <= end;
  }
  return false;
}

export default function KuisPage() {
  const { data, loading, error, reload } = useApi<QuizItem[]>("/v1/elearning/quiz");
  const [filter, setFilter] = useState<"all" | "active" | "completed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // State untuk modal tinjau soal
  const [activeQuizForQuestions, setActiveQuizForQuestions] = useState<QuizItem | null>(null);
  const [questionsData, setQuestionsData] = useState<QuizQuestionsData | null>(null);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState<string | null>(null);

  if (loading) return <LoadingState label="Memuat jadwal kuis perkuliahan" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const quizzes = Array.isArray(data) ? data.filter(Boolean) : [];

  // Filter logika
  const filtered = quizzes.filter((q) => {
    if (!q) return false;
    const matchesFilter =
      filter === "all"
        ? true
        : filter === "active"
        ? isQuizActive(q)
        : !isQuizActive(q) || (q.status_aksi || "").toLowerCase().includes("selesai");

    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      (q.paket || "").toLowerCase().includes(query) ||
      (q.kode_mtk || "").toLowerCase().includes(query) ||
      (q.dosen || "").toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  const totalActive = quizzes.filter(isQuizActive).length;
  const totalCompleted = quizzes.length - totalActive;

  // State unduh bukti kuis PDF resmi
  const [downloadingToken, setDownloadingToken] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  async function handleDownloadProof(token: string, paketName: string) {
    setDownloadingToken(token);
    setDownloadError(null);
    try {
      const filename = `Bukti_Kuis_${paketName.replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      await apiDownload(`/v1/elearning/exams/proof/download?token=${encodeURIComponent(token)}`, filename);
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : "Gagal mengunduh berkas bukti kuis.");
    } finally {
      setDownloadingToken(null);
    }
  }

  async function handleOpenQuestions(q: QuizItem) {
    const examToken =
      q.token_ujian ||
      (q.action_url?.includes("exercise-show/")
        ? q.action_url.split("exercise-show/")[1].split("?")[0].replace(/\/$/, "")
        : null);

    if (!examToken) return;

    setActiveQuizForQuestions({ ...q, token_ujian: examToken });
    setQuestionsLoading(true);
    setQuestionsError(null);
    setQuestionsData(null);

    try {
      const res = await apiFetch<QuizQuestionsData>(
        `/v1/elearning/quiz/questions?token_ujian=${encodeURIComponent(examToken)}`
      );
      setQuestionsData(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal memuat pratinjau butir soal kuis.";
      setQuestionsError(msg);
    } finally {
      setQuestionsLoading(false);
    }
  }

  function handleCloseQuestions() {
    setActiveQuizForQuestions(null);
    setQuestionsData(null);
    setQuestionsError(null);
  }
  function openCbtRoom(
    mode: "live" | "simulasi",
    token?: string | null,
    title?: string,
    isPopup = true
  ) {
    const params = new URLSearchParams();
    params.set("mode", mode);
    if (token) params.set("token", token);
    if (title) params.set("paket", title);
    const url = `/dashboard/kuis/room?${params.toString()}`;

    if (typeof window !== "undefined") {
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        // Pada layar ponsel / tablet, buka langsung di tab saat ini atau tab baru agar bebas blokir popup peramban
        window.location.href = url;
        return;
      }

      if (isPopup) {
        const width = 1200;
        const height = 800;
        const left = Math.max(0, (window.screen.width - width) / 2);
        const top = Math.max(0, (window.screen.height - height) / 2);
        const safeWindowName = `CBT_${mode}_${(token || "sim").replace(/[^a-zA-Z0-9_]/g, "")}`;
        try {
          const popup = window.open(
            url,
            safeWindowName,
            `width=${width},height=${height},top=${top},left=${left},scrollbars=yes,resizable=yes`
          );
          if (popup) {
            popup.focus();
            return;
          }
        } catch {}
      }
      window.open(url, "_blank");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <PageHeader
            title="Kuis & Ujian Online"
            description="Jadwal kuis dan ujian online dari MyBest."
          />
          <a
            href="https://elearning.bsi.ac.id/storage/Panduan%20Kuis%20MyBest%20Mahasiswa.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 self-start px-3.5 py-1.5 rounded-pill border border-stroke bg-white hover:bg-[#F0F7FB] text-[#0369A1] text-xs font-semibold shadow-sm transition-all"
          >
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Panduan Kuis Resmi</span>
            <ExternalLink className="w-3 h-3 text-secondary" aria-hidden="true" />
          </a>
        </div>

        {/* Banner Simulasi Mandiri (Tryout) */}
        <div className="mt-4 p-5 rounded-xl border border-[#0369A1]/30 bg-gradient-to-br from-[#F0F7FB] via-white to-[#F0F7FB] shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#0369A1] text-white">
                TRYOUT MANDIRI
              </span>
              <span className="text-xs font-mono font-semibold text-[#0369A1]">
                30+ Bank Soal Informatika
              </span>
            </div>
            <h2 className="text-base font-display font-bold text-foreground">
              Simulasi Ujian Online CBT
            </h2>
            <p className="text-xs text-secondary leading-relaxed max-w-2xl">
              Uji kesiapan pemahaman materi perkuliahan Anda dengan bank soal pilihan ganda acak, sistem pelindung ujian interaktif, timer otomatis, dan pembahasan skor nilai instan tanpa memengaruhi akun kampus.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openCbtRoom("simulasi", null, "Simulasi Mandiri CBT", true)}
              className="px-4 py-2.5 rounded-pill bg-[#0369A1] hover:bg-[#0284C7] text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
              <span>Mulai Tryout (Popup CBT)</span>
            </button>
            <button
              type="button"
              onClick={() => openCbtRoom("simulasi", null, "Simulasi Mandiri CBT", false)}
              className="px-3.5 py-2.5 rounded-pill border border-stroke bg-white hover:bg-[#F0F7FB] text-secondary hover:text-foreground text-xs font-semibold transition-all flex items-center gap-1.5"
              title="Buka di tab peramban penuh"
            >
              <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Tab Penuh</span>
            </button>
          </div>
        </div>
        {/* Filter Pills */}
        <div className="px-seg">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-seg-btn ${
              filter === "all"
                ? "px-seg-on"
                : ""
            }`}
          >
            Semua ({quizzes.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={`px-seg-btn ${
              filter === "active"
                ? "px-seg-on"
                : ""
            }`}
          >
            Tersedia ({totalActive})
          </button>
          <button
            type="button"
            onClick={() => setFilter("completed")}
            className={`px-seg-btn ${
              filter === "completed"
                ? "px-seg-on"
                : ""
            }`}
          >
            Riwayat ({totalCompleted})
          </button>
        </div>
      </div>

      {/* Top Stat Cards: di HP angkanya sudah ada di tab filter, jadi kartu ini hanya tampil di layar lebar */}
      <div className="hidden sm:grid sm:grid-cols-3 gap-4">
        <div className="glass-card p-5 border-l-4 border-l-[#0369A1]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-secondary">
              Total Kuis Terdaftar
            </span>
            <HelpCircle className="w-5 h-5 text-[#0369A1]" aria-hidden="true" />
          </div>
          <p className="mt-2 text-3xl font-display font-bold text-foreground">
            {quizzes.length}
          </p>
          <p className="mt-1 text-xs text-secondary">
            Terdeteksi pada portal MyBest semester ini
          </p>
        </div>

        <div className="glass-card p-5 border-l-4 border-l-[#0F766E]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-secondary">
              Kuis Aktif / Terbuka
            </span>
            <Clock className="w-5 h-5 text-[#0F766E]" aria-hidden="true" />
          </div>
          <p className="mt-2 text-3xl font-display font-bold text-foreground">
            {totalActive}
          </p>
          <p className="mt-1 text-xs text-secondary">
            Bisa dikerjakan sebelum batas waktu berakhir
          </p>
        </div>

        <div className="glass-card p-5 border-l-4 border-l-[#3B5A70]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-secondary">
              Riwayat Kuis Selesai
            </span>
            <CheckCircle2 className="w-5 h-5 text-[#3B5A70]" aria-hidden="true" />
          </div>
          <p className="mt-2 text-3xl font-display font-bold text-foreground">
            {totalCompleted}
          </p>
          <p className="mt-1 text-xs text-secondary">
            Kuis yang telah dikerjakan atau lewat jadwal
          </p>
        </div>
      </div>
      {/* Banner Error Download Bukti */}
      {downloadError && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center justify-between gap-2">
          <span>{downloadError}</span>
          <button
            type="button"
            onClick={() => setDownloadError(null)}
            className="text-rose-500 hover:text-rose-700 font-bold px-2 py-0.5"
          >
            ✕
          </button>
        </div>
      )}

      {/* Search Input */}
      {quizzes.length > 0 && (
        <div className="glass-card p-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" aria-hidden="true" />
            <input
              type="text"
              aria-label="Cari berdasarkan paket kuis, kode mata kuliah, atau nama dosen"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari berdasarkan paket kuis, kode mata kuliah, atau nama dosen..."
              className={`${inputClass} pl-10`}
            />
          </div>
        </div>
      )}

      {/* Main Quizzes List */}
      {filtered.length === 0 ? (
        <EmptyState
          mascot="/maskot/mura-kuis.png"
          title={
            searchQuery
              ? "Tidak ada kuis yang sesuai dengan pencarian."
              : filter === "active"
              ? "Tidak ada kuis aktif saat ini."
              : "Belum ada jadwal kuis terdaftar di MyBest."
          }
          description={
            filter === "active"
              ? "Semua kuis perkuliahan telah selesai dikerjakan atau belum memasuki jadwal pembukaan dosen."
              : "Kuis latihan biasanya dibuka dosen pada pertemuan tertentu (misal pertemuan 3, 5, 9, atau pra-UTS)."
          }
        />
      ) : (
        <div className="grid gap-4">
          {filtered.map((q, idx) => {
            if (!q) return null;
            const active = isQuizActive(q);
            const statusText = q.status_aksi || (active ? "Buka Kuis" : "Selesai");
            const itemKey = q.id || `quiz-${idx}-${q.kode_mtk || ""}`;

            return (
              <div
                key={itemKey}
                className="glass-card p-6 border-l-4 transition-all duration-200 hover:shadow-md"
                style={{
                  borderLeftColor: active ? "#0369A1" : "#D9E5ED",
                }}
              >
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[11px] font-mono font-bold uppercase bg-[#F0F7FB] text-[#0369A1] border border-stroke">
                        <BookOpen className="w-3 h-3" aria-hidden="true" />
                        {q.kode_mtk || "KUIS"}
                      </span>

                      {active ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[11px] font-bold bg-[#F0F7FB] text-[#0F766E] border border-[#0F766E]/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E] animate-pulse" />
                          Sedang Dibuka
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[11px] font-bold bg-[#F7FAFC] text-secondary border border-stroke">
                          <CheckCircle2 className="w-3 h-3 text-secondary" aria-hidden="true" />
                          {statusText}
                        </span>
                      )}

                      {q.waktu && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-[11px] font-mono text-secondary bg-white/60 border border-stroke">
                          <Clock className="w-3 h-3" aria-hidden="true" />
                          Durasi: {q.waktu}
                        </span>
                      )}
                    </div>

                    <h2 className="text-lg font-display font-bold text-foreground">
                      {q.paket || "Kuis"}
                    </h2>

                    {q.dosen && (
                      <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-secondary">
                        <span>Dosen Pengampu:</span>
                        <DosenInfo kode={q.dosen} />
                      </div>
                    )}

                    {/* Timeline Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 text-xs text-secondary">
                      <div className="flex items-center gap-2 bg-[#F7FAFC] px-3 py-2 rounded-sm border border-stroke/60">
                        <Calendar className="w-3.5 h-3.5 text-[#0369A1] shrink-0" aria-hidden="true" />
                        <div>
                          <span className="text-[10px] uppercase font-mono block text-secondary">Mulai:</span>
                          <span className="font-medium text-foreground">{formatQuizDate(q.ujian_mulai)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 bg-[#F7FAFC] px-3 py-2 rounded-sm border border-stroke/60">
                        <Clock className="w-3.5 h-3.5 text-[#BE123C] shrink-0" aria-hidden="true" />
                        <div>
                          <span className="text-[10px] uppercase font-mono block text-secondary">Batas Akhir:</span>
                          <span className="font-medium text-foreground">{formatQuizDate(q.ujian_selesai)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0">
                    {active ? (
                      (() => {
                        const tokenUjian =
                          q.token_ujian ||
                          (typeof q.action_url === "string" && (q.action_url.includes("exercise-show") || q.action_url.includes("halaman-ujian"))
                            ? q.action_url.replace(/\/$/, "").split("/").pop()?.split("?")[0] || null
                            : null);

                        return (
                          <>
                            <button
                              type="button"
                              onClick={() => openCbtRoom("live", tokenUjian, q.paket || "Kuis", true)}
                              className="px-4 py-2 rounded-md bg-[#0369A1] hover:bg-[#0284C7] text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                              <span>Kerjakan di CBT Room</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => openCbtRoom("live", tokenUjian, q.paket || "Kuis", false)}
                              className={`${ghostButtonClass} text-xs py-1.5 text-center flex items-center justify-center gap-1`}
                            >
                              <Maximize2 className="w-3 h-3 text-secondary" aria-hidden="true" />
                              <span>Layar Penuh</span>
                            </button>
                            {tokenUjian && (
                              <button
                                type="button"
                                onClick={() => handleOpenQuestions(q)}
                                className={`${ghostButtonClass} text-xs py-1.5 text-center flex items-center justify-center gap-1`}
                              >
                                <FileQuestion className="w-3.5 h-3.5 text-[#0369A1]" aria-hidden="true" />
                                <span>Pratinjau Soal</span>
                              </button>
                            )}
                          </>
                        );
                      })()
                    ) : (
                      (() => {
                        const tokenBukti =
                          q.token_bukti ||
                          (typeof q.action_url === "string" && q.action_url.includes("cetak-ujian-pdf")
                            ? q.action_url.replace(/\/$/, "").split("/").pop()?.split("?")[0] || null
                            : null);

                        if (tokenBukti) {
                          const isDownloading = downloadingToken === tokenBukti;
                          return (
                            <button
                              type="button"
                              onClick={() => handleDownloadProof(tokenBukti, q.paket || "Kuis")}
                              disabled={isDownloading}
                              className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                            >
                              {isDownloading ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                                  <span>Mengunduh Bukti...</span>
                                </>
                              ) : (
                                <>
                                  <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
                                  <span>Cetak Bukti Ujian (PDF)</span>
                                </>
                              )}
                            </button>
                          );
                        }

                        return (
                          <div className="text-center sm:text-right px-2 py-1 text-xs text-secondary font-medium">
                            {statusText || "Ujian Telah Selesai"}
                          </div>
                        );
                      })()
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Guide Card */}
      <div className="glass-card p-6 border-l-4 border-l-[#0369A1]/60">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-[#0369A1] shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-2 text-xs sm:text-sm text-secondary leading-relaxed">
            <h3 className="font-display font-bold text-foreground text-sm">
              Petunjuk Pelaksanaan Kuis & Ujian MyBest
            </h3>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>
                <strong>Satu Kali Percobaan</strong>: Sebagian besar kuis latihan MyBest hanya mengizinkan 1 kali pengerjaan. Pastikan kamu siap sebelum memulai.
              </li>
              <li>
                <strong>Timer Otomatis</strong>: Penghitung mundur waktu ujian berjalan sejak tombol &apos;Mulai&apos; ditekan pada portal resmi.
              </li>
              <li>
                <strong>Stabilitas Jaringan</strong>: Gunakan koneksi internet stabil saat submit jawaban pilihan ganda untuk menghindari kegagalan sinkronisasi nilai.
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Modal / Drawer Pratinjau Butir Soal */}
      {activeQuizForQuestions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#072033]/50 backdrop-blur-sm transition-opacity"
            onClick={handleCloseQuestions}
            aria-hidden="true"
          />

          <FocusDialog
            open={!!activeQuizForQuestions}
            onClose={handleCloseQuestions}
            labelledBy="preview-quiz-title"
            className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-lg shadow-2xl z-10 flex flex-col overflow-hidden border border-stroke"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-stroke bg-[#F7FAFC]">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-[#0369A1]">
                  Pratinjau Soal Kuis
                </span>
                <h3 id="preview-quiz-title" className="text-base font-display font-bold text-foreground">
                  {activeQuizForQuestions.paket}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseQuestions}
                aria-label="Tutup jendela"
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-sm text-secondary hover:text-foreground hover:bg-[#F0F7FB]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {questionsLoading ? (
                <LoadingState label="Mengambil butir pertanyaan dari MyBest" />
              ) : questionsError ? (
                <div className="p-4 bg-[#FFF1F2] border border-[#BE123C]/20 rounded-md text-[#BE123C] text-xs">
                  <p className="font-bold">Gagal memuat pratinjau soal:</p>
                  <p className="mt-1">{questionsError}</p>
                  <p className="mt-2 text-secondary">
                    Ujian ini mungkin belum aktif di akun kamu atau membutuhkan token pengerjaan langsung di portal MyBest.
                  </p>
                </div>
              ) : questionsData ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-[#F0F7FB] border border-stroke rounded-md text-xs">
                    <span className="font-semibold text-foreground">
                      Total Butir Soal Terdeteksi: <strong className="font-mono text-[#0369A1]">{questionsData.total_soal} Soal</strong>
                    </span>
                    {questionsData.sisa_waktu && (
                      <span className="font-mono text-secondary">
                        Sisa Waktu: {questionsData.sisa_waktu}
                      </span>
                    )}
                  </div>

                  {questionsData.current_soal ? (
                    <div className="space-y-4 border border-stroke p-4 rounded-md bg-white">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#0369A1]/10 text-[#0369A1]">
                        Pertanyaan Aktif
                      </span>
                      <p className="text-sm font-semibold text-foreground leading-relaxed whitespace-pre-wrap">
                        {questionsData.current_soal.pertanyaan || "Pertanyaan pilihan ganda"}
                      </p>

                      <div className="space-y-2 pt-2">
                        {questionsData.current_soal.opsi.map((opsi) => (
                          <div
                            key={opsi.key}
                            className="flex items-start gap-3 p-3 rounded-md border border-stroke/70 bg-[#F7FAFC]/60 text-xs text-foreground hover:bg-[#F0F7FB]"
                          >
                            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-[#0369A1] text-white font-mono font-bold text-[10px] shrink-0 mt-0.5">
                              {opsi.key}
                            </span>
                            <span className="leading-relaxed">{opsi.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-[#F7FAFC] border border-stroke rounded-md text-center text-xs text-secondary">
                      Struktur lembar soal belum dapat ditampilkan secara inline. Silakan buka langsung di portal resmi MyBest.
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-stroke bg-[#F7FAFC] flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseQuestions}
                className={`${ghostButtonClass} text-xs py-2`}
              >
                Tutup
              </button>
              {activeQuizForQuestions.token_ujian && (
                <button
                  type="button"
                  onClick={() => {
                    const tok = activeQuizForQuestions.token_ujian;
                    const pkt = activeQuizForQuestions.paket || "Kuis";
                    handleCloseQuestions();
                    openCbtRoom("live", tok, pkt, true);
                  }}
                  className={`${primaryButtonClass} text-xs py-2 flex items-center gap-1.5`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" aria-hidden="true" />
                  <span>Mulai Kerjakan di CBT Room</span>
                </button>
              )}
            </div>
          </FocusDialog>
        </div>
      )}
    </div>
  );
}
