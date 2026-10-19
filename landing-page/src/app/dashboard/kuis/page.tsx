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
} from "lucide-react";
import { useApi, apiFetch } from "@/lib/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  inputClass,
  primaryButtonClass,
  ghostButtonClass,
} from "@/components/dashboard-ui";

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

function formatQuizDate(dateStr: string): string {
  if (!dateStr || dateStr === "-") return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("id-ID", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isQuizActive(q: QuizItem): boolean {
  const status = (q.status_aksi || "").toLowerCase();
  if (status.includes("selesai") || status.includes("sudah")) return false;
  if (status.includes("mulai") || status.includes("kerjakan") || status.includes("lanjutkan")) return true;

  const now = new Date().getTime();
  const start = new Date(q.ujian_mulai).getTime();
  const end = new Date(q.ujian_selesai).getTime();

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

  const quizzes = data ?? [];

  // Filter logika
  const filtered = quizzes.filter((q) => {
    const matchesFilter =
      filter === "all"
        ? true
        : filter === "active"
        ? isQuizActive(q)
        : !isQuizActive(q) || (q.status_aksi || "").toLowerCase().includes("selesai");

    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      q.paket.toLowerCase().includes(query) ||
      (q.kode_mtk || "").toLowerCase().includes(query) ||
      (q.dosen || "").toLowerCase().includes(query);

    return matchesFilter && matchesSearch;
  });

  const totalActive = quizzes.filter(isQuizActive).length;
  const totalCompleted = quizzes.length - totalActive;

  async function handleOpenQuestions(q: QuizItem) {
    if (!q.token_ujian) {
      if (q.action_url) {
        window.open(q.action_url, "_blank", "noopener,noreferrer");
      }
      return;
    }

    setActiveQuizForQuestions(q);
    setQuestionsLoading(true);
    setQuestionsError(null);
    setQuestionsData(null);

    try {
      const res = await apiFetch<QuizQuestionsData>(
        `/v1/elearning/quiz/questions?token_ujian=${encodeURIComponent(q.token_ujian)}`
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Kuis & Ujian Online"
          description="Jadwal kuis latihan, ujian daring, dan evaluasi berkala MyBest Elearning UBSI."
        />

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F0F7FB] border border-stroke rounded-pill self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-pill transition-all ${
              filter === "all"
                ? "bg-[#0369A1] text-white shadow-sm"
                : "text-secondary hover:text-foreground"
            }`}
          >
            Semua ({quizzes.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("active")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-pill transition-all ${
              filter === "active"
                ? "bg-[#0369A1] text-white shadow-sm"
                : "text-secondary hover:text-foreground"
            }`}
          >
            Tersedia ({totalActive})
          </button>
          <button
            type="button"
            onClick={() => setFilter("completed")}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-pill transition-all ${
              filter === "completed"
                ? "bg-[#0369A1] text-white shadow-sm"
                : "text-secondary hover:text-foreground"
            }`}
          >
            Riwayat ({totalCompleted})
          </button>
        </div>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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

      {/* Search Input */}
      {quizzes.length > 0 && (
        <div className="glass-card p-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" aria-hidden="true" />
            <input
              type="text"
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
          {filtered.map((q) => {
            const active = isQuizActive(q);
            const statusText = q.status_aksi || (active ? "Buka Kuis" : "Selesai");

            return (
              <div
                key={q.id}
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
                      {q.paket}
                    </h2>

                    {q.dosen && (
                      <p className="text-xs text-secondary">
                        Dosen Pengampu: <span className="font-semibold text-foreground">{q.dosen}</span>
                      </p>
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
                    {q.action_url ? (
                      <a
                        href={q.action_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${primaryButtonClass} text-xs py-2`}
                      >
                        <ExternalLink className="w-4 h-4" aria-hidden="true" />
                        Buka di MyBest
                      </a>
                    ) : (
                      <a
                        href="https://elearning.bsi.ac.id/exercise"
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${primaryButtonClass} text-xs py-2`}
                      >
                        <ExternalLink className="w-4 h-4" aria-hidden="true" />
                        Portal MyBest
                      </a>
                    )}

                    {q.token_ujian && (
                      <button
                        type="button"
                        onClick={() => handleOpenQuestions(q)}
                        className={`${ghostButtonClass} text-xs py-2`}
                      >
                        <FileQuestion className="w-4 h-4 text-[#0369A1]" aria-hidden="true" />
                        Pratinjau Soal
                      </button>
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
                <strong>Satu Kali Percobaan</strong>: Sebagian besar kuis latihan MyBest hanya mengizinkan 1 kali pengerjaan. Pastikan Anda siap sebelum memulai.
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

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-quiz-title"
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
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-sm text-secondary hover:text-foreground hover:bg-[#F0F7FB]"
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
                    Ujian ini mungkin belum aktif di akun Anda atau membutuhkan token pengerjaan langsung di portal MyBest.
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
              {activeQuizForQuestions.action_url && (
                <a
                  href={activeQuizForQuestions.action_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${primaryButtonClass} text-xs py-2`}
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  Buka Lembar Ujian MyBest
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
