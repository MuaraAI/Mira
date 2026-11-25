"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  Clock,
  Edit3,
  ExternalLink,
  Filter as FilterIcon,
  Link as LinkIcon,
  Send,
  TriangleAlert,
  Eye,
  RefreshCw,
  X,
} from "lucide-react";
import { apiFetch, ApiError, useApi } from "@/lib/api";
import {
  EmptyState,
  ErrorState,
  Skeleton,
  PageHeader,
  inputClass,
  primaryButtonClass,
  ghostButtonClass,
} from "@/components/dashboard-ui";
import { describeDeadline, findSubmission, formatShortDate, gradeValue, parseDeadline, type DeadlineTone } from "@/lib/assignments";
import {
  TASK_SORT_OPTIONS,
  courseKey,
  filterAndSortTaskRows,
  type TaskSortKey,
} from "@/lib/dashboard-sort";
import { LinkCard } from "@/components/LinkCard";
import { SideSheet } from "@/components/SideSheet";
import { FilePreviewSheet } from "@/components/FilePreviewSheet";
import { preloadPdfjs } from "@/lib/pdf";
import { cleanUrl, parseShareLink, tidyLink, useLinkCheck, useLinkChecks, type LinkCheck } from "@/lib/links";

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
  /** Mata kuliah yang gagal diambil dari MyBest (data bisa belum lengkap). */
  failed_courses?: string[];
}

function taskFilePath(task: TaskItem): string | null {
  if (task.file_soal_id && task.file_soal_name) {
    return `/v1/elearning/assignments/download?id=${encodeURIComponent(task.file_soal_id)}&file=${encodeURIComponent(task.file_soal_name)}`;
  }
  if (task.file_soal_url) {
    return task.file_soal_url.startsWith("/v1/")
      ? task.file_soal_url
      : `/v1/elearning/assignments/download?file_url=${encodeURIComponent(task.file_soal_url)}`;
  }
  return null;
}

type Filter = "all" | "pending" | "completed";

interface Row {
  task: TaskItem;
  submission?: SubmissionItem;
  deadline: Date | null;
}

const TONE_CLASS: Record<DeadlineTone, string> = {
  overdue: "bg-[#BE123C] text-white",
  urgent: "bg-[#9A3412] text-white",
  soon: "bg-[#FFF7ED] text-[#9A3412]",
  later: "bg-[#F0F7FB] text-[#075985]",
};

