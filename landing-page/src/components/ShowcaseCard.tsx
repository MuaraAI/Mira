"use client";

import { gradeValue } from "@/lib/assignments";
import { PixelBolt, PixelCrown, PixelShield } from "@/components/PixelIcons";

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
  total_mutu?: number;
  total_sks: number;
  ipk: number;
}

export interface KrsData {
  items: { kode: string; mata_kuliah: string; sks: number }[];
  total_sks: number;
  semester: number;
}

export interface GradeItem {
  id?: string;
  kode: string;
  nama: string;
  sks: number;
  absen?: number | null;
  tugas?: number | null;
  uts?: number | null;
  uas?: number | null;
  total: number | null;
  grade: string | null;
}

export interface ElearningGrades {
  total_tugas?: number;
  sudah_dinilai?: number;
  belum_dinilai?: number;
  rata_nilai?: number | null;
  nilai_max?: number | null;
  nilai_min?: number | null;
  per_matkul?: Record<string, { total_tugas: number; rata_nilai: number }>;
  per_pertemuan?: {
    pertemuan?: string;
    items: {
      kode?: string;
      mata_kuliah?: string;
      judul?: string;
      nilai?: number | string | null;
    }[];
  }[];
}

export type Theme = "night" | "mist";
export type Format = "post" | "story";
export type ShowcaseVariant = "khs" | "murni" | "elearning";

export const FORMATS: Record<Format, { label: string; width: number; height: number }> = {
  post: { label: "Post 4:5", width: 1080, height: 1350 },
  story: { label: "Story 9:16", width: 1080, height: 1920 },
};

export const VARIANT_OPTIONS: { value: ShowcaseVariant; label: string; shortLabel: string }[] = [
  { value: "khs", label: "Kartu KHS", shortLabel: "KHS" },
  { value: "murni", label: "Rincian Nilai Murni", shortLabel: "Nilai Murni" },
  { value: "elearning", label: "Nilai Tugas MyBest", shortLabel: "Tugas MyBest" },
];

// Ukuran kartu di layar; ekspor dikali pixelRatio supaya hasilnya 1080px tajam.
const CARD_WIDTH = 360;
export const SITE = "mira.muaraai.com";

export interface CourseRow {
  name: string;
  sublabel: string;
  badgeText: string;
}

export interface BadgeInfo {
  code: string;
  subtitle: string;
  rank: string;
  tone: "gold" | "cyan" | "teal";
}

export interface ComponentBar {
  label: string;
  weight: string;
  value: number | null;
}

export interface Showcase {
  name: string;
  nim: string;
  program: string;
  campus: string;
  semester: string;
  // KHS metrics
  ipk: number | null;
  sksPassed: number;
  totalMutu: number;
  coursesPassed: number;
  gradeACount: number;
  khsTopCourses: CourseRow[];
  gradeSpread: { grade: string; count: number }[];
  khsBadge: BadgeInfo;
  // Nilai Murni metrics
  murniAverage: number | null;
  murniCoursesCount: number;
  murniSks: number;
  murniHighest: number | null;
  murniComponents: ComponentBar[];
  murniTopCourses: CourseRow[];
  murniSpread: { grade: string; count: number }[];
  murniBadge: BadgeInfo;
  // Elearning MyBest metrics
  taskAverage: number | null;
  tasksGraded: number;
  tasksTotal: number;
  taskMax: number | null;
  taskMin: number | null;
  elearningCoursesCount: number;
  elearningTopCourses: CourseRow[];
  elearningSpread: { grade: string; count: number }[];
  elearningBadge: BadgeInfo;
}

const GRADE_ORDER = ["A", "A-", "B+", "B", "B-", "C+", "C", "D", "E"];

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function maskNim(nim: string) {
  return nim.length > 4 ? `${nim.slice(0, 4)}${"•".repeat(nim.length - 4)}` : nim;
}

