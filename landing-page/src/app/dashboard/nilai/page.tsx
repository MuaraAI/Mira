"use client";

import { SiakadGateNotice, siakadGateIssue } from "@/components/SiakadGateNotice";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown, BookOpen, Download, Eye, EyeOff, FileSpreadsheet, Filter, Share2, X } from "lucide-react";
import { toPng } from "html-to-image";
import { useApi } from "@/lib/api";
import { gradeValue } from "@/lib/assignments";
import {
  GRADE_SORT_OPTIONS,
  GRADE_STATUS_OPTIONS,
  courseKey,
  filterAndSortGradeItems,
  groupGradesByPertemuan,
  type GradeSortKey,
  type GradeStatusFilter,
} from "@/lib/dashboard-sort";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  ghostButtonClass,
  primaryButtonClass,
} from "@/components/dashboard-ui";
import { KhsSemesterCard } from "@/components/KhsSemesterCard";
import {
  FORMATS,
  SITE,
  ShowcaseCard,
  buildShowcase,
  type Format,
  type StudentProfile,
  type Theme,
} from "@/components/ShowcaseCard";
import { PixelTrophy } from "@/components/PixelIcons";
import { SideSheet } from "@/components/SideSheet";

interface ElearningSubmissionItem {
  id: string;
  kode?: string;
  mata_kuliah?: string;
  judul: string;
  pertemuan?: string;
  tanggal_kumpul?: string;
  nilai?: number | string | null;
  komentar_dosen?: string | null;
}

interface ElearningPertemuanGrade {
  pertemuan: string;
  total_tugas: number;
  sudah_dinilai: number;
  belum_dinilai: number;
  rata_nilai: number | null;
  nilai_max: number | null;
  nilai_min: number | null;
  items: ElearningSubmissionItem[];
}

interface ElearningGradesData {
  total_tugas: number;
  sudah_dinilai: number;
  belum_dinilai: number;
  rata_nilai: number | null;
  nilai_max: number | null;
  nilai_min: number | null;
  per_matkul: Record<string, { total_tugas: number; rata_nilai: number; nama?: string }>;
  per_pertemuan: ElearningPertemuanGrade[];
}

const average = (values: number[]) =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

/** MyBest memakai 0 untuk tugas yang belum diperiksa dosen: hitung ulang supaya 0 tidak dianggap nilai. */
function normalizeElearningGrades(data: ElearningGradesData | null): ElearningGradesData | null {
  if (!data) return data;
  const perPertemuan = (data.per_pertemuan ?? []).map((pert) => {
    const graded = pert.items
      .map((item) => gradeValue(item.nilai))
      .filter((v): v is number => v !== null);
    return {
      ...pert,
      sudah_dinilai: graded.length,
      belum_dinilai: pert.items.length - graded.length,
      rata_nilai: average(graded),
      nilai_max: graded.length ? Math.max(...graded) : null,
      nilai_min: graded.length ? Math.min(...graded) : null,
    };
  });
  const items = perPertemuan.flatMap((pert) => pert.items);
  const graded = items
    .map((item) => gradeValue(item.nilai))
    .filter((v): v is number => v !== null);
  const perMatkul: ElearningGradesData["per_matkul"] = {};
  for (const item of items) {
    const value = gradeValue(item.nilai);
    if (value === null) continue;
    const key = item.kode || "-";
    const current = perMatkul[key] ?? { total_tugas: 0, rata_nilai: 0, nama: item.mata_kuliah || undefined };
    perMatkul[key] = {
      total_tugas: current.total_tugas + 1,
      rata_nilai: current.rata_nilai + value,
      nama: current.nama || item.mata_kuliah || undefined,
    };
  }
  for (const key of Object.keys(perMatkul)) perMatkul[key].rata_nilai /= perMatkul[key].total_tugas;
  return {
    total_tugas: items.length,
    sudah_dinilai: graded.length,
    belum_dinilai: items.length - graded.length,
    rata_nilai: average(graded),
    nilai_max: graded.length ? Math.max(...graded) : null,
    nilai_min: graded.length ? Math.min(...graded) : null,
    per_matkul: perMatkul,
    per_pertemuan: perPertemuan,
  };
}

