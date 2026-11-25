import { gradeValue, parseDeadline } from "./assignments";

export type TaskSortKey = "default" | "pertemuan_desc" | "nilai_desc" | "nilai_asc" | "matkul_asc";
export type GradeStatusFilter = "all" | "graded" | "ungraded";
export type GradeSortKey = "pertemuan_desc" | "pertemuan_asc" | "nilai_desc" | "nilai_asc" | "tanggal_desc";
export type KhsSortKey = "no" | "mutu_desc" | "mutu_asc" | "sks_desc" | "nama_asc";
export type KrsSortKey = "no" | "sks_desc" | "nama_asc" | "kode_asc";

export const TASK_SORT_OPTIONS: { value: TaskSortKey; label: string }[] = [
  { value: "default", label: "Prioritas deadline" },
  { value: "pertemuan_desc", label: "Pertemuan terbaru" },
  { value: "nilai_desc", label: "Nilai tertinggi" },
  { value: "nilai_asc", label: "Nilai terendah" },
  { value: "matkul_asc", label: "Mata kuliah A-Z" },
];

export const GRADE_SORT_OPTIONS: { value: GradeSortKey; label: string }[] = [
  { value: "pertemuan_desc", label: "Pertemuan terbaru" },
  { value: "pertemuan_asc", label: "Pertemuan terlama" },
  { value: "nilai_desc", label: "Nilai tertinggi" },
  { value: "nilai_asc", label: "Nilai terendah" },
  { value: "tanggal_desc", label: "Tanggal kumpul terbaru" },
];

export const GRADE_STATUS_OPTIONS: { value: GradeStatusFilter; label: string }[] = [
  { value: "all", label: "Semua status" },
  { value: "graded", label: "Sudah dinilai" },
  { value: "ungraded", label: "Belum dinilai" },
];

export const KHS_SORT_OPTIONS: { value: KhsSortKey; label: string }[] = [
  { value: "no", label: "Urutan KHS" },
  { value: "mutu_desc", label: "Nilai tertinggi" },
  { value: "mutu_asc", label: "Nilai terendah" },
  { value: "sks_desc", label: "SKS terbanyak" },
  { value: "nama_asc", label: "Nama A-Z" },
];

export const KRS_SORT_OPTIONS: { value: KrsSortKey; label: string }[] = [
  { value: "no", label: "Urutan KRS" },
  { value: "sks_desc", label: "SKS terbanyak" },
  { value: "nama_asc", label: "Nama A-Z" },
  { value: "kode_asc", label: "Kode A-Z" },
];

const GRADE_LETTER_RANK: Record<string, number> = {
  A: 10,
  "A-": 9,
  "B+": 8,
  B: 7,
  "B-": 6,
  "C+": 5,
  C: 4,
  "C-": 3,
  D: 2,
  E: 1,
};

const cmpText = (a?: string | null, b?: string | null) =>
  (a ?? "").trim().localeCompare((b ?? "").trim(), "id", { sensitivity: "base" });

/** Ambil angka pertemuan ("10", "Pertemuan 10", "P10") -> 10, atau -1 jika tidak ada angka. */
export function parsePertemuanNumber(pertemuan?: string | number | null): number {
  if (typeof pertemuan === "number") return Number.isFinite(pertemuan) ? pertemuan : -1;
  const match = String(pertemuan ?? "").match(/\d+/);
  return match ? Number(match[0]) : -1;
}

export function courseKey(kode?: string | null, nama?: string | null): string {
  const k = (kode ?? "").trim();
  if (k) return k;
  return (nama ?? "").trim().toLowerCase() || "-";
}

export interface SortableTaskRow {
  task: {
    kode?: string;
    mata_kuliah?: string;
    judul: string;
    pertemuan?: string;
  };
  submission?: {
    nilai?: string | number | null;
  };
  deadline: Date | null;
}

export function filterAndSortTaskRows<T extends SortableTaskRow>(
  rows: readonly T[],
  courseFilter: string,
  sort: TaskSortKey,
): T[] {
  const filtered =
    courseFilter === "all"
      ? [...rows]
      : rows.filter((r) => courseKey(r.task.kode, r.task.mata_kuliah) === courseFilter);

  if (sort === "default") return filtered;

  return filtered.sort((a, b) => {
    if (sort === "pertemuan_desc") {
      const diff = parsePertemuanNumber(b.task.pertemuan) - parsePertemuanNumber(a.task.pertemuan);
      if (diff !== 0) return diff;
      return (b.deadline?.getTime() ?? 0) - (a.deadline?.getTime() ?? 0);
    }
    if (sort === "nilai_desc" || sort === "nilai_asc") {
      const scoreA = gradeValue(a.submission?.nilai);
      const scoreB = gradeValue(b.submission?.nilai);
      if (scoreA === null && scoreB === null) {
        return parsePertemuanNumber(b.task.pertemuan) - parsePertemuanNumber(a.task.pertemuan);
      }
      if (scoreA === null) return 1;
      if (scoreB === null) return -1;
      const diff = sort === "nilai_desc" ? scoreB - scoreA : scoreA - scoreB;
      if (diff !== 0) return diff;
      return cmpText(a.task.mata_kuliah || a.task.judul, b.task.mata_kuliah || b.task.judul);
    }
    const courseDiff = cmpText(a.task.mata_kuliah || a.task.kode, b.task.mata_kuliah || b.task.kode);
    if (courseDiff !== 0) return courseDiff;
    return parsePertemuanNumber(b.task.pertemuan) - parsePertemuanNumber(a.task.pertemuan);
  });
}