function avg(nums: number[]): number | null {
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
}

function computeKhsBadge(ipk: number | null, gradeACount: number): BadgeInfo {
  if (ipk !== null && ipk >= 3.75) {
    return {
      code: "SUMMA CUM LAUDE",
      subtitle: `${gradeACount} Mata Kuliah Raih Predikat A`,
      rank: "TIER S+",
      tone: "gold",
    };
  }
  if (ipk !== null && ipk >= 3.5) {
    return {
      code: "CUM LAUDE TRACK",
      subtitle: "Konsistensi Indeks Prestasi Unggul",
      rank: "TIER S",
      tone: "gold",
    };
  }
  if (ipk !== null && ipk >= 3.0) {
    return {
      code: "SCHOLAR SOLID",
      subtitle: "Fondasi Transkrip Akademik Kuat",
      rank: "TIER A",
      tone: "cyan",
    };
  }
  return {
    code: "RISING ESTUARY",
    subtitle: "Perjalanan Akademik Semester Aktif",
    rank: "TIER B",
    tone: "teal",
  };
}

function computeMurniBadge(
  murniAvg: number | null,
  examAvg: number | null,
  absenAvg: number | null,
): BadgeInfo {
  if (murniAvg !== null && murniAvg >= 85) {
    return {
      code: "ALL-ROUNDER ACE",
      subtitle: "Dominan di Absen, Tugas, UTS & UAS",
      rank: "TIER S+",
      tone: "cyan",
    };
  }
  if (examAvg !== null && examAvg >= 85) {
    return {
      code: "EXAM SLAYER",
      subtitle: "Performa Ujian UTS & UAS Tertinggi",
      rank: "TIER S",
      tone: "cyan",
    };
  }
  if (absenAvg !== null && absenAvg >= 98) {
    return {
      code: "IRON ATTENDANCE",
      subtitle: "Disiplin Kehadiran Perkuliahan Penuh",
      rank: "TIER A",
      tone: "teal",
    };
  }
  return {
    code: "ACTIVE CONTENDER",
    subtitle: "Rincian Komponen Nilai Semester",
    rank: "TIER B",
    tone: "gold",
  };
}

function computeElearningBadge(
  taskAvg: number | null,
  tasksGraded: number,
  tasksTotal: number,
  taskMax: number | null,
): BadgeInfo {
  if (taskAvg !== null && taskAvg >= 90 && tasksGraded >= 2) {
    return {
      code: "TASK GRANDMASTER",
      subtitle: "Rata-Rata Nilai Tugas MyBest Istimewa",
      rank: "TIER S+",
      tone: "teal",
    };
  }
  if (tasksTotal > 0 && tasksGraded === tasksTotal) {
    return {
      code: "ZERO DEADLINE",
      subtitle: "Seluruh Tugas Terkumpul & Dinilai",
      rank: "TIER S",
      tone: "teal",
    };
  }
  if (taskMax !== null && taskMax >= 100) {
    return {
      code: "PERFECT 100 CLUB",
      subtitle: "Menembus Skor Sempurna 100 di MyBest",
      rank: "TIER A",
      tone: "gold",
    };
  }
  return {
    code: "MYBEST GRINDER",
    subtitle: "Konsistensi Evaluasi Tugas Mingguan",
    rank: "TIER B",
    tone: "cyan",
  };
}

