"use client";

import { useState } from "react";
import {
  CheckSquare,
  Clock,
  Download,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  BookOpen,
  Send,
  ExternalLink,
  Edit3,
  X,
  Info,
  Link as LinkIcon,
} from "lucide-react";
import { apiFetch, useApi } from "@/lib/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  inputClass,
  primaryButtonClass,
  ghostButtonClass,
} from "@/components/dashboard-ui";

interface TaskItem {
  id: string;
  kode?: string;
  mata_kuliah?: string;
  kelas?: string;
  judul: string;
  deskripsi?: string;
  pertemuan?: string;
  mulai?: string;
  selesai?: string;
  file_soal_url?: string | null;
  file_soal_id?: string | null;
  file_soal_name?: string | null;
  upload_url?: string | null;
  send_url?: string | null;
  token_tugas?: string | null;
  token_send?: string | null;
}

interface SubmissionItem {
  id: string;
  kode?: string;
  mata_kuliah?: string;
  judul: string;
  tanggal_kumpul?: string;
  nilai?: string | number | null;
  komentar?: string | null;
  file_url?: string | null;
  link_tugas?: string | null;
  pertemuan?: string;
  komentar_dosen?: string | null;
  created?: string | null;
  updated?: string | null;
}

interface AssignmentsData {
  tasks: TaskItem[];
  submissions: SubmissionItem[];
}

