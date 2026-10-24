"use client";

import { gradeValue } from "@/lib/assignments";

export interface StudentProfile {
  nim?: string;
  nama?: string;
  program_studi?: string;
  lokasi_cabang?: string;
  kelas?: string;
  semester_aktif?: string;
}

export interface KhsData {
  items: { kode: string; mata_kuliah: string; sks: number; nilai: string; mutu: number }[];
  total_sks: number;
  ipk: number;
}

export interface KrsData {
  items: { kode: string; mata_kuliah: string; sks: number }[];
  total_sks: number;
  semester: number;
}

export interface GradeItem {
  kode: string;
  nama: string;
  sks: number;
  total: number | null;
  grade: string | null;
}

export interface ElearningGrades {
  per_pertemuan?: { items: { nilai?: number | string | null }[] }[];
}

export type Theme = "night" | "mist";
export type Format = "post" | "story";

export const FORMATS: Record<Format, { label: string; width: number; height: number }> = {
  post: { label: "Post 4:5", width: 1080, height: 1350 },
  story: { label: "Story 9:16", width: 1080, height: 1920 },
};

// Ukuran kartu di layar; ekspor dikali pixelRatio supaya hasilnya 1080px tajam.
const CARD_WIDTH = 360;
export const SITE = "mira.muaraai.com";

interface CourseRow {
  name: string;
  grade: string;
  sks: number;
}

export interface Showcase {
  name: string;
  nim: string;
  program: string;
  campus: string;
  semester: string;
  ipk: number | null;
  sksPassed: number;
  coursesPassed: number;
  sksNow: number;
  coursesNow: number;
  taskAverage: number | null;
  tasksGraded: number;
  topCourses: CourseRow[];
  gradeSpread: { grade: string; count: number }[];
}

const GRADE_ORDER = ["A", "A-", "B+", "B", "B-", "C+", "C", "D", "E"];

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function maskNim(nim: string) {
  return nim.length > 4 ? `${nim.slice(0, 4)}${"•".repeat(nim.length - 4)}` : nim;
}

export function buildShowcase(
  profile: StudentProfile | null,
  khs: KhsData | null,
  krs: KrsData | null,
  grades: GradeItem[] | null,
  elearning: ElearningGrades | null,
): Showcase {
  const passed = (khs?.items ?? []).filter((item) => item.nilai && item.nilai !== "-");
  const current = (grades ?? []).filter((item) => item.grade && item.grade !== "-");

  // Semester berjalan sudah punya nilai murni? pakai itu; kalau belum, pakai KHS.
  const rows: CourseRow[] = (current.length
    ? current.map((item) => ({ name: item.nama, grade: item.grade as string, sks: item.sks }))
    : passed.map((item) => ({ name: item.mata_kuliah, grade: item.nilai, sks: item.sks })));
  const rank = (grade: string) => {
    const index = GRADE_ORDER.indexOf(grade.toUpperCase());
    return index === -1 ? GRADE_ORDER.length : index;
  };
  const topCourses = [...rows].sort((a, b) => rank(a.grade) - rank(b.grade) || b.sks - a.sks).slice(0, 5);

  const spread = new Map<string, number>();
  for (const row of rows) {
    const letter = row.grade.toUpperCase().charAt(0);
    spread.set(letter, (spread.get(letter) ?? 0) + 1);
  }

  const taskValues = (elearning?.per_pertemuan ?? [])
    .flatMap((pert) => pert.items)
    .map((item) => gradeValue(item.nilai))
    .filter((value): value is number => value !== null);

  return {
    name: titleCase(profile?.nama ?? "Mahasiswa UBSI"),
    nim: profile?.nim ?? "",
    program: profile?.program_studi ?? "",
    campus: profile?.lokasi_cabang ?? "",
    semester: profile?.semester_aktif || (krs?.semester ? String(krs.semester) : ""),
    ipk: khs && khs.total_sks > 0 ? khs.ipk : null,
    sksPassed: khs?.total_sks ?? 0,
    coursesPassed: passed.length,
    sksNow: krs?.total_sks ?? 0,
    coursesNow: krs?.items.length ?? 0,
    taskAverage: taskValues.length ? taskValues.reduce((a, b) => a + b, 0) / taskValues.length : null,
    tasksGraded: taskValues.length,
    topCourses,
    gradeSpread: ["A", "B", "C", "D", "E"].map((grade) => ({ grade, count: spread.get(grade) ?? 0 })).filter((g) => g.count > 0),
  };
}