export function buildShowcase(
  profile: StudentProfile | null,
  khs: KhsData | null,
  krs: KrsData | null,
  grades: GradeItem[] | null,
  elearning: ElearningGrades | null,
): Showcase {
  const rank = (grade: string) => {
    const index = GRADE_ORDER.indexOf(grade.toUpperCase());
    return index === -1 ? GRADE_ORDER.length : index;
  };

  // 1. KHS Data
  const passed = (khs?.items ?? []).filter((item) => item.nilai && item.nilai !== "-");
  const gradeACount = passed.filter((item) => item.nilai.toUpperCase().startsWith("A")).length;
  const khsTopCourses: CourseRow[] = [...passed]
    .sort((a, b) => rank(a.nilai) - rank(b.nilai) || b.mutu - a.mutu || b.sks - a.sks)
    .slice(0, 5)
    .map((item) => ({
      name: item.mata_kuliah,
      sublabel: `${item.sks} SKS · Mutu ${item.mutu}`,
      badgeText: item.nilai,
    }));

  const khsSpreadMap = new Map<string, number>();
  for (const item of passed) {
    const letter = item.nilai.toUpperCase().charAt(0);
    khsSpreadMap.set(letter, (khsSpreadMap.get(letter) ?? 0) + 1);
  }
  const gradeSpread = ["A", "B", "C", "D", "E"]
    .map((grade) => ({ grade, count: khsSpreadMap.get(grade) ?? 0 }))
    .filter((g) => g.count > 0);

  const ipkVal = khs && khs.total_sks > 0 ? khs.ipk : null;
  const totalMutu =
    khs?.total_mutu ?? passed.reduce((acc, item) => acc + (Number(item.mutu) || 0), 0);

  // 2. Rincian Nilai Murni Data
  const murniItems = (grades ?? []).filter(
    (g) => g.total !== null || (g.grade && g.grade !== "-"),
  );
  const absenVals = (grades ?? []).map((g) => g.absen).filter((v): v is number => typeof v === "number");
  const tugasVals = (grades ?? []).map((g) => g.tugas).filter((v): v is number => typeof v === "number");
  const utsVals = (grades ?? []).map((g) => g.uts).filter((v): v is number => typeof v === "number");
  const uasVals = (grades ?? []).map((g) => g.uas).filter((v): v is number => typeof v === "number");
  const totalVals = (grades ?? []).map((g) => g.total).filter((v): v is number => typeof v === "number");

  const absenAvg = avg(absenVals);
  const tugasAvg = avg(tugasVals);
  const utsAvg = avg(utsVals);
  const uasAvg = avg(uasVals);
  const murniAverage = avg(totalVals);
  const examAvg = avg([...utsVals, ...uasVals]);
  const murniHighest = totalVals.length ? Math.max(...totalVals) : null;
  const murniSks = (grades ?? []).reduce((acc, g) => acc + (g.sks || 0), 0) || (krs?.total_sks ?? 0);

  const murniComponents: ComponentBar[] = [
    { label: "ABSEN", weight: "20%", value: absenAvg },
    { label: "TUGAS", weight: "25%", value: tugasAvg },
    { label: "UTS", weight: "25%", value: utsAvg },
    { label: "UAS", weight: "30%", value: uasAvg },
  ];

  const murniTopCourses: CourseRow[] = [...(grades ?? [])]
    .sort((a, b) => (b.total ?? -1) - (a.total ?? -1) || rank(a.grade || "Z") - rank(b.grade || "Z"))
    .slice(0, 5)
    .map((g) => ({
      name: g.nama,
      sublabel: `UTS ${g.uts ?? "-"} · UAS ${g.uas ?? "-"} · Tgs ${g.tugas ?? "-"}`,
      badgeText: g.total !== null ? `${Math.round(g.total)}${g.grade ? `/${g.grade}` : ""}` : g.grade || "-",
    }));

  const murniSpreadMap = new Map<string, number>();
  for (const g of murniItems) {
    const letter = (g.grade || "").toUpperCase().charAt(0);
    if (letter) murniSpreadMap.set(letter, (murniSpreadMap.get(letter) ?? 0) + 1);
  }
  const murniSpread = ["A", "B", "C", "D", "E"]
    .map((grade) => ({ grade, count: murniSpreadMap.get(grade) ?? 0 }))
    .filter((g) => g.count > 0);

  // 3. Nilai Tugas MyBest Data
  const rawItems = (elearning?.per_pertemuan ?? []).flatMap((pert) => pert.items);
  const taskValues = rawItems
    .map((item) => gradeValue(item.nilai))
    .filter((value): value is number => value !== null);

  const taskAverage = avg(taskValues);
  const taskMax = taskValues.length ? Math.max(...taskValues) : null;
  const taskMin = taskValues.length ? Math.min(...taskValues) : null;
  const tasksTotal = rawItems.length;
  const tasksGraded = taskValues.length;

  const courseAgg = new Map<string, { name: string; scores: number[] }>();
  for (const item of rawItems) {
    const val = gradeValue(item.nilai);
    if (val === null) continue;
    const key = item.mata_kuliah || item.kode || "Mata Kuliah";
    const cur = courseAgg.get(key) ?? { name: key, scores: [] };
    cur.scores.push(val);
    courseAgg.set(key, cur);
  }

  const elearningTopCourses: CourseRow[] = [...courseAgg.values()]
    .map((entry) => ({
      name: entry.name,
      avgScore: entry.scores.reduce((a, b) => a + b, 0) / entry.scores.length,
      count: entry.scores.length,
    }))
    .sort((a, b) => b.avgScore - a.avgScore || b.count - a.count)
    .slice(0, 5)
    .map((entry) => ({
      name: entry.name,
      sublabel: `${entry.count} Tugas Dinilai`,
      badgeText: entry.avgScore.toFixed(0),
    }));

  const elearningBuckets = [
    { grade: "90+", count: taskValues.filter((v) => v >= 90).length },
    { grade: "80+", count: taskValues.filter((v) => v >= 80 && v < 90).length },
    { grade: "70+", count: taskValues.filter((v) => v >= 70 && v < 80).length },
    { grade: "<70", count: taskValues.filter((v) => v < 70).length },
  ].filter((b) => b.count > 0);

  return {
    name: titleCase(profile?.nama ?? "Mahasiswa UBSI"),
    nim: profile?.nim ?? "",
    program: profile?.program_studi ?? "",
    campus: profile?.lokasi_cabang ?? "",
    semester: profile?.semester_aktif || (krs?.semester ? String(krs.semester) : ""),
    ipk: ipkVal,
    sksPassed: khs?.total_sks ?? 0,
    totalMutu,
    coursesPassed: passed.length,
    gradeACount,
    khsTopCourses,
    gradeSpread,
    khsBadge: computeKhsBadge(ipkVal, gradeACount),
    murniAverage,
    murniCoursesCount: (grades ?? []).length,
    murniSks,
    murniHighest,
    murniComponents,
    murniTopCourses,
    murniSpread: murniSpread.length ? murniSpread : gradeSpread,
    murniBadge: computeMurniBadge(murniAverage, examAvg, absenAvg),
    taskAverage,
    tasksGraded,
    tasksTotal,
    taskMax,
    taskMin,
    elearningCoursesCount: courseAgg.size,
    elearningTopCourses,
    elearningSpread: elearningBuckets,
    elearningBadge: computeElearningBadge(taskAverage, tasksGraded, tasksTotal, taskMax),
  };
}