export default function TugasPage() {
  const { data, loading, error, reload } = useApi<AssignmentsData>(
    "/v1/elearning/assignments"
  );
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // State Modal Kumpulkan Tugas
  const [activeTaskForSubmit, setActiveTaskForSubmit] = useState<TaskItem | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (loading) return <LoadingState label="Memuat daftar tugas perkuliahan" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const tasks = data?.tasks ?? [];
  const submissions = data?.submissions ?? [];

  const submittedTitles = new Set(
    submissions.map((s) => s.judul?.toLowerCase().trim())
  );

  const pendingList = tasks.filter(
    (t) => !submittedTitles.has(t.judul?.toLowerCase().trim())
  );

  const completedList = submissions.map((submission) => {
    const matchingTask = tasks.find(
      (task) => task.judul?.toLowerCase().trim() === submission.judul?.toLowerCase().trim()
    );
    return matchingTask || {
      id: `submission-${submission.id}`,
      kode: submission.kode,
      mata_kuliah: submission.mata_kuliah,
      judul: submission.judul,
      pertemuan: submission.pertemuan,
      selesai: submission.created || undefined,
      deskripsi: submission.komentar_dosen || undefined,
      file_soal_url: null,
      file_soal_id: null,
      file_soal_name: null,
      upload_url: null,
      send_url: null,
      token_tugas: null,
      token_send: null,
    };
  });

  const displayedTasks =
    filter === "pending"
      ? pendingList
      : filter === "completed"
      ? completedList
      : [...tasks, ...completedList.filter((item) => !tasks.some((task) => task.id === item.id))];

  function openSubmitModal(task: TaskItem) {
    const submission = submissions.find(
      (s) => s.judul?.toLowerCase().trim() === task.judul?.toLowerCase().trim()
    );
    setActiveTaskForSubmit(task);
    setLinkInput(submission?.link_tugas || "");
    setSubmitError(null);
  }

  function closeSubmitModal() {
    setActiveTaskForSubmit(null);
    setLinkInput("");
    setSubmitError(null);
  }

  async function handleSubmitLink(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTaskForSubmit) return;

    const token = activeTaskForSubmit.token_send || activeTaskForSubmit.token_tugas;
    if (!token) {
      setSubmitError("Token pengerjaan tugas tidak ditemukan dari MyBest.");
      return;
    }

    const trimmedLink = linkInput.trim();
    if (!trimmedLink) {
      setSubmitError("URL link tugas wajib diisi.");
      return;
    }

    if (!trimmedLink.startsWith("http://") && !trimmedLink.startsWith("https://")) {
      setSubmitError("Format link tidak valid. Masukkan URL lengkap diawali http:// atau https://");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await apiFetch<{ status?: string; message?: string }>("/v1/elearning/assignments/submit", {
        method: "POST",
        json: {
          token_send: token,
          link_tugas: trimmedLink,
        },
      });

      setActionMessage({
        type: "success",
        text: res.message || "Tugas berhasil dikumpulkan ke MyBest!",
      });
      closeSubmitModal();
      reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengumpulkan tugas ke MyBest.";
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHeader
          title="Tugas Kuliah & Deadline"
          description={`Terintegrasi dengan MyBest. Total ${tasks.length} tugas terdeteksi semester ini.`}
        />

        <div className="flex items-center gap-1.5 p-1 bg-[#F0F7FB] border border-stroke rounded-pill self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-pill transition-all ${
              filter === "all"
                ? "bg-[#0369A1] text-white shadow-sm"
                : "text-secondary hover:text-foreground"
            }`}
          >
            Semua ({displayedTasks.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("pending")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-pill transition-all ${
              filter === "pending"
                ? "bg-[#9A3412] text-white shadow-sm"
                : "text-secondary hover:text-foreground"
            }`}
          >
            Belum Dikumpul ({pendingList.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("completed")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-pill transition-all ${
              filter === "completed"
                ? "bg-[#0F766E] text-white shadow-sm"
                : "text-secondary hover:text-foreground"
            }`}
          >
            Selesai ({completedList.length})
          </button>
        </div>
      </div>

      {actionMessage && (
        <div
          className={`rounded-md p-4 flex items-center justify-between text-xs sm:text-sm ${
            actionMessage.type === "success"
              ? "bg-[#F0FDF4] border border-[#22C55E]/30 text-[#15803D]"
              : "bg-[#FFF1F2] border border-[#BE123C]/30 text-[#BE123C]"
          }`}
          role="status"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{actionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="text-secondary hover:text-foreground p-1"
            aria-label="Tutup pesan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {displayedTasks.length === 0 ? (
        <EmptyState
          title={
            filter === "pending"
              ? "Hebat! Tidak ada tugas yang tertunda."
              : filter === "completed"
              ? "Belum ada tugas yang dikumpulkan."
              : "Belum ada tugas perkuliahan terdaftar."
          }
          description="Periksa kembali berkala sesuai instruksi dosen pengampu mata kuliah di MyBest."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {displayedTasks.map((task) => {
            const isSubmitted = submittedTitles.has(
              task.judul?.toLowerCase().trim()
            );
            const submission = submissions.find(
              (s) => s.judul?.toLowerCase().trim() === task.judul?.toLowerCase().trim()
            );

            // Tentukan URL download berkas soal
            const downloadUrl =
              task.file_soal_id && task.file_soal_name
                ? `/v1/elearning/assignments/download?id=${encodeURIComponent(task.file_soal_id)}&file=${encodeURIComponent(task.file_soal_name)}`
                : task.file_soal_url
                ? `/v1/elearning/assignments/download?file_url=${encodeURIComponent(task.file_soal_url)}`
                : null;

            return (
              <div
                key={task.id}
                className={`glass-card p-5 sm:p-6 border-l-4 transition-all ${
                  isSubmitted
                    ? "border-l-[#0F766E]"
                    : "border-l-[#9A3412]"
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="space-y-2 max-w-2xl flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono font-bold text-[#0369A1] px-2 py-0.5 bg-[#0369A1]/10 rounded-sm">
                        {task.mata_kuliah || task.kode || "Tugas Kuliah"}
                      </span>
                      {task.pertemuan && (
                        <span className="text-secondary font-medium">
                          Pertemuan {task.pertemuan}
                        </span>
                      )}
                      {task.kelas && (
                        <span className="text-secondary/70">
                          (Kelas {task.kelas})
                        </span>
                      )}
                    </div>

                    <h2 className="text-base sm:text-lg font-bold text-foreground">
                      {task.judul}
                    </h2>

                    {task.deskripsi && (
                      <p className="text-xs sm:text-sm text-secondary leading-relaxed whitespace-pre-line">
                        {task.deskripsi}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary pt-2">
                      {task.mulai && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-secondary" aria-hidden="true" />
                          Mulai: {task.mulai}
                        </span>
                      )}
                      {task.selesai && (
                        <span className="flex items-center gap-1 font-semibold text-[#9A3412]">
                          <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                          Batas: {task.selesai}
                        </span>
                      )}
                    </div>

                    {/* Jika sudah dikumpulkan, tampilkan tautan link tugasnya */}
                    {isSubmitted && submission?.link_tugas && (
                      <div className="mt-3 p-3 bg-[#F0F7FB] border border-stroke rounded-md flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2 truncate max-w-md">
                          <LinkIcon className="w-3.5 h-3.5 text-[#0369A1] shrink-0" aria-hidden="true" />
                          <span className="text-secondary font-medium">Link Tugas Dikumpul:</span>
                          <a
                            href={submission.link_tugas}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-mono font-semibold text-[#0369A1] hover:underline truncate"
                          >
                            {submission.link_tugas}
                          </a>
                        </div>
                        <a
                          href={submission.link_tugas}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[#0369A1] font-bold text-[11px] hover:underline shrink-0"
                        >
                          <span>Buka Link</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  <div className="shrink-0 flex flex-col sm:items-end gap-3 pt-2 md:pt-0">
                    <div className="flex items-center gap-1.5">
                      {isSubmitted ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-pill bg-[#0F766E]/10 border border-[#0F766E]/30 text-xs font-bold text-[#0F766E]">
                          <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                          Sudah Dikumpul
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-pill bg-[#9A3412]/10 border border-[#9A3412]/30 text-xs font-bold text-[#9A3412]">
                          <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                          Belum Dikumpul
                        </span>
                      )}
                    </div>

                    {submission?.nilai !== undefined && submission?.nilai !== null && (
                      <div className="text-right">
                        <span className="text-[10px] font-mono uppercase text-secondary block">
                          Nilai Tugas:
                        </span>
                        <span className="text-lg font-display font-bold text-[#0369A1]">
                          {submission.nilai}
                        </span>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {downloadUrl && (
                        <a
                          href={downloadUrl}
                          className="inline-flex min-h-[40px] items-center gap-1.5 px-3 py-2 rounded-pill border border-stroke bg-white hover:bg-[#F0F7FB] text-xs font-semibold text-[#0369A1] transition-all"
                        >
                          <Download className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Unduh Soal</span>
                        </a>
                      )}

                      {/* Tombol Kumpulkan / Ubah Tugas */}
                      <button
                        type="button"
                        onClick={() => openSubmitModal(task)}
                        className={`inline-flex min-h-[40px] items-center gap-1.5 px-4 py-2 rounded-pill text-xs font-bold text-white transition-all ${
                          isSubmitted
                            ? "bg-[#0F766E] hover:bg-[#115E59]"
                            : "bg-[#0369A1] hover:bg-[#075985]"
                        }`}
                      >
                        {isSubmitted ? (
                          <>
                            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Ubah Link Tugas</span>
                          </>
                        ) : (
                          <>
                            <Send className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Kumpulkan Tugas</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Kumpulkan Tugas */}
      {activeTaskForSubmit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#072033]/50 backdrop-blur-sm transition-opacity"
            onClick={closeSubmitModal}
            aria-hidden="true"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="submit-modal-title"
            className="relative w-full max-w-lg bg-white rounded-lg shadow-2xl z-10 flex flex-col overflow-hidden border border-stroke"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-stroke bg-[#F7FAFC]">
              <div>
                <span className="text-[10px] font-mono font-bold uppercase text-[#0369A1]">
                  Pengumpulan Tugas MyBest
                </span>
                <h3 id="submit-modal-title" className="text-base font-display font-bold text-foreground">
                  {activeTaskForSubmit.judul}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeSubmitModal}
                aria-label="Tutup jendela"
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-sm text-secondary hover:text-foreground hover:bg-[#F0F7FB]"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmitLink} className="p-6 space-y-4">
              <div className="space-y-1">
                <span className="text-xs text-secondary font-medium">
                  Mata Kuliah: <strong className="text-foreground">{activeTaskForSubmit.mata_kuliah || activeTaskForSubmit.kode}</strong>
                  {activeTaskForSubmit.pertemuan ? ` | Pertemuan ${activeTaskForSubmit.pertemuan}` : ""}
                </span>
              </div>

              <div className="space-y-2">
                <label htmlFor="input-link-tugas" className="block text-xs font-bold text-foreground uppercase tracking-wider">
                  Link / URL Tugas Mahasiswa <span className="text-[#BE123C]">*</span>
                </label>
                <div className="relative">
                  <input
                    id="input-link-tugas"
                    type="url"
                    required
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    placeholder="Contoh: https://drive.google.com/file/d/14wUrOkCVbx..."
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Petunjuk Pengumpulan */}
              <div className="p-3 bg-[#F0F7FB] border border-[#0369A1]/20 rounded-md flex items-start gap-2.5 text-xs text-secondary">
                <Info className="w-4 h-4 text-[#0369A1] shrink-0 mt-0.5" aria-hidden="true" />
                <div className="space-y-1 leading-relaxed">
                  <p>
                    <strong>Format Resmi MyBest:</strong> Masukkan URL Google Drive, GitHub repository, atau link dokumen tugas Anda.
                  </p>
                  <p>
                    Pastikan akses link Google Drive disetel ke <em>&quot;Siapa saja yang memiliki link dapat melihat&quot;</em> agar dosen pengampu dapat memeriksa tugas Anda.
                  </p>
                </div>
              </div>

              {submitError && (
                <div className="p-3 bg-[#FFF1F2] border border-[#BE123C]/20 rounded-md text-[#BE123C] text-xs">
                  {submitError}
                </div>
              )}

              {/* Modal Actions */}
              <div className="pt-3 border-t border-stroke flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeSubmitModal}
                  className={`${ghostButtonClass} text-xs py-2`}
                  disabled={submitting}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`${primaryButtonClass} text-xs py-2`}
                >
                  <Send className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{submitting ? "Mengirimkan..." : "Kirim Tugas"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
