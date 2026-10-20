/** Helper bersama untuk tugas MyBest (dipakai halaman Tugas dan Ringkasan). */

export interface TaskLike {
  kode?: string;
  mata_kuliah?: string;
  judul: string;
}

const norm = (v?: string | null) => (v ?? "").toLowerCase().replace(/\s+/g, " ").trim();

/**
 * Judul tugas MyBest sering sama di banyak mata kuliah ("Pertemuan 2"), jadi
 * pencocokan tugas dengan pengumpulan memakai mata kuliah + judul. Bila salah
 * satu sisi tidak membawa mata kuliah, baru jatuh ke judul saja.
 */
export function isSameTask(a: TaskLike, b: TaskLike) {
  if (norm(a.judul) !== norm(b.judul)) return false;
  const courseA = norm(a.mata_kuliah) || norm(a.kode);
  const courseB = norm(b.mata_kuliah) || norm(b.kode);
  if (!courseA || !courseB) return true;
  return courseA === courseB || (norm(a.kode) !== "" && norm(a.kode) === norm(b.kode));
}

export function findSubmission<T extends TaskLike>(task: TaskLike, submissions: T[]) {
  return submissions.find((s) => isSameTask(task, s));
}

/** "2026-09-29 23:59:00" atau "29-09-2026 23:59" -> Date (zona lokal). */
export function parseDeadline(value?: string | null): Date | null {
  if (!value) return null;
  const iso = value.match(/(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (iso) return new Date(+iso[1], +iso[2] - 1, +iso[3], +(iso[4] ?? 23), +(iso[5] ?? 59));
  const dmy = value.match(/(\d{2})[-/](\d{2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (dmy) return new Date(+dmy[3], +dmy[2] - 1, +dmy[1], +(dmy[4] ?? 23), +(dmy[5] ?? 59));
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export type DeadlineTone = "overdue" | "urgent" | "soon" | "later";

export function describeDeadline(deadline: Date | null, now: Date): { text: string; tone: DeadlineTone } | null {
  if (!deadline) return null;
  const diffMs = deadline.getTime() - now.getTime();
  if (diffMs < 0) return { text: "Lewat batas", tone: "overdue" };
  const hours = Math.floor(diffMs / 3_600_000);
  if (hours < 24) return { text: hours < 1 ? "Kurang dari 1 jam" : `Sisa ${hours} jam`, tone: "urgent" };
  const days = Math.floor(hours / 24);
  return { text: `Sisa ${days} hari`, tone: days <= 3 ? "soon" : "later" };
}

/** Format tanggal pendek Indonesia: "Sen, 29 Sep 23.59". */
export function formatShortDate(date: Date | null, fallback?: string | null) {
  if (!date) return fallback || "-";
  return date.toLocaleString("id-ID", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