export interface SortableGradeItem {
  id: string;
  kode?: string;
  mata_kuliah?: string;
  judul: string;
  pertemuan?: string;
  tanggal_kumpul?: string;
  nilai?: number | string | null;
}

export function filterAndSortGradeItems<T extends SortableGradeItem>(
  items: readonly T[],
  options: { course: string; status: GradeStatusFilter; sort: GradeSortKey },
): T[] {
  const { course, status, sort } = options;
  const filtered = items.filter((item) => {
    if (course !== "all" && courseKey(item.kode, item.mata_kuliah) !== course) return false;
    const score = gradeValue(item.nilai);
    if (status === "graded" && score === null) return false;
    if (status === "ungraded" && score !== null) return false;
    return true;
  });

  return filtered.sort((a, b) => {
    if (sort === "pertemuan_desc" || sort === "pertemuan_asc") {
      const diff = parsePertemuanNumber(a.pertemuan) - parsePertemuanNumber(b.pertemuan);
      if (diff !== 0) return sort === "pertemuan_desc" ? -diff : diff;
      return cmpText(a.mata_kuliah || a.judul, b.mata_kuliah || b.judul);
    }
    if (sort === "nilai_desc" || sort === "nilai_asc") {
      const scoreA = gradeValue(a.nilai);
      const scoreB = gradeValue(b.nilai);
      if (scoreA === null && scoreB === null) {
        return parsePertemuanNumber(b.pertemuan) - parsePertemuanNumber(a.pertemuan);
      }
      if (scoreA === null) return 1;
      if (scoreB === null) return -1;
      const diff = sort === "nilai_desc" ? scoreB - scoreA : scoreA - scoreB;
      if (diff !== 0) return diff;
      return parsePertemuanNumber(b.pertemuan) - parsePertemuanNumber(a.pertemuan);
    }
    const dateA = parseDeadline(a.tanggal_kumpul)?.getTime() ?? -1;
    const dateB = parseDeadline(b.tanggal_kumpul)?.getTime() ?? -1;
    if (dateA !== dateB) return dateB - dateA;
    return parsePertemuanNumber(b.pertemuan) - parsePertemuanNumber(a.pertemuan);
  });
}

export interface GradePertemuanGroup<T extends SortableGradeItem> {
  pertemuan: string;
  total_tugas: number;
  sudah_dinilai: number;
  rata_nilai: number | null;
  items: T[];
}

export function groupGradesByPertemuan<T extends SortableGradeItem>(
  items: readonly T[],
  order: "desc" | "asc",
): GradePertemuanGroup<T>[] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const label = (item.pertemuan ?? "").trim() || "-";
    const list = buckets.get(label);
    if (list) list.push(item);
    else buckets.set(label, [item]);
  }
  const groups = Array.from(buckets.entries()).map(([pertemuan, list]) => {
    const graded = list.map((i) => gradeValue(i.nilai)).filter((v): v is number => v !== null);
    const rata = graded.length ? graded.reduce((acc, v) => acc + v, 0) / graded.length : null;
    return {
      pertemuan,
      total_tugas: list.length,
      sudah_dinilai: graded.length,
      rata_nilai: rata,
      items: list,
    };
  });
  return groups.sort((a, b) => {
    const diff = parsePertemuanNumber(a.pertemuan) - parsePertemuanNumber(b.pertemuan);
    if (diff !== 0) return order === "desc" ? -diff : diff;
    return cmpText(a.pertemuan, b.pertemuan);
  });
}

export interface SortableKhsItem {
  no: number;
  kode: string;
  mata_kuliah: string;
  sks: number;
  nilai: string;
  mutu: number;
}

export function sortKhsItems<T extends SortableKhsItem>(items: readonly T[], sort: KhsSortKey): T[] {
  const copy = [...items];
  if (sort === "no") return copy.sort((a, b) => a.no - b.no);
  return copy.sort((a, b) => {
    if (sort === "mutu_desc" || sort === "mutu_asc") {
      const rankA = GRADE_LETTER_RANK[(a.nilai ?? "").trim().toUpperCase()] ?? 0;
      const rankB = GRADE_LETTER_RANK[(b.nilai ?? "").trim().toUpperCase()] ?? 0;
      const mutuDiff = (a.mutu ?? 0) - (b.mutu ?? 0);
      const primary = mutuDiff !== 0 ? mutuDiff : rankA - rankB;
      if (primary !== 0) return sort === "mutu_desc" ? -primary : primary;
      return cmpText(a.mata_kuliah, b.mata_kuliah);
    }
    if (sort === "sks_desc") {
      const diff = (b.sks ?? 0) - (a.sks ?? 0);
      if (diff !== 0) return diff;
      return cmpText(a.mata_kuliah, b.mata_kuliah);
    }
    return cmpText(a.mata_kuliah, b.mata_kuliah);
  });
}

export interface SortableKrsItem {
  no: number;
  kode: string;
  mata_kuliah: string;
  sks: number;
}

export function sortKrsItems<T extends SortableKrsItem>(items: readonly T[], sort: KrsSortKey): T[] {
  const copy = [...items];
  if (sort === "no") return copy.sort((a, b) => a.no - b.no);
  return copy.sort((a, b) => {
    if (sort === "sks_desc") {
      const diff = (b.sks ?? 0) - (a.sks ?? 0);
      if (diff !== 0) return diff;
      return cmpText(a.mata_kuliah, b.mata_kuliah);
    }
    if (sort === "nama_asc") {
      return cmpText(a.mata_kuliah, b.mata_kuliah);
    }
    return cmpText(a.kode, b.kode);
  });
}