function TaskCard({
  row,
  now,
  onPreview,
  onSubmit,
  linkCheck,
  linkChecking,
  onRecheckLink,
}: {
  row: Row;
  now: Date | null;
  onPreview: () => void;
  onSubmit: () => void;
  linkCheck: LinkCheck | null;
  linkChecking: boolean;
  onRecheckLink: () => void;
}) {
  const { task, submission, deadline } = row;
  const done = Boolean(submission);
  const countdown = now && !done ? describeDeadline(deadline, now) : null;
  const hasFile = Boolean((task.file_soal_id && task.file_soal_name) || task.file_soal_url);
  const canSubmit = Boolean(task.token_send || task.token_tugas);
  const [open, setOpen] = useState(false);
  const longDesc = (task.deskripsi?.length ?? 0) > 140;

  return (
    <article
      className={`glass-card flex h-full min-w-0 flex-col overflow-hidden p-4 sm:p-5 ${
        done ? "[--px-line:#99D5CC] [--px-drop:#CCEBE6]" : countdown?.tone === "overdue" || countdown?.tone === "urgent" ? "[--px-line:#FDBA74] [--px-drop:#FFEDD5]" : ""
      }`}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className="min-w-0 truncate font-mono text-[11px] font-bold uppercase tracking-wide text-[#0369A1]">
          {task.mata_kuliah || task.kode || "Tugas Kuliah"}
        </p>
        {done ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-[4px] bg-[#0F766E] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            Dikumpul
          </span>
        ) : countdown ? (
          <span className={`shrink-0 rounded-[4px] px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${TONE_CLASS[countdown.tone]}`}>
            {countdown.text}
          </span>
        ) : null}
      </div>

      <h2 className="mt-1.5 break-words text-base font-bold leading-snug text-foreground">{task.judul}</h2>
      <p className="mt-0.5 text-xs text-secondary">
        {[task.pertemuan && `Pertemuan ${task.pertemuan}`, task.kelas && `Kelas ${task.kelas}`].filter(Boolean).join(" · ")}
      </p>

      {task.deskripsi && (
        <div className="mt-3 min-w-0">
          <p className={`whitespace-pre-line break-words text-sm leading-relaxed text-secondary ${!open && longDesc ? "line-clamp-3" : ""}`}>
            {task.deskripsi}
          </p>
          {longDesc && (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-[#0369A1]"
              aria-expanded={open}
            >
              {open ? "Tutup" : "Selengkapnya"}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
          )}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 border-t-[1px] border-dashed border-stroke pt-3 text-xs">
        <Clock className={`h-3.5 w-3.5 shrink-0 ${done ? "text-secondary" : "text-[#9A3412]"}`} aria-hidden="true" />
        <span className="text-secondary">Batas</span>
        <span className={`font-mono font-semibold ${done ? "text-foreground" : "text-[#9A3412]"}`}>{formatShortDate(deadline, task.selesai)}</span>
        {submission &&
          (gradeValue(submission.nilai) !== null ? (
            <span className="ml-auto font-mono text-xs text-secondary">
              Nilai <strong className="text-base text-[#0369A1]">{gradeValue(submission.nilai)}</strong>
            </span>
          ) : (
            <span className="ml-auto rounded-[4px] bg-[#F0F7FB] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-secondary">Belum dinilai</span>
          ))}
      </div>

      {submission?.link_tugas && (
        <div className="mt-3 min-w-0">
          <LinkCard url={submission.link_tugas} check={linkCheck} checking={linkChecking} onRecheck={onRecheckLink} compact />
        </div>
      )}

      <div className={`mt-auto grid gap-3 pt-4 ${hasFile ? "grid-cols-2" : "grid-cols-1"}`}>
        {hasFile && (
          <button
            type="button"
            onClick={onPreview}
            className="px-btn-ghost inline-flex min-h-11 items-center justify-center gap-1.5 px-3 text-xs font-semibold"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Lihat Soal
          </button>
        )}
        {canSubmit && (
          <button
            type="button"
            onClick={onSubmit}
            className={`${done ? "px-btn-ghost" : "px-btn"} inline-flex min-h-11 items-center justify-center gap-1.5 px-3 text-xs font-bold`}
          >
            {done ? <Edit3 className="h-3.5 w-3.5" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
            {done ? "Ubah Link" : "Kumpulkan"}
          </button>
        )}
      </div>
    </article>
  );
}

export default function TugasPage() {
  useEffect(() => preloadPdfjs(), []);
  // Tugas dikumpulkan dari tiap mapel di MyBest (lambat saat pertama). Simpan di perangkat 6 jam agar
  // halaman langsung terisi, lalu perbarui diam-diam; cek ulang otomatis cukup tiap 5 menit.
  const { data, loading, error, reload, revalidating } = useApi<AssignmentsData>("/v1/elearning/assignments", {
    persistMs: 6 * 60 * 60 * 1000,
    refreshMs: 5 * 60_000,
  });
  const [filter, setFilter] = useState<Filter>("pending");
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<TaskSortKey>("default");
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [previewTask, setPreviewTask] = useState<TaskItem | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  // State Modal Kumpulkan Tugas
  const [activeTaskForSubmit, setActiveTaskForSubmit] = useState<TaskItem | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const submittedLinks = useMemo(
    () => (data?.submissions ?? []).map((item) => item.link_tugas?.trim() ?? "").filter(Boolean),
    [data],
  );
  const linkChecks = useLinkChecks(submittedLinks);
  const draftCheck = useLinkCheck(linkInput);

  const { pendingRows, completedRows, allRows } = useMemo(() => {
    const tasks = data?.tasks ?? [];
    const submissions = data?.submissions ?? [];
    const rows: Row[] = tasks.map((task) => ({ task, submission: findSubmission(task, submissions), deadline: parseDeadline(task.selesai) }));
    // Pengumpulan yang tidak punya pasangan di daftar tugas aktif tetap ditampilkan sebagai selesai.
    for (const s of submissions) {
      if (rows.some((r) => r.submission === s)) continue;
      rows.push({
        task: { id: `submission-${s.id}`, kode: s.kode, mata_kuliah: s.mata_kuliah, judul: s.judul, pertemuan: s.pertemuan, selesai: s.created || undefined, deskripsi: s.komentar_dosen || undefined },
        submission: s,
        deadline: parseDeadline(s.created),
      });
    }
    const byDeadline = (a: Row, b: Row) => (a.deadline?.getTime() ?? Infinity) - (b.deadline?.getTime() ?? Infinity);
    const pending = rows.filter((r) => !r.submission).sort(byDeadline);
    const completed = rows.filter((r) => r.submission).sort((a, b) => byDeadline(b, a));
    return { pendingRows: pending, completedRows: completed, allRows: [...pending, ...completed] };
  }, [data]);

  const courseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of allRows) {
      const key = courseKey(r.task.kode, r.task.mata_kuliah);
      if (!map.has(key)) {
        map.set(key, r.task.mata_kuliah || r.task.kode || "Lainnya");
      }
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "id", { sensitivity: "base" }));
  }, [allRows]);

  const visiblePending = useMemo(
    () => filterAndSortTaskRows(pendingRows, courseFilter, sortBy),
    [pendingRows, courseFilter, sortBy],
  );
  const visibleCompleted = useMemo(
    () => filterAndSortTaskRows(completedRows, courseFilter, sortBy),
    [completedRows, courseFilter, sortBy],
  );
  const visibleAll = useMemo(
    () => filterAndSortTaskRows(allRows, courseFilter, sortBy),
    [allRows, courseFilter, sortBy],
  );
  // Server sudah tahu jenis link yang sebenarnya (mis. open?id=... ternyata folder): rapikan isian ke link bersihnya.
  useEffect(() => {
    const result = draftCheck.result;
    if (!result?.normalized_url || !result.valid || result.access === "invalid") return;
    if (cleanUrl(linkInput) === result.url && result.normalized_url !== result.url && result.provider !== "web") {
      setLinkInput(result.normalized_url);
    }
  }, [draftCheck.result]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="space-y-5" aria-busy="true">
        <PageHeader title="Tugas Kuliah & Deadline" description="Mengambil tugas dari setiap mata kuliah di MyBest. Pertama kali bisa butuh beberapa detik." />
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass-card space-y-3 p-4 sm:p-5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const failedCourses = data?.failed_courses ?? [];
  const rows = filter === "pending" ? visiblePending : filter === "completed" ? visibleCompleted : visibleAll;
  const hasCustomFilter = courseFilter !== "all" || sortBy !== "default";
  const previewPath = previewTask ? taskFilePath(previewTask) : null;

  function openSubmitModal(row: Row) {
    setActiveTaskForSubmit(row.task);
    setLinkInput(row.submission?.link_tugas || "");
    setSubmitError(null);
  }

  function closeSubmitModal() {
    setActiveTaskForSubmit(null);
    setLinkInput("");
    setSubmitError(null);
  }

  function tidyInput() {
    const tidy = tidyLink(linkInput);
    if (tidy && tidy !== linkInput.trim()) setLinkInput(tidy);
  }

  async function handleSubmitLink(e: React.FormEvent) {
    e.preventDefault();
    if (!activeTaskForSubmit) return;

    const token = activeTaskForSubmit.token_send || activeTaskForSubmit.token_tugas;
    if (!token) {
      setSubmitError("Token pengerjaan tugas tidak ditemukan dari MyBest.");
      return;
    }

    const trimmedLink = tidyLink(linkInput);
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
        json: { token_send: token, link_tugas: trimmedLink },
      });
      setActionMessage({ type: "success", text: res.message || "Tugas berhasil dikumpulkan ke MyBest!" });
      closeSubmitModal();
      reload();
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : "Gagal mengumpulkan tugas ke MyBest.");
    } finally {
      setSubmitting(false);
    }
  }

  const tabs: { key: Filter; label: string; count: number; active: string }[] = [
    { key: "pending", label: "Belum", count: visiblePending.length, active: "bg-[#9A3412]" },
    { key: "completed", label: "Selesai", count: visibleCompleted.length, active: "bg-[#0F766E]" },
    { key: "all", label: "Semua", count: visibleAll.length, active: "bg-[#0369A1]" },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Tugas Kuliah & Deadline"
        description={`${allRows.length} tugas semester ini, langsung dari MyBest.`}
      />
      {revalidating && (
        <p className="-mt-3 mb-4 flex items-center gap-2 text-xs text-secondary" role="status">
          <span className="px-cursor h-1.5 w-1.5 bg-[#0369A1]" aria-hidden="true" />
          Memperbarui dari MyBest...
        </p>
      )}

      {failedCourses.length > 0 && (
        <div role="alert" className="px-frame flex flex-col gap-3 bg-[#FFF7ED] p-3 text-sm text-[#9A3412] [--px-line:#FDBA74] sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Tugas dari {failedCourses.length} mata kuliah belum berhasil dimuat dari MyBest
              <span className="text-secondary"> ({failedCourses.slice(0, 3).join(", ")}{failedCourses.length > 3 ? ", ..." : ""})</span>.
              Daftar di bawah bisa belum lengkap.
            </span>
          </span>
          <button type="button" onClick={reload} className="px-btn-ghost inline-flex min-h-10 shrink-0 items-center justify-center gap-2 px-3 font-mono text-xs font-bold">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Muat ulang
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div
          role="tablist"
          aria-label="Filter status tugas"
          className="grid w-full grid-cols-3 gap-1 rounded-[10px] border-[1px] border-stroke bg-[#F0F7FB] p-1 sm:inline-flex sm:w-auto"
        >
          {tabs.map((t) => {
            const active = filter === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setFilter(t.key)}
                className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] px-2.5 text-xs font-medium transition-colors duration-200 sm:px-3.5 ${
                  active ? `${t.active} text-white` : "text-secondary hover:bg-white hover:text-foreground"
                }`}
              >
                <span>{t.label}</span>
                <span
                  className={`rounded-[9999px] px-1.5 py-0.5 font-mono text-[10px] leading-none tabular-nums ${
                    active ? "bg-white/20 text-white" : "bg-white text-secondary"
                  }`}
                >
                  {t.count}
                </span>
              </button>
            );
          })}
        </div>

        {allRows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {courseOptions.length > 1 && (
              <label className="relative flex min-w-0 flex-1 items-center sm:flex-initial">
                <span className="sr-only">Filter mata kuliah</span>
                <FilterIcon className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                <select
                  value={courseFilter}
                  onChange={(e) => setCourseFilter(e.target.value)}
                  aria-label="Filter mata kuliah"
                  className="min-h-10 w-full max-w-full rounded-[8px] border border-stroke bg-white py-1.5 pl-8 pr-3 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-[#0369A1] sm:w-52"
                >
                  <option value="all">Semua mata kuliah ({courseOptions.length})</option>
                  {courseOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="relative flex min-w-0 flex-1 items-center sm:flex-initial">
              <span className="sr-only">Urutkan tugas</span>
              <ArrowUpDown className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-secondary" aria-hidden="true" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as TaskSortKey)}
                aria-label="Urutkan tugas"
                className="min-h-10 w-full rounded-[8px] border border-stroke bg-white py-1.5 pl-8 pr-3 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-[#0369A1] sm:w-44"
              >
                {TASK_SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {hasCustomFilter && (
              <button
                type="button"
                onClick={() => {
                  setCourseFilter("all");
                  setSortBy("default");
                }}
                className="inline-flex min-h-10 items-center gap-1 rounded-[8px] border border-stroke bg-[#F7FAFC] px-2.5 text-xs font-semibold text-secondary hover:bg-white hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                Reset
              </button>
            )}
          </div>
        )}
      </div>
      {actionMessage && (
        <div
          className={`px-frame flex items-center justify-between gap-3 p-3 text-sm ${
            actionMessage.type === "success" ? "bg-[#F0FDF4] text-[#0F766E] [--px-line:#99D5CC]" : "bg-[#FFF1F2] text-[#BE123C] [--px-line:#FDA4AF]"
          }`}
          role="status"
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            {actionMessage.text}
          </span>
          <button type="button" onClick={() => setActionMessage(null)} className="flex min-h-9 min-w-9 items-center justify-center text-secondary hover:text-foreground" aria-label="Tutup pesan">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          mascot="/maskot/mura-tugas-done.png"
          title={
            courseFilter !== "all"
              ? "Tidak ada tugas di mata kuliah ini untuk tab tersebut."
              : filter === "pending" && failedCourses.length > 0
              ? "Belum bisa memastikan tugas yang tertunda."
              : filter === "pending"
              ? "Hebat! Tidak ada tugas yang tertunda."
              : filter === "completed"
              ? "Belum ada tugas yang dikumpulkan."
              : "Belum ada tugas perkuliahan terdaftar."
          }
          description={courseFilter !== "all" ? "Coba pilih mata kuliah lain atau tekan Reset." : "Cek lagi nanti, atau lihat instruksi dosen di MyBest."}
        />
      ) : (
        <div className="page-in grid grid-cols-1 gap-5 p-[2px] md:grid-cols-2" key={`${filter}-${courseFilter}-${sortBy}`}>
          {rows.map((row) => (
            <TaskCard
              key={row.task.id}
              row={row}
              now={now}
              onPreview={() => setPreviewTask(row.task)}
              onSubmit={() => openSubmitModal(row)}
              linkCheck={row.submission?.link_tugas ? linkChecks.results[row.submission.link_tugas.trim()] ?? null : null}
              linkChecking={row.submission?.link_tugas ? linkChecks.pending.has(row.submission.link_tugas.trim()) : false}
              onRecheckLink={() => row.submission?.link_tugas && linkChecks.recheck(row.submission.link_tugas.trim())}
            />
          ))}
        </div>
      )}

      {/* Pratinjau + ringkasan otomatis soal tugas */}
      {previewTask && previewPath && (
        <FilePreviewSheet
          open
          onClose={() => setPreviewTask(null)}
          path={previewPath}
          eyebrow="Soal tugas"
          title={previewTask.judul}
          subtitle={previewTask.mata_kuliah || previewTask.kode}
          defaultFilename={previewTask.file_soal_name || "soal_tugas.pdf"}
        />
      )}

      {/* Kumpulkan / ubah link: panel samping (desktop) atau dari bawah (HP) */}
      <SideSheet
        open={activeTaskForSubmit !== null}
        onClose={closeSubmitModal}
        eyebrow="Pengumpulan Tugas MyBest"
        title={activeTaskForSubmit?.judul ?? ""}
        subtitle={[activeTaskForSubmit?.mata_kuliah || activeTaskForSubmit?.kode, activeTaskForSubmit?.pertemuan && `Pertemuan ${activeTaskForSubmit.pertemuan}`].filter(Boolean).join(" · ")}
        titleId="submit-modal-title"
        width="lg"
        footer={
              <div className="grid grid-cols-2 gap-3 sm:flex sm:justify-end">
                <button type="button" onClick={closeSubmitModal} className={ghostButtonClass} disabled={submitting}>
                  Batal
                </button>
                <button
                  type="submit"
                  form="submit-link-form"
                  disabled={submitting}
                  className={draftCheck.result?.access === "private" || draftCheck.result?.access === "missing" ? "px-btn-danger inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm font-bold" : primaryButtonClass}
                >
                  <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  {submitting
                    ? "Mengirim..."
                    : draftCheck.result?.access === "private" || draftCheck.result?.access === "missing"
                    ? "Kirim Tetap"
                    : "Kirim Tugas"}
                </button>
              </div>
        }
      >
        <form id="submit-link-form" onSubmit={handleSubmitLink} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="input-link-tugas" className="block text-xs font-bold uppercase tracking-wider text-foreground">
                  Link / URL Tugas Mahasiswa <span className="text-[#BE123C]">*</span>
                </label>
                <input
                  id="input-link-tugas"
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  data-autofocus
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onBlur={tidyInput}
                  placeholder="https://drive.google.com/... atau https://youtu.be/..."
                  className={`${inputClass} min-h-12 text-base sm:text-sm`}
                />
                <p className="text-[11px] leading-relaxed text-secondary">
                  Tempel link Google Drive, Docs, GitHub, atau video YouTube; link dirapikan dan dicek otomatis. Pastikan video YouTube disetel ke <em>Publik</em> atau <em>Tidak Publik (Hanya yang punya link)</em>, jangan <em>Pribadi</em>.
                </p>
              </div>

              {parseShareLink(linkInput.trim()) && (
                <LinkCard url={tidyLink(linkInput)} check={draftCheck.result} checking={draftCheck.checking} onRecheck={draftCheck.recheck} compact />
              )}

              {submitError && (
                <div className="bg-[#FFF1F2] p-3 text-xs text-[#BE123C]" role="alert">
                  {submitError}
                </div>
              )}
        </form>
      </SideSheet>
    </div>
  );
}