export default function NilaiPage() {
  const gradesRaw = useApi<ElearningGradesData>("/v1/elearning/grades");
  const coursesApi = useApi<{ kode?: string; kode_mtk?: string; nama: string }[]>("/v1/elearning/courses");
  const profileApi = useApi<StudentProfile>("/v1/elearning/profile");
  const grades = useMemo(() => normalizeElearningGrades(gradesRaw.data), [gradesRaw.data]);
  const courseNameByCode = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of coursesApi.data ?? []) {
      if (c.kode && c.nama) map.set(String(c.kode).trim(), c.nama);
      if (c.kode_mtk && c.nama) map.set(String(c.kode_mtk).trim(), c.nama);
    }
    return map;
  }, [coursesApi.data]);

  const [flexingOpen, setFlexingOpen] = useState(false);
  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<GradeStatusFilter>("all");
  const [sortBy, setSortBy] = useState<GradeSortKey>("pertemuan_desc");
  const [theme, setTheme] = useState<Theme>("night");
  const [format, setFormat] = useState<Format>("post");
  const [hideNim, setHideNim] = useState(true);
  const [busy, setBusy] = useState<"download" | "share" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewWidth, setPreviewWidth] = useState(340);

  // Kartu pratinjau mengikuti lebar panel (maks 440px) supaya tidak terpotong di HP.
  useEffect(() => {
    if (!flexingOpen) return;
    const node = previewRef.current;
    if (!node) return;
    const update = () => setPreviewWidth(Math.max(220, Math.min(440, Math.floor(node.clientWidth - 10))));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [flexingOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("flexing") === "1") setFlexingOpen(true);
  }, []);

  // Kartu flexing hanya memakai data MyBest: KHS, nilai murni, dan KRS SIAKAD
  // dikirim null, jadi buildShowcase memakai blok MyBest.
  const showcaseData = buildShowcase(profileApi.data ?? null, null, null, null, grades);
  const fileName = `mira-flexing-elearning-${format}.png`;
  const allGradeItems = useMemo(
    () => (grades?.per_pertemuan ?? []).flatMap((pert) => pert.items.map((item) => ({ ...item, pertemuan: item.pertemuan || pert.pertemuan }))),
    [grades],
  );

  const courseOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of allGradeItems) {
      const key = courseKey(item.kode, item.mata_kuliah);
      if (!map.has(key)) {
        const label = item.mata_kuliah || (item.kode ? courseNameByCode.get(item.kode) : undefined) || item.kode || "Lainnya";
        map.set(key, label);
      }
    }
    return Array.from(map.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "id", { sensitivity: "base" }));
  }, [allGradeItems, courseNameByCode]);

  const filteredGradeItems = useMemo(
    () => filterAndSortGradeItems(allGradeItems, { course: courseFilter, status: statusFilter, sort: sortBy }),
    [allGradeItems, courseFilter, statusFilter, sortBy],
  );

  const isGroupedView = sortBy === "pertemuan_desc" || sortBy === "pertemuan_asc";
  const groupedGrades = useMemo(
    () => (isGroupedView ? groupGradesByPertemuan(filteredGradeItems, sortBy === "pertemuan_desc" ? "desc" : "asc") : []),
    [filteredGradeItems, isGroupedView, sortBy],
  );
  const hasGradeControls = courseFilter !== "all" || statusFilter !== "all" || sortBy !== "pertemuan_desc";

  const renderCardPng = async () => {
    const node = cardRef.current?.querySelector<HTMLElement>(".flexcard-card");
    if (!node) throw new Error("Kartu belum siap");
    const { width, height } = FORMATS[format];
    return toPng(node, {
      width,
      height,
      pixelRatio: 1,
      cacheBust: true,
      style: { transform: "none" },
    });
  };

  const downloadCard = async () => {
    setBusy("download");
    setMessage(null);
    try {
      const url = await renderCardPng();
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      setMessage("Gambar tersimpan. Siap diunggah ke Story, Feed, atau LinkedIn.");
    } catch {
      setMessage("Gagal membuat gambar. Coba lagi.");
    } finally {
      setBusy(null);
    }
  };

  const shareCard = async () => {
    setBusy("share");
    setMessage(null);
    try {
      const blob = await (await fetch(await renderCardPng())).blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: "Nilai Tugas MyBest di Mira",
          text: `Cek progres kuliahku di https://${SITE}`,
        });
      } else {
        setMessage("Perangkat ini belum mendukung bagikan langsung. Gunakan tombol Unduh.");
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        setMessage("Gagal membagikan gambar. Gunakan tombol Unduh.");
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transkrip Nilai Akademik"
        description="KHS per semester dari SIAKAD, lalu rekap nilai tugas dan kuis dari MyBest."
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-secondary">
          Kartu Flexing memakai nilai tugas MyBest yang sudah dinilai dosen.
        </p>
        <button
          type="button"
          onClick={() => setFlexingOpen(true)}
          aria-haspopup="dialog"
          className="px-btn inline-flex min-h-11 w-full items-center justify-center gap-2.5 whitespace-nowrap px-4 text-sm font-bold sm:w-auto"
        >
          <PixelTrophy className="h-4 w-4 shrink-0 text-[#FCD34D]" aria-hidden="true" />
          <span>Flexing Nilai</span>
        </button>
      </div>

      <SideSheet
        open={flexingOpen}
        onClose={() => setFlexingOpen(false)}
        side="right"
        width="lg"
        titleId="flexing-title"
        eyebrow="Flexing Nilai"
        title="Nilai Tugas MyBest"
        subtitle="Pilih tampilan, lalu unduh atau bagikan."
        footer={
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={downloadCard} disabled={busy !== null} className={`${primaryButtonClass} whitespace-nowrap`}>
                <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                {busy === "download" ? "Membuat..." : "Unduh PNG"}
              </button>
              <button type="button" onClick={shareCard} disabled={busy !== null} className={`${ghostButtonClass} whitespace-nowrap`}>
                <Share2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                {busy === "share" ? "Menyiapkan..." : "Bagikan"}
              </button>
            </div>
            {message && (
              <p className="text-xs font-medium text-[#0369A1]" role="status">
                {message}
              </p>
            )}
          </div>
        }
      >
        <div className="space-y-5">
          <div ref={previewRef} className="w-full pr-2 pb-2">
            <div ref={cardRef} className="mx-auto w-fit">
              <ShowcaseCard
                data={showcaseData}
                theme={theme}
                format={format}
                hideNim={hideNim}
                variant="elearning"
                previewWidth={previewWidth}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-secondary">Tema</p>
              <div className="px-seg px-seg-fill mt-2" role="radiogroup" aria-label="Tema kartu">
                {(
                  [
                    { value: "night", label: "Malam" },
                    { value: "mist", label: "Terang" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={theme === opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={`px-seg-btn ${theme === opt.value ? "px-seg-on" : ""}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="font-mono text-[11px] font-bold uppercase tracking-wider text-secondary">Ukuran</p>
              <div className="px-seg px-seg-fill mt-2" role="radiogroup" aria-label="Ukuran kartu">
                {(Object.keys(FORMATS) as Format[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={format === key}
                    onClick={() => setFormat(key)}
                    className={`px-seg-btn ${format === key ? "px-seg-on" : ""}`}
                  >
                    {key === "post" ? "4:5" : "9:16"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setHideNim((v) => !v)}
            aria-pressed={hideNim}
            className={`${ghostButtonClass} w-full`}
          >
            {hideNim ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            {hideNim ? "NIM disamarkan" : "NIM ditampilkan"}
          </button>

          <p className="text-xs leading-5 text-secondary">
            Gambar 1080px dibuat langsung di perangkatmu. Data nilai tidak dikirim ke mana pun.
          </p>
        </div>
      </SideSheet>

      <KhsSemesterCard />

      <div className="border-t-2 border-dashed border-px-soft pt-6">
        <h2 className="font-display text-base font-bold text-foreground">Rekap Nilai Tugas MyBest</h2>
        <p className="mt-1 text-xs leading-relaxed text-secondary">
          Nilai tugas dan kuis yang dikumpulkan lewat MyBest, dihitung per pertemuan.
        </p>
      </div>

      {gradesRaw.loading ? (
        <LoadingState label="Memuat rekapitulasi nilai tugas MyBest" />
      ) : gradesRaw.error ? (
        siakadGateIssue(gradesRaw.error) ? (
          <SiakadGateNotice kind={siakadGateIssue(gradesRaw.error)!} />
        ) : (
          <ErrorState error={gradesRaw.error} onRetry={gradesRaw.reload} />
        )
      ) : !grades || grades.total_tugas === 0 ? (
        <EmptyState
          mascot="/maskot/mura-nilai.png"
          title="Belum ada riwayat tugas yang dinilai."
          description="Nilai tugas muncul di sini setelah kamu mengumpulkan tugas dan dosen selesai menilai."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Total tugas", value: String(grades.total_tugas) },
              { label: "Sudah dinilai", value: String(grades.sudah_dinilai) },
              { label: "Rata-rata", value: grades.rata_nilai?.toFixed(1) ?? "-" },
              { label: "Nilai tertinggi", value: grades.nilai_max?.toFixed(1) ?? "-" },
            ].map((stat) => (
              <div key={stat.label} className="glass-card p-4">
                <p className="font-mono text-[11px] uppercase tracking-wider text-secondary">{stat.label}</p>
                <p className="mt-1 font-display text-2xl font-bold text-foreground tabular-nums">{stat.value}</p>
              </div>
            ))}
          </div>

          {Object.keys(grades.per_matkul).length > 0 && (
            <div className="glass-card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                  <BookOpen className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
                  Rata-Rata Nilai Tugas Per Mata Kuliah
                </h3>
                <span className="text-[11px] text-secondary">Klik kartu untuk menyaring rincian</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(grades.per_matkul)
                  .sort(([, a], [, b]) => b.rata_nilai - a.rata_nilai)
                  .map(([kode, val]) => {
                    const courseName = val.nama || courseNameByCode.get(kode);
                    const key = courseKey(kode, courseName);
                    const active = courseFilter === key;
                    return (
                      <button
                        key={kode}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setCourseFilter(active ? "all" : key)}
                        className={`flex min-w-0 items-center justify-between gap-3 rounded-[8px] border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-[#0369A1] ${
                          active
                            ? "border-[#0369A1] bg-[#F0F7FB]"
                            : "border-stroke bg-[#F7FAFC] hover:border-[#0369A1]/50 hover:bg-white"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <span className="font-mono text-[11px] font-semibold text-[#0369A1]">
                            {kode}
                          </span>
                          {courseName && (
                            <span className="mt-0.5 block truncate text-xs font-semibold text-foreground">
                              {courseName}
                            </span>
                          )}
                          <span className="block text-[11px] text-secondary">
                            {val.total_tugas} tugas dinilai
                          </span>
                        </div>
                        <span className="shrink-0 rounded-[6px] border-[1px] border-stroke bg-white px-2.5 py-1 font-mono text-lg font-bold text-foreground tabular-nums">
                          {val.rata_nilai.toFixed(1)}
                        </span>
                      </button>
                    );
                  })}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="flex items-center gap-2 font-display text-sm font-bold text-foreground">
                  <FileSpreadsheet className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
                  {isGroupedView ? "Rincian Penilaian Tugas Per Pertemuan" : "Rincian Penilaian Tugas"}
                </h3>
                <span className="font-mono text-xs text-secondary">
                  {filteredGradeItems.length} dari {grades.total_tugas} tugas
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {courseOptions.length > 1 && (
                  <label className="relative flex min-w-0 flex-1 items-center sm:flex-initial">
                    <span className="sr-only">Filter mata kuliah</span>
                    <Filter className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                    <select
                      value={courseFilter}
                      onChange={(e) => setCourseFilter(e.target.value)}
                      aria-label="Filter mata kuliah"
                      className="min-h-10 w-full max-w-full rounded-[8px] border border-stroke bg-white py-1.5 pl-8 pr-3 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-[#0369A1] sm:w-48"
                    >
                      <option value="all">Semua mata kuliah</option>
                      {courseOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="relative flex min-w-0 flex-1 items-center sm:flex-initial">
                  <span className="sr-only">Filter status nilai</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as GradeStatusFilter)}
                    aria-label="Filter status nilai"
                    className="min-h-10 w-full rounded-[8px] border border-stroke bg-white px-3 py-1.5 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-[#0369A1] sm:w-36"
                  >
                    {GRADE_STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="relative flex min-w-0 flex-1 items-center sm:flex-initial">
                  <span className="sr-only">Urutkan nilai tugas</span>
                  <ArrowUpDown className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-secondary" aria-hidden="true" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as GradeSortKey)}
                    aria-label="Urutkan nilai tugas"
                    className="min-h-10 w-full rounded-[8px] border border-stroke bg-white py-1.5 pl-8 pr-3 text-xs font-medium text-foreground focus-visible:outline-2 focus-visible:outline-[#0369A1] sm:w-48"
                  >
                    {GRADE_SORT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>

                {hasGradeControls && (
                  <button
                    type="button"
                    onClick={() => {
                      setCourseFilter("all");
                      setStatusFilter("all");
                      setSortBy("pertemuan_desc");
                    }}
                    className="inline-flex min-h-10 items-center gap-1 rounded-[8px] border border-stroke bg-[#F7FAFC] px-2.5 text-xs font-semibold text-secondary hover:bg-white hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden="true" />
                    Reset
                  </button>
                )}
              </div>
            </div>

            {filteredGradeItems.length === 0 ? (
              <div className="glass-card p-6 text-center">
                <p className="text-sm font-semibold text-foreground">Tidak ada tugas yang cocok dengan filter ini.</p>
                <p className="mt-1 text-xs text-secondary">Ubah filter mata kuliah/status atau tekan Reset.</p>
              </div>
            ) : isGroupedView ? (
              groupedGrades.map((pert) => (
                <div key={pert.pertemuan} className="glass-card overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stroke bg-[#F7FAFC] p-4">
                    <div className="flex items-center gap-2">
                      <span className="inline-block rounded bg-[#0369A1] px-2.5 py-1 font-mono text-xs font-bold text-white">
                        Pertemuan {pert.pertemuan}
                      </span>
                      <span className="text-xs text-secondary">
                        {pert.total_tugas} tugas ({pert.sudah_dinilai} dinilai)
                      </span>
                    </div>
                    {pert.rata_nilai != null && (
                      <span className="rounded-pill border border-[#0F766E]/20 bg-[#F0F7FB] px-2.5 py-0.5 font-mono text-xs font-semibold text-[#0F766E]">
                        Rata-rata: {pert.rata_nilai.toFixed(1)}
                      </span>
                    )}
                  </div>

                  <div className="divide-y divide-stroke/60">
                    {pert.items.map((item) => {
                      const score = gradeValue(item.nilai);
                      return (
                        <div key={`${pert.pertemuan}-${item.id || item.judul}`} className="flex flex-wrap items-center justify-between gap-2 p-3.5">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-foreground">{item.judul}</p>
                            <p className="font-mono text-[11px] text-secondary">
                              {[item.kode, item.mata_kuliah || (item.kode ? courseNameByCode.get(item.kode) : undefined), item.tanggal_kumpul].filter(Boolean).join(" · ") || "-"}
                            </p>
                            {item.komentar_dosen && (
                              <p className="mt-1 text-xs text-secondary">{item.komentar_dosen}</p>
                            )}
                          </div>
                          <span
                            className={`shrink-0 rounded border px-2.5 py-1 font-mono text-sm font-bold ${
                              score === null
                                ? "border-stroke bg-[#F7FAFC] text-secondary"
                                : "border-[#0F766E]/30 bg-[#F0F7FB] text-[#0F766E]"
                            }`}
                          >
                            {score === null ? "Belum dinilai" : score.toFixed(0)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="glass-card overflow-hidden">
                <div className="divide-y divide-stroke/60">
                  {filteredGradeItems.map((item, idx) => {
                    const score = gradeValue(item.nilai);
                    return (
                      <div key={`${item.id || item.judul}-${idx}`} className="flex flex-wrap items-center justify-between gap-2 p-3.5">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {item.pertemuan && (
                              <span className="inline-block shrink-0 rounded bg-[#0369A1] px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                                P{item.pertemuan}
                              </span>
                            )}
                            <p className="truncate text-sm font-semibold text-foreground">{item.judul}</p>
                          </div>
                          <p className="mt-0.5 font-mono text-[11px] text-secondary">
                            {[item.kode, item.mata_kuliah || (item.kode ? courseNameByCode.get(item.kode) : undefined), item.tanggal_kumpul].filter(Boolean).join(" · ") || "-"}
                          </p>
                          {item.komentar_dosen && (
                            <p className="mt-1 text-xs text-secondary">{item.komentar_dosen}</p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded border px-2.5 py-1 font-mono text-sm font-bold ${
                            score === null
                              ? "border-stroke bg-[#F7FAFC] text-secondary"
                              : "border-[#0F766E]/30 bg-[#F0F7FB] text-[#0F766E]"
                          }`}
                        >
                          {score === null ? "Belum dinilai" : score.toFixed(0)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