export function getVariantBadge(data: Showcase, variant: ShowcaseVariant): BadgeInfo {
  if (variant === "murni") return data.murniBadge;
  if (variant === "elearning") return data.elearningBadge;
  return data.khsBadge;
}

function VariantBadgeIcon({ variant, className }: { variant: ShowcaseVariant; className?: string }) {
  if (variant === "murni") return <PixelShield className={className} aria-hidden="true" />;
  if (variant === "elearning") return <PixelBolt className={className} aria-hidden="true" />;
  return <PixelCrown className={className} aria-hidden="true" />;
}

export function ShowcaseCard({
  data,
  theme,
  format,
  hideNim,
  variant = "khs",
}: {
  data: Showcase;
  theme: Theme;
  format: Format;
  hideNim: boolean;
  variant?: ShowcaseVariant;
}) {
  const { width, height } = FORMATS[format];
  const scale = CARD_WIDTH / width;
  const badge = getVariantBadge(data, variant);

  const config =
    variant === "murni"
      ? {
          chip: "RINCIAN NILAI MURNI",
          mascot: "/maskot/mura-kuis.png",
          mascotCaption: "SIAKAD KOMPONEN",
          hero: {
            label: "Rata-rata Nilai Akhir Murni",
            value: data.murniAverage !== null ? data.murniAverage.toFixed(1) : "0.0",
            suffix: "/ 100",
            ratio: data.murniAverage !== null ? Math.min(1, data.murniAverage / 100) : 0,
          },
          tiles: [
            { label: "Matkul dinilai", value: String(data.murniCoursesCount) },
            { label: "Total SKS", value: String(data.murniSks) },
            { label: "Skor tertinggi", value: data.murniHighest !== null ? data.murniHighest.toFixed(0) : "-" },
          ],
          coursesTitle: "Skor Murni Tertinggi",
          courses: data.murniTopCourses,
          spreadTitle: "Sebaran Grade Murni",
          spread: data.murniSpread,
        }
      : variant === "elearning"
        ? {
            chip: "NILAI TUGAS MYBEST",
            mascot: "/maskot/mura-tugas-done.png",
            mascotCaption: "MYBEST E-LEARNING",
            hero: {
              label: "Rata-rata Skor Tugas MyBest",
              value: data.taskAverage !== null ? data.taskAverage.toFixed(1) : "0.0",
              suffix: "/ 100",
              ratio: data.taskAverage !== null ? Math.min(1, data.taskAverage / 100) : 0,
            },
            tiles: [
              { label: "Tugas dinilai", value: `${data.tasksGraded}/${data.tasksTotal}` },
              { label: "Skor tertinggi", value: data.taskMax !== null ? String(data.taskMax) : "-" },
              { label: "Skor terendah", value: data.taskMin !== null ? String(data.taskMin) : "-" },
              { label: "Matkul aktif", value: String(data.elearningCoursesCount) },
            ].slice(0, format === "story" ? 3 : 4),
            coursesTitle: "Rata-rata Tugas per Matkul",
            courses: data.elearningTopCourses,
            spreadTitle: "Distribusi Skor Tugas",
            spread: data.elearningSpread,
          }
        : {
            chip: "KARTU HASIL STUDI (KHS)",
            mascot: "/maskot/mura-nilai.png",
            mascotCaption: "TRANSKRIP KHS",
            hero: {
              label: "Indeks Prestasi Kumulatif",
              value: data.ipk !== null ? data.ipk.toFixed(2) : "0.00",
              suffix: "/ 4.00",
              ratio: data.ipk !== null ? Math.min(1, data.ipk / 4) : 0,
            },
            tiles: [
              { label: "SKS lulus", value: String(data.sksPassed) },
              { label: "Matkul lulus", value: String(data.coursesPassed) },
              { label: "Total mutu", value: data.totalMutu.toFixed(0) },
              { label: "Predikat A", value: String(data.gradeACount) },
            ].slice(0, format === "story" ? 3 : 4),
            coursesTitle: "Mata Kuliah Terbaik (KHS)",
            courses: data.khsTopCourses,
            spreadTitle: "Sebaran Nilai Huruf",
            spread: data.gradeSpread,
          };

  const segments = 20;
  const lit = Math.round(config.hero.ratio * segments);
  const maxSpread = Math.max(1, ...config.spread.map((g) => g.count));

  return (
    <div className="flexcard-frame" style={{ width: CARD_WIDTH, height: height * scale }}>
      <div
        className="flexcard-card"
        data-theme={theme}
        data-format={format}
        data-variant={variant}
        style={{ width, height, transform: `scale(${scale})` }}
      >
        <div className="flexcard-grid" aria-hidden="true" />

        <header className="flexcard-head">
          <span className="flexcard-chip">{config.chip}</span>
          {data.semester && <span className="flexcard-chip flexcard-chip-soft">SEMESTER {data.semester}</span>}
          <span className="flexcard-chip flexcard-chip-rank">{badge.rank}</span>
        </header>

        <section className="flexcard-identity-row">
          <div className="flexcard-identity">
            <h2 className="flexcard-name" data-long={data.name.length > 22}>
              {data.name}
            </h2>
            <p className="flexcard-meta">
              {[data.program, data.campus].filter(Boolean).join(" · ")}
            </p>
            {data.nim && <p className="flexcard-nim">NIM {hideNim ? maskNim(data.nim) : data.nim}</p>}
          </div>

          <div className="flexcard-visual">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={config.mascot} alt="" width={164} height={164} className="flexcard-mascot" />
            <span className="flexcard-visual-tag">{config.mascotCaption}</span>
          </div>
        </section>

        {/* Distinct Achievement Badge Banner */}
        <section className="flexcard-badge" data-tone={badge.tone}>
          <div className="flexcard-badge-icon">
            <VariantBadgeIcon variant={variant} className="h-11 w-11" />
          </div>
          <div className="flexcard-badge-body">
            <p className="flexcard-badge-kicker">ACHIEVEMENT BADGE · {badge.rank}</p>
            <p className="flexcard-badge-title">{badge.code}</p>
            <p className="flexcard-badge-sub">{badge.subtitle}</p>
          </div>
        </section>

        <section className="flexcard-hero">
          <p className="flexcard-label">{config.hero.label}</p>
          <p className="flexcard-hero-value">
            {config.hero.value}
            <span className="flexcard-hero-suffix">{config.hero.suffix}</span>
          </p>
          <div className="flexcard-meter" aria-hidden="true">
            {Array.from({ length: segments }, (_, i) => (
              <span key={i} data-on={i < lit} />
            ))}
          </div>
        </section>

        {/* Variant-specific middle visual: 4-Component Bars for Nilai Murni, Tiles for KHS & Elearning */}
        {variant === "murni" ? (
          <section className="flexcard-comp-grid">
            {data.murniComponents.map((comp) => {
              const pct = comp.value !== null ? Math.min(100, Math.max(0, comp.value)) : 0;
              return (
                <div key={comp.label} className="flexcard-comp-item">
                  <div className="flexcard-comp-top">
                    <span className="flexcard-comp-name">
                      {comp.label} <small>({comp.weight})</small>
                    </span>
                    <span className="flexcard-comp-val">
                      {comp.value !== null ? comp.value.toFixed(1) : "-"}
                    </span>
                  </div>
                  <div className="flexcard-comp-track" aria-hidden="true">
                    <span className="flexcard-comp-fill" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </section>
        ) : (
          <section className="flexcard-tiles">
            {config.tiles.map((tile) => (
              <div key={tile.label} className="flexcard-tile">
                <p className="flexcard-tile-value">{tile.value}</p>
                <p className="flexcard-label">{tile.label}</p>
              </div>
            ))}
          </section>
        )}

        {config.courses.length > 0 && (
          <section className="flexcard-courses">
            <p className="flexcard-label">{config.coursesTitle}</p>
            <ul>
              {config.courses.slice(0, format === "story" ? 4 : 3).map((course) => (
                <li key={course.name}>
                  <span className="flexcard-course-name">{titleCase(course.name)}</span>
                  <span className="flexcard-course-sks">{course.sublabel}</span>
                  <span className="flexcard-grade">{course.badgeText}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {format === "story" && config.spread.length > 0 && (
          <section className="flexcard-spread">
            <p className="flexcard-label">{config.spreadTitle}</p>
            <div className="flexcard-bars">
              {config.spread.map((g) => (
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