export function ShowcaseCard({ data, theme, format, hideNim }: { data: Showcase; theme: Theme; format: Format; hideNim: boolean }) {
  const { width, height } = FORMATS[format];
  const scale = CARD_WIDTH / width;
  const hero =
    data.ipk !== null
      ? { label: "IPK", value: data.ipk.toFixed(2), suffix: "/ 4.00", ratio: data.ipk / 4 }
      : data.taskAverage !== null
        ? { label: "Rata-rata nilai tugas", value: data.taskAverage.toFixed(1), suffix: "/ 100", ratio: data.taskAverage / 100 }
        : { label: "SKS semester ini", value: String(data.sksNow), suffix: "SKS", ratio: Math.min(1, data.sksNow / 24) };
  const segments = 20;
  const lit = Math.round(hero.ratio * segments);
  // Hanya angka yang benar-benar ada isinya (mahasiswa semester 1 belum punya SKS lulus).
  const tiles = [
    { label: "SKS lulus", value: data.sksPassed },
    { label: "Matkul lulus", value: data.coursesPassed },
    { label: "SKS semester ini", value: data.sksNow },
    { label: "Matkul diambil", value: data.coursesNow },
    { label: "Tugas dinilai", value: data.tasksGraded },
    { label: "Rata-rata tugas", value: data.ipk !== null && data.taskAverage !== null ? data.taskAverage.toFixed(1) : 0 },
  ]
    .filter((tile) => tile.value !== 0)
    .slice(0, format === "story" ? 3 : 4);
  const maxSpread = Math.max(1, ...data.gradeSpread.map((g) => g.count));

  return (
    <div className="flexcard-frame" style={{ width: CARD_WIDTH, height: height * scale }}>
      <div
        className="flexcard-card"
        data-theme={theme}
        data-format={format}
        style={{ width, height, transform: `scale(${scale})` }}
      >
        <div className="flexcard-grid" aria-hidden="true" />

        <header className="flexcard-head">
          <span className="flexcard-chip">FLEXING NILAI</span>
          {data.semester && <span className="flexcard-chip flexcard-chip-soft">SEMESTER {data.semester}</span>}
        </header>

        <section className="flexcard-identity">
          <h2 className="flexcard-name" data-long={data.name.length > 24}>
            {data.name}
          </h2>
          <p className="flexcard-meta">
            {[data.program, data.campus].filter(Boolean).join(" · ")}
          </p>
          {data.nim && <p className="flexcard-nim">NIM {hideNim ? maskNim(data.nim) : data.nim}</p>}
        </section>

        <section className="flexcard-hero">
          <p className="flexcard-label">{hero.label}</p>
          <p className="flexcard-hero-value">
            {hero.value}
            <span className="flexcard-hero-suffix">{hero.suffix}</span>
          </p>
          <div className="flexcard-meter" aria-hidden="true">
            {Array.from({ length: segments }, (_, i) => (
              <span key={i} data-on={i < lit} />
            ))}
          </div>
        </section>

        <section className="flexcard-tiles">
          {tiles.map((tile) => (
            <div key={tile.label} className="flexcard-tile">
              <p className="flexcard-tile-value">{tile.value}</p>
              <p className="flexcard-label">{tile.label}</p>
            </div>
          ))}
        </section>

        {data.topCourses.length > 0 && (
          <section className="flexcard-courses">
            <p className="flexcard-label">Matkul terbaik</p>
            <ul>
              {data.topCourses.slice(0, format === "story" ? 5 : 3).map((course) => (
                <li key={course.name}>
                  <span className="flexcard-course-name">{titleCase(course.name)}</span>
                  <span className="flexcard-course-sks">{course.sks} SKS</span>
                  <span className="flexcard-grade">{course.grade}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {format === "story" && data.gradeSpread.length > 0 && (
          <section className="flexcard-spread">
            <p className="flexcard-label">Sebaran nilai</p>
            <div className="flexcard-bars">
              {data.gradeSpread.map((g) => (
                <div key={g.grade} className="flexcard-bar">
                  <span className="flexcard-bar-fill" style={{ height: `${(g.count / maxSpread) * 100}%` }} />
                  <span className="flexcard-bar-label">
                    {g.grade} · {g.count}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <footer className="flexcard-footer">
          <div className="flexcard-watermark">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/logo.png" alt="" width={56} height={56} />
            <div>
              <p className="flexcard-watermark-url">{SITE}</p>
              <p className="flexcard-watermark-sub">Dibuat dengan Mira · Muara AI</p>
            </div>
          </div>
          <p className="flexcard-date">
            {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </footer>
      </div>
    </div>
  );
}

