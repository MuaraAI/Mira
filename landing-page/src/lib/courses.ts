/** Helper mata kuliah lintas SIAKAD dan MyBest. */

interface CourseLike {
  kode?: string;
  kode_mtk?: string;
  nama?: string;
  kode_dosen?: string;
  dosen_code?: string;
}

interface ScheduleLike {
  kode?: string;
  nama?: string;
  kode_dosen?: string;
}

const norm = (v?: string | null) => (v ?? "").toLowerCase().replace(/\s+/g, " ").trim();
const present = (v?: string | null) => (v && v.trim() && v.trim() !== "-" ? v.trim() : "");

/**
 * Kode dosen pengampu: dari kartu MyBest (`kode_dosen`), lalu dari jadwal SIAKAD
 * dengan kode atau nama mata kuliah yang sama. "-" artinya memang tidak tercantum.
 */
export function resolveDosen(course?: CourseLike | null, schedule?: ScheduleLike[] | null, preferred?: string | null): string {
  const direct = present(preferred) || present(course?.kode_dosen) || present(course?.dosen_code);
  if (direct) return direct;
  if (!course || !schedule) return "-";
  const kode = norm(course.kode_mtk || course.kode);
  const match =
    schedule.find((s) => kode && norm(s.kode) === kode && present(s.kode_dosen)) ||
    schedule.find((s) => norm(s.nama) === norm(course.nama) && present(s.kode_dosen));
  return present(match?.kode_dosen) || "-";
}
