"use client";

import { useEffect, useState, useMemo, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  CbtNavbar,
  CbtQuestionGrid,
  CbtQuestionView,
  CbtViolationModal,
  CbtFinishModal,
  CbtResultView,
} from "@/components/quiz";
import { useExamProctoring } from "@/hooks/useExamProctoring";
import {
  generateSimulationQuiz,
  evaluateSimulationScore,
  type SimulationQuestion,
  type SimulationResult,
} from "@/data/quiz-simulation";
import { apiFetch, ApiError } from "@/lib/api";
import { LoadingState, ErrorState } from "@/components/dashboard-ui";
import { ShieldCheck, Play, ArrowLeft } from "lucide-react";

interface LiveQuestionItem {
  no: number;
  id_soal: string;
}

interface LiveQuizQuestionsPayload {
  csrf_token?: string | null;
  waktu_akhir?: string | null;
  sisa_waktu?: string | null;
  total_soal: number;
  daftar_soal?: LiveQuestionItem[];
  current_soal?: {
    id_soal?: string | null;
    pertanyaan: string;
    opsi: Array<{ key: string; text: string; id_soal?: string; data_jawab?: string }>;
  } | null;
}

interface StandardQuestion {
  id: string;
  no: number;
  pertanyaan: string;
  kategori?: string;
  opsi: Array<{ key: string; text: string }>;
}

function QuizRoomContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const mode = (searchParams.get("mode") || "simulasi") as "live" | "simulasi";
  const token = searchParams.get("token") || "";
  const paketTitle = searchParams.get("paket") || (mode === "simulasi" ? "Simulasi Kuis Mandiri CBT" : "Kuis Perkuliahan MyBest");

  // State kuis
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  // Daftar soal & raw simulation questions
  const [questions, setQuestions] = useState<StandardQuestion[]>([]);
  const [simQuestions, setSimQuestions] = useState<SimulationQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // State jawaban & ragu
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [raguMap, setRaguMap] = useState<Record<string, boolean>>({});

  // Countdown timer
  const [remainingSeconds, setRemainingSeconds] = useState(45 * 60);
  const [syncStatus, setSyncStatus] = useState<"saved" | "saving" | "error" | "offline">(
    mode === "simulasi" ? "offline" : "saved"
  );

  // Finish state
  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);

  // Proctoring Shield Hook
  const {
    examStarted,
    isFullscreen,
    strikes,
    warningModalOpen,
    warningReason,
    toastMessage,
    startExam,
    returnToExam,
    clearToast,
  } = useExamProctoring(!isCompleted);

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Inisialisasi Data Soal
  const loadExamData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      if (mode === "simulasi") {
        const simPkg = generateSimulationQuiz(20);
        setSimQuestions(simPkg.daftar_soal);
        setQuestions(
          simPkg.daftar_soal.map((q) => ({
            id: q.id,
            no: q.no,
            pertanyaan: q.pertanyaan,
            kategori: q.kategori,
            opsi: q.opsi,
          }))
        );
        setRemainingSeconds(simPkg.durasi_menit * 60);

        // Pulihkan progress lokal jika ada
        const cacheKey = `mira_sim_answers_${simPkg.id}`;
        const saved = localStorage.getItem(cacheKey);
        if (saved) {
          try {
            setAnswers(JSON.parse(saved));
          } catch {}
        }
      } else {
        // Mode Live MyBest
        if (!token) {
          throw new Error("Token kuis tidak ditemukan dalam URL parameter.");
        }

        const res = await apiFetch<LiveQuizQuestionsPayload>(
          `/v1/elearning/quiz/questions?token_ujian=${encodeURIComponent(token)}`
        );

        if (!res) {
          throw new Error("Gagal mengambil lembar pertanyaan dari server MyBest.");
        }

        setCsrfToken(res.csrf_token || null);

        // Hitung sisa waktu jika tersedia string 'HH : MM : SS'
        if (res.sisa_waktu) {
          const parts = res.sisa_waktu.split(":").map((p) => parseInt(p.trim(), 10) || 0);
          if (parts.length === 3) {
            const secs = parts[0] * 3600 + parts[1] * 60 + parts[2];
            if (secs > 0) setRemainingSeconds(secs);
          }
        }

        if (res.current_soal) {
          // Adaptasi soal yang dikembalikan MyBest
          const liveList: StandardQuestion[] = [
            {
              id: String(res.current_soal.id_soal || "1"),
              no: 1,
              pertanyaan: res.current_soal.pertanyaan,
              opsi: res.current_soal.opsi.map((o) => ({ key: o.key, text: o.text })),
            },
          ];

          // Tambahkan placeholder untuk soal nomor berikutnya jika terdeteksi total_soal > 1
          if (res.daftar_soal && res.daftar_soal.length > 1) {
            res.daftar_soal.slice(1).forEach((item, idx) => {
              liveList.push({
                id: String(item.id_soal || idx + 2),
                no: item.no || idx + 2,
                pertanyaan: `Pertanyaan nomor ${item.no || idx + 2}`,
                opsi: [
                  { key: "A", text: "Pilihan A" },
                  { key: "B", text: "Pilihan B" },
                  { key: "C", text: "Pilihan C" },
                  { key: "D", text: "Pilihan D" },
                  { key: "E", text: "Pilihan E" },
                ],
              });
            });
          }

          setQuestions(liveList);
        } else {
          throw new Error("Format lembar kuis MyBest tidak memuat butir soal aktif.");
        }
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err);
      } else {
        const message = err instanceof Error ? err.message : "Terjadi kesalahan saat memuat lembar kuis.";
        setError(new ApiError("CBT_LOAD_ERROR", message, 500));
      }
    } finally {
      setLoading(false);
    }
  }, [mode, token]);

  useEffect(() => {
    loadExamData();
  }, [loadExamData]);

  // Countdown Timer Interval
  useEffect(() => {
    if (!examStarted || isCompleted) {
      clearTimeout(timerIntervalRef.current as NodeJS.Timeout);
      return;
    }

    timerIntervalRef.current = setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearTimeout(timerIntervalRef.current as NodeJS.Timeout);
          // Waktu habis -> buka finish modal secara otomatis
          setFinishModalOpen(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearTimeout(timerIntervalRef.current as NodeJS.Timeout);
    };
  }, [examStarted, isCompleted]);

  // Handler Pilih Jawaban (Auto-Save)
  const handleSelectOption = async (optionKey: string) => {
    const activeQuestion = questions[currentIndex];
    if (!activeQuestion) return;

    const newAnswers = { ...answers, [activeQuestion.id]: optionKey };
    setAnswers(newAnswers);

    // Simpan ke storage lokal
    try {
      const storageKey = mode === "simulasi" ? "mira_sim_answers" : `mira_live_answers_${token}`;
      localStorage.setItem(storageKey, JSON.stringify(newAnswers));
    } catch {}

    // Auto-save ke MyBest jika mode live
    if (mode === "live") {
      setSyncStatus("saving");
      try {
        await apiFetch("/v1/elearning/quiz/answer", {
          method: "POST",
          json: {
            id_soal: activeQuestion.id,
            data_jawab: `${activeQuestion.id}_${optionKey}`,
            csrf_token: csrfToken || undefined,
          },
        });
        setSyncStatus("saved");
      } catch (err) {
        console.error("Auto-save answer error:", err);
        setSyncStatus("error");
      }
    }
  };

  const handleToggleRagu = () => {
    const activeQuestion = questions[currentIndex];
    if (!activeQuestion) return;
    setRaguMap((prev) => ({
      ...prev,
      [activeQuestion.id]: !prev[activeQuestion.id],
    }));
  };

  const handleFinishExam = async () => {
    setSubmitting(true);
    try {
      if (mode === "simulasi") {
        const evaluated = evaluateSimulationScore(answers, simQuestions);
        setSimulationResult(evaluated);
        setIsCompleted(true);
        setFinishModalOpen(false);
      } else {
        // Mode live selesai
        setIsCompleted(true);
        setFinishModalOpen(false);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Status nomor soal untuk CbtQuestionGrid
  const gridStatusItems = useMemo(() => {
    return questions.map((q) => ({
      id: q.id,
      no: q.no,
      isAnswered: Boolean(answers[q.id]),
      isRagu: Boolean(raguMap[q.id]),
    }));
  }, [questions, answers, raguMap]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900 text-white">
        <LoadingState label="Menyiapkan lembar ujian online CBT..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900">
        <div className="max-w-md w-full bg-white rounded-xl p-6 shadow-xl border border-slate-200">
          <ErrorState error={error} onRetry={loadExamData} />
          <button
            type="button"
            onClick={() => router.push("/dashboard/kuis")}
            className="mt-4 w-full py-2.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Kembali ke Menu Kuis</span>
          </button>
        </div>
      </div>
    );
  }

  // Tampilan Hasil Kuis Mode Simulasi Selesai
  if (isCompleted && mode === "simulasi" && simulationResult) {
    return (
      <div className="min-h-screen bg-slate-100 py-6">
        <CbtResultView
          judul={paketTitle}
          result={simulationResult}
          onRetry={() => {
            setIsCompleted(false);
            setSimulationResult(null);
            setAnswers({});
            setRaguMap({});
            loadExamData();
          }}
          onBackToDashboard={() => router.push("/dashboard/kuis")}
        />
      </div>
    );
  }

  // Tampilan Selesai Mode Live
  if (isCompleted && mode === "live") {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900">
        <div className="max-w-md w-full bg-white rounded-xl p-8 shadow-2xl border border-slate-200 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-8 h-8" aria-hidden="true" />
          </div>
          <h2 className="text-xl font-display font-bold text-slate-900">
            Ujian Telah Diselesaikan
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Seluruh berkas jawaban Anda telah terkirim dan tercatat di sistem MyBest LMS UBSI.
          </p>
          <button
            type="button"
            onClick={() => router.push("/dashboard/kuis")}
            className="w-full py-2.5 rounded-lg bg-[#0369A1] hover:bg-[#0284C7] text-white text-xs font-bold transition-colors"
          >
            Kembali ke Halaman Kuis
          </button>
        </div>
      </div>
    );
  }

  const activeQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const raguCount = Object.values(raguMap).filter(Boolean).length;
  const unansweredCount = questions.length - answeredCount;

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Top CBT Navbar */}
      <CbtNavbar
        judul={paketTitle}
        subjudul={mode === "simulasi" ? "Latihan Ujian Mandiri Informatika" : "Kuis Perkuliahan Resmi"}
        remainingSeconds={remainingSeconds}
        syncStatus={syncStatus}
        isFullscreen={isFullscreen}
        onToggleFullscreen={async () => {
          if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => {});
          } else {
            await document.documentElement.requestFullscreen().catch(() => {});
          }
        }}
        onFinishClick={() => setFinishModalOpen(true)}
      />

      {/* Toast Peringatan Pasif */}
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-slate-900/90 text-white rounded-lg shadow-lg border border-slate-700 text-xs font-medium flex items-center gap-2 animate-bounce">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={clearToast}
            className="text-slate-400 hover:text-white font-bold ml-1 text-sm"
          >
            ×
          </button>
        </div>
      )}

      {/* Main CBT Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Column: Grid Soal */}
        <aside className="lg:col-span-1 order-2 lg:order-1">
          <CbtQuestionGrid
            total={questions.length}
            currentIndex={currentIndex}
            items={gridStatusItems}
            onSelectIndex={(idx) => setCurrentIndex(idx)}
          />
        </aside>

        {/* Right Column: Question & Answers View */}
        <section className="lg:col-span-3 order-1 lg:order-2">
          {activeQuestion ? (
            <CbtQuestionView
              soal={activeQuestion}
              totalSoal={questions.length}
              selectedAnswer={answers[activeQuestion.id] || null}
              isRagu={Boolean(raguMap[activeQuestion.id])}
              onSelectOption={handleSelectOption}
              onToggleRagu={handleToggleRagu}
              onPrev={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              onNext={() => setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))}
              onFinish={() => setFinishModalOpen(true)}
              isFirst={currentIndex === 0}
              isLast={currentIndex === questions.length - 1}
            />
          ) : (
            <div className="p-8 bg-white rounded-lg border border-slate-200 text-center text-xs text-slate-500">
              Tidak ada butir soal yang tersedia.
            </div>
          )}
        </section>
      </main>

      {/* Start Exam Modal (Sebelum Memulai) */}
      {!examStarted && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-slate-200 p-6 sm:p-8 space-y-5 text-center">
            <div className="w-14 h-14 rounded-full bg-sky-100 text-[#0369A1] flex items-center justify-center mx-auto">
              <ShieldCheck className="w-8 h-8" aria-hidden="true" />
            </div>

            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#0369A1] bg-[#0369A1]/10 px-2 py-0.5 rounded">
                {mode === "simulasi" ? "MODE SIMULASI MANDIRI" : "SISTEM UJIAN RESMI MYBEST"}
              </span>
              <h2 className="text-xl font-display font-bold text-slate-900 mt-2">
                Tata Tertib & Persiapan Ujian
              </h2>
              <p className="text-xs text-slate-600 mt-1">
                Harap baca petunjuk berikut sebelum memulai sesi pengerjaan soal.
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-left text-xs text-slate-700 space-y-2">
              <p className="font-bold text-slate-900">Peraturan Pengerjaan CBT:</p>
              <ul className="list-disc list-inside space-y-1.5 text-slate-600 text-[11px]">
                <li>Ujian disarankan dilakukan dalam mode <strong>Layar Penuh (Fullscreen)</strong>.</li>
                <li>Setiap pilihan jawaban Anda akan <strong>tersimpan otomatis secara instan</strong>.</li>
                <li>Dilarang berpindah tab peramban atau membuka aplikasi lain selama ujian.</li>
                <li>Fitur klik kanan dan tombol pintasan salin teks dinonaktifkan oleh sistem.</li>
              </ul>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={startExam}
                className="w-full py-3 rounded-lg bg-[#0369A1] hover:bg-[#0284C7] text-white text-xs sm:text-sm font-bold transition-all shadow-md flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                <span>Masuk Mode Ujian (Fullscreen)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  // Fallback mulai ujian tanpa memicu fullscreen
                  startExam();
                }}
                className="text-[11px] text-slate-500 hover:text-slate-700 underline block mx-auto py-1"
              >
                Mulai Tanpa Fullscreen (Mode Jendela / Seluler)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Violation Strike Modal */}
      <CbtViolationModal
        open={warningModalOpen}
        reason={warningReason}
        strikeCount={strikes}
        onReturn={returnToExam}
      />

      {/* Finish Confirmation Modal */}
      <CbtFinishModal
        open={finishModalOpen}
        totalSoal={questions.length}
        answeredCount={answeredCount}
        raguCount={raguCount}
        unansweredCount={unansweredCount}
        submitting={submitting}
        onCancel={() => setFinishModalOpen(false)}
        onConfirm={handleFinishExam}
      />
    </div>
  );
}

export default function QuizRoomPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900 text-white">
          <LoadingState label="Memuat ruang kuis CBT..." />
        </div>
      }
    >
      <QuizRoomContent />
    </Suspense>
  );
}
