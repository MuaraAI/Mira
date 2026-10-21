"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  Link as LinkIcon,
  Send,
  X,
} from "lucide-react";
import { apiDownload, apiFetch, ApiError, useApi } from "@/lib/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  inputClass,
  primaryButtonClass,
  ghostButtonClass,
} from "@/components/dashboard-ui";
import { describeDeadline, findSubmission, formatShortDate, gradeValue, parseDeadline, type DeadlineTone } from "@/lib/assignments";
import { LinkCard } from "@/components/LinkCard";
import { SideSheet } from "@/components/SideSheet";
import { parseShareLink, tidyLink, useLinkCheck, useLinkChecks, type LinkCheck } from "@/lib/links";

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
  downloading,
  onDownload,
  onSubmit,
  linkCheck,
  linkChecking,
  onRecheckLink,
}: {
  row: Row;
  now: Date | null;
  downloading: boolean;
  onDownload: () => void;
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
      className={`glass-card flex h-full flex-col p-4 sm:p-5 ${
        done ? "[--px-line:#99D5CC] [--px-drop:#CCEBE6]" : countdown?.tone === "overdue" || countdown?.tone === "urgent" ? "[--px-line:#FDBA74] [--px-drop:#FFEDD5]" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate font-mono text-[11px] font-bold uppercase tracking-wide text-[#0369A1]">
          {task.mata_kuliah || task.kode || "Tugas Kuliah"}
        </p>
        {done ? (
          <span className="inline-flex shrink-0 items-center gap-1 bg-[#0F766E] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            Dikumpul
          </span>
        ) : countdown ? (
          <span className={`shrink-0 px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${TONE_CLASS[countdown.tone]}`}>
            {countdown.text}
          </span>
        ) : null}
      </div>

      <h2 className="mt-1.5 text-base font-bold leading-snug text-foreground">{task.judul}</h2>
      <p className="mt-0.5 text-xs text-secondary">
        {[task.pertemuan && `Pertemuan ${task.pertemuan}`, task.kelas && `Kelas ${task.kelas}`].filter(Boolean).join(" · ")}
      </p>

      {task.deskripsi && (
        <div className="mt-3">
          <p className={`whitespace-pre-line text-sm leading-relaxed text-secondary ${!open && longDesc ? "line-clamp-3" : ""}`}>
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

      <div className="mt-3 flex items-center gap-2 border-t-2 border-dashed border-px-soft pt-3 text-xs">
        <Clock className={`h-3.5 w-3.5 shrink-0 ${done ? "text-secondary" : "text-[#9A3412]"}`} aria-hidden="true" />
        <span className="text-secondary">Batas</span>
        <span className={`font-mono font-semibold ${done ? "text-foreground" : "text-[#9A3412]"}`}>{formatShortDate(deadline, task.selesai)}</span>
        {submission &&
          (gradeValue(submission.nilai) !== null ? (
            <span className="ml-auto font-mono text-xs text-secondary">
              Nilai <strong className="text-base text-[#0369A1]">{gradeValue(submission.nilai)}</strong>
            </span>
          ) : (
            <span className="ml-auto bg-[#F0F7FB] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-secondary">Belum dinilai</span>
          ))}
      </div>

      {submission?.link_tugas && (
        <div className="mt-3">
          <LinkCard url={submission.link_tugas} check={linkCheck} checking={linkChecking} onRecheck={onRecheckLink} compact />
        </div>
      )}

      <div className={`mt-auto grid gap-3 pt-4 ${hasFile ? "grid-cols-2" : "grid-cols-1"}`}>
        {hasFile && (
          <button
            type="button"
            onClick={onDownload}
            disabled={downloading}
            className="px-btn-ghost inline-flex min-h-11 items-center justify-center gap-1.5 px-3 text-xs font-semibold"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            {downloading ? "Mengunduh..." : "Soal"}
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
  const { data, loading, error, reload } = useApi<AssignmentsData>("/v1/elearning/assignments");
  const [filter, setFilter] = useState<Filter>("pending");
  const [actionMessage, setActionMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
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

  if (loading) return <LoadingState label="Memuat daftar tugas perkuliahan" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  const rows = filter === "pending" ? pendingRows : filter === "completed" ? completedRows : allRows;

  async function handleDownloadTask(task: TaskItem) {
    const path =
      task.file_soal_id && task.file_soal_name
        ? `/v1/elearning/assignments/download?id=${encodeURIComponent(task.file_soal_id)}&file=${encodeURIComponent(task.file_soal_name)}`
        : task.file_soal_url
        ? task.file_soal_url.startsWith("/v1/")
          ? task.file_soal_url
          : `/v1/elearning/assignments/download?file_url=${encodeURIComponent(task.file_soal_url)}`
        : null;
    if (!path) return;

    setDownloadingId(task.id);
    setActionMessage(null);
    try {
      const defaultName = task.file_soal_name || `${(task.judul || "soal_tugas").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      await apiDownload(path, defaultName);
    } catch (err) {
      setActionMessage({ type: "error", text: err instanceof ApiError ? err.message : "Gagal mengunduh berkas soal." });
    } finally {
      setDownloadingId(null);
    }
  }

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
    { key: "pending", label: "Belum", count: pendingRows.length, active: "bg-[#9A3412]" },
    { key: "completed", label: "Selesai", count: completedRows.length, active: "bg-[#0F766E]" },
    { key: "all", label: "Semua", count: allRows.length, active: "bg-[#0369A1]" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tugas Kuliah & Deadline"
        description={`Terintegrasi dengan MyBest. Total ${allRows.length} tugas terdeteksi semester ini.`}
      />

      <div role="tablist" aria-label="Filter tugas" className="grid grid-cols-3 gap-1 bg-px-tint p-1 shadow-[0_-2px_0_0_#CFE2EE,0_2px_0_0_#CFE2EE,-2px_0_0_0_#CFE2EE,2px_0_0_0_#CFE2EE] sm:w-[26rem]">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={filter === t.key}
            onClick={() => setFilter(t.key)}
            className={`min-h-10 px-2 font-mono text-xs font-bold transition-colors duration-200 ${
              filter === t.key ? `${t.active} text-white shadow-[2px_2px_0_0_#072033]` : "text-secondary hover:bg-white hover:text-foreground"
            }`}
          >
            {t.label} ({t.count})
          </button>
        ))}
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
        <div className="page-in grid grid-cols-1 gap-5 p-[2px] md:grid-cols-2" key={filter}>
          {rows.map((row) => (
            <TaskCard
              key={row.task.id}
              row={row}
              now={now}
              downloading={downloadingId === row.task.id}
              onDownload={() => handleDownloadTask(row.task)}
              onSubmit={() => openSubmitModal(row)}
              linkCheck={row.submission?.link_tugas ? linkChecks.results[row.submission.link_tugas.trim()] ?? null : null}
              linkChecking={row.submission?.link_tugas ? linkChecks.pending.has(row.submission.link_tugas.trim()) : false}
              onRecheckLink={() => row.submission?.link_tugas && linkChecks.recheck(row.submission.link_tugas.trim())}
            />
          ))}
        </div>
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
                  type="url"
                  required
                  data-autofocus
                  value={linkInput}
                  onChange={(e) => setLinkInput(e.target.value)}
                  onBlur={tidyInput}
                  placeholder="https://drive.google.com/file/d/..."
                  className={`${inputClass} min-h-12 text-base sm:text-sm`}
                />
                <p className="text-[11px] leading-relaxed text-secondary">
                  Tempel link Google Drive, Docs, atau GitHub; link dirapikan otomatis. Pastikan akses Drive disetel ke <em>&quot;Siapa saja yang memiliki link&quot;</em> supaya dosen bisa membukanya.
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
