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
} from "lucide-react";
import { useApi } from "@/lib/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
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
  upload_url?: string | null;
  token_tugas?: string | null;
}

interface SubmissionItem {
  id: string;
  kode?: string;
  mata_kuliah?: string;
  judul: string;
  tanggal_kumpul?: string;
  nilai?: string | null;
  komentar?: string | null;
  file_url?: string | null;
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
  const completedList = tasks.filter((t) =>
    submittedTitles.has(t.judul?.toLowerCase().trim())
  );

  const displayedTasks =
    filter === "pending"
      ? pendingList
      : filter === "completed"
      ? completedList
      : tasks;

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
            Semua ({tasks.length})
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

      {displayedTasks.length === 0 ? (
        <EmptyState
          title={
            filter === "pending"
              ? "Hebat! Tidak ada tugas yang tertunda."
              : filter === "completed"
              ? "Belum ada tugas yang dikumpulkan."
              : "Belum ada tugas perkuliahan terdaftar."
          }
          description="Periksa kembali berkala sesuai instruksi dosen pengampu mata kuliah."
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
                  <div className="space-y-2 max-w-2xl">
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

                    {submission?.nilai && (
                      <div className="text-right">
                        <span className="text-[10px] font-mono uppercase text-secondary block">
                          Nilai Tugas:
                        </span>
                        <span className="text-lg font-display font-bold text-[#0369A1]">
                          {submission.nilai}
                        </span>
                      </div>
                    )}

                    {task.file_soal_url && (
                      <a
                        href={task.file_soal_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill border border-stroke bg-white hover:bg-[#F0F7FB] text-xs font-semibold text-[#0369A1] transition-all"
                      >
                        <Download className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>Unduh Soal</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
