"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Download,
  FileText,
  Layers,
  FileCode,
  FileCheck2,
  ExternalLink,
  User,
  Eye,
  PlayCircle,
  Presentation,
} from "lucide-react";
import { apiDownload, ApiError, useApi } from "@/lib/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/dashboard-ui";
import { CourseSelect } from "@/components/CourseSelect";
import { resolveDosen } from "@/lib/courses";
import { DosenInfo } from "@/components/DosenInfo";
import { FilePreviewSheet } from "@/components/FilePreviewSheet";
import { preloadPdfjs } from "@/lib/pdf";
import { safeExternalHref } from "@/lib/links";
import { useDialog } from "@/components/ConfirmDialog";

interface CourseItem {
  id: string;
  kode?: string;
  kode_mtk?: string;
  nama: string;
  kode_dosen?: string;
  dosen_code?: string;
  token_learning?: string | null;
}

interface MaterialItem {
  id: string;
  kode?: string | null;
  kelas?: string | null;
  judul: string;
  deskripsi?: string | null;
  file_url?: string | null;
  file_id?: string | null;
  file_name?: string | null;
  kategori?: string | null;
  update?: string | null;
}

interface VideoItem {
  id: string;
  judul: string;
  url: string;
  thumb?: string | null;
  kategori?: string | null;
}

interface SlideItem {
  id: string;
  judul: string;
  deskripsi?: string | null;
  url: string;
  icon?: string | null;
  kategori?: string | null;
}

type LearningMedia = { video: VideoItem[]; slide: SlideItem[] };
type MateriView = "dosen" | "resmi" | "video" | "slide";

export default function MateriPage() {
  const { notify } = useDialog();
  useEffect(() => preloadPdfjs(), []);
  const coursesApi = useApi<CourseItem[]>("/v1/elearning/courses");
  // Jadwal MyBest dipakai untuk hari kuliah + cadangan kode dosen bila kartu mata kuliah tidak mencantumkannya.
  const scheduleApi = useApi<{ kode: string; nama: string; hari?: string; kode_dosen?: string }[]>("/v1/elearning/schedule");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [view, setView] = useState<MateriView>("dosen");
  const [preview, setPreview] = useState<{ url: string; title: string; subtitle?: string } | null>(null);
  const [downloadingUrl, setDownloadingUrl] = useState<string | null>(null);

  async function handleDownloadMaterial(url: string, title: string) {
    if (url.startsWith("http://") || url.startsWith("https://")) {
      window.open(url, "_blank", "noopener,noreferrer");
      return;
    }
    setDownloadingUrl(url);
    try {
      const filename = `${(title || "materi").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      await apiDownload(url, filename);
    } catch (err) {
      notify(err instanceof ApiError ? err.message : "Gagal mengunduh berkas materi.");
    } finally {
      setDownloadingUrl(null);
    }
  }

  const coursesRaw = useMemo(() => coursesApi.data ?? [], [coursesApi.data]);
  // Prioritaskan mata kuliah hari ini (pola sama dengan Presensi): jadwal SIAKAD
  // dipakai untuk memetakan kode -> hari, lalu urutkan circular day-distance.
  const hariByKode = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of scheduleApi.data ?? []) {
      if (row.kode && row.hari) {
        map.set(String(row.kode), String(row.hari).toLowerCase().trim());
      }
    }
    return map;
  }, [scheduleApi.data]);

  const courses = useMemo(() => {
    const DAY_ORDER = ["senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu"];
    const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1; // Senin = 0
    const distance = (course: CourseItem): number => {
      const hari = hariByKode.get(String(course.kode ?? "")) ?? hariByKode.get(course.nama.toLowerCase().trim());
      if (!hari) return 99;
      const idx = DAY_ORDER.indexOf(hari);
      return idx === -1 ? 99 : (idx - todayIdx + 7) % 7;
    };
    return [...coursesRaw].sort((a, b) => distance(a) - distance(b));
  }, [coursesRaw, hariByKode]);
  const activeCourse = courses.find((c) => (c.id || c.kode || c.nama) === selectedKey) ?? courses[0] ?? null;
  const token = activeCourse?.token_learning;

  const materialsApi = useApi<MaterialItem[]>(
    token ? `/v1/elearning/materials?token=${token}` : "/v1/elearning/materials"
  );
  const mediaApi = useApi<LearningMedia>(
    token ? `/v1/elearning/learning-media?token=${token}` : "/v1/elearning/learning-media"
  );

  if (coursesApi.loading) {
    return <LoadingState label="Memuat daftar mata kuliah" />;
  }
  if (coursesApi.error) {
    return <ErrorState error={coursesApi.error} onRetry={coursesApi.reload} />;
  }

  if (courses.length === 0) {
    return (
      <div>
        <PageHeader title="Bahan Ajar & Modul" />
        <EmptyState
          title="Belum ada mata kuliah aktif."
          description="Bahan ajar muncul di sini sesuai mata kuliahmu."
        />
      </div>
    );
  }

  const courseCode = activeCourse?.kode_mtk || activeCourse?.kode || "101";
  const dosen = resolveDosen(activeCourse, scheduleApi.data);
  const materials = materialsApi.data ?? [];
  const materiDosen = materials.filter((m) => m.kategori === "materi_dosen" || (!m.kategori && m.kode));

  // Paket resmi dari halaman MyBest (URL asli kampus, sudut benar per-kelompok:
  // mis. silabus/rps/rtm memakai kode "101_1530" yang tak bisa dibangun statis).
  const BAHAN_AJAR_ICONS: Record<string, typeof Layers> = {
    slide: Layers,
    modul: FileCode,
    silabus: FileText,
    rps: FileCheck2,
    rtm: BookOpen,
    bahan_ajar: BookOpen,
  };
  const bahanAjarItems = materials.filter((m) => BAHAN_AJAR_ICONS[m.kategori || ""]);

  // 5 Official Campus Standard Categories (fallback statis bila MyBest tak menyediakan tautan)
  const standardPackages = [
    {
      category: "slide",
      title: "Slide Presentasi (P1 - P14)",
      desc: "Kumpulan PDF slide materi tatap muka mingguan dosen.",
      url: `https://students.bsi.ac.id/mhs_download/bahan_ajar/slide/${courseCode}.zip`,
    },
    {
      category: "modul",
      title: "Modul Praktikum & Teori",
      desc: "Panduan praktikum laboratorium, studi kasus, dan teori lengkap.",
      url: `https://students.bsi.ac.id/mhs_download/bahan_ajar/modul/${courseCode}.zip`,
    },
    {
      category: "silabus",
      title: "Silabus Mata Kuliah",
      desc: "Garis besar pokok bahasan mata kuliah selama satu semester.",
      url: `https://students.bsi.ac.id/mhs_download/bahan_ajar/silabus/${courseCode}.zip`,
    },
    {
      category: "rps",
      title: "Rencana Pembelajaran Semester (RPS)",
      desc: "Capaian pembelajaran lulusan (CPL), CPMK, dan buku referensi dosen.",
      url: `https://students.bsi.ac.id/mhs_download/bahan_ajar/rps/${courseCode}.zip`,
    },
    {
      category: "rtm",
      title: "Rencana Tugas Mahasiswa (RTM)",
      desc: "Pedoman tugas, kriteria luaran, dan rubrik penilaian resmi.",
      url: `https://students.bsi.ac.id/mhs_download/bahan_ajar/rtm/${courseCode}.zip`,
    },
  ];

  const resmiPackages = bahanAjarItems.length
    ? bahanAjarItems.map((m) => ({
        key: m.id || m.kategori || m.judul || "paket",
        category: m.kategori || "bahan_ajar",
        title: m.judul || "Bahan Ajar",
        desc: m.deskripsi || "Berkas resmi perkuliahan",
        url: m.file_url || "#",
      }))
    : standardPackages.map((p) => ({
        key: p.category,
        category: p.category,
        title: p.title,
        desc: p.desc,
        url: p.url,
      }));

  const media = mediaApi.data ?? { video: [], slide: [] };
  const tabs = [
    { key: "dosen" as const, label: "Materi Dosen", count: materialsApi.loading ? null : materiDosen.length },
    { key: "video" as const, label: "Video", count: mediaApi.loading ? null : media.video.length },
    { key: "slide" as const, label: "Slide", count: mediaApi.loading ? null : media.slide.length },
    { key: "resmi" as const, label: "Paket Resmi", count: resmiPackages.length },
  ];

  return (
    <div className="min-w-0 space-y-6">
      <PageHeader
        title="Bahan Ajar & Modul Kuliah"
        description="Materi tambahan dosen, video pembelajaran, slide, dan paket resmi kampus (silabus, RPS, modul, RTM)."
      />

      <CourseSelect
        options={courses.map((c) => ({ key: c.id || c.kode || c.nama, label: c.nama }))}
        value={activeCourse ? activeCourse.id || activeCourse.kode || activeCourse.nama : null}
        onChange={setSelectedKey}
      />

      {/* Ringkasan mata kuliah aktif */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-secondary">
        <span className="rounded-[6px] border-[1px] border-stroke bg-[#F0F7FB] px-2 py-0.5 font-mono font-semibold text-[#0369A1]">
          {courseCode}
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5">
          <User className="h-3.5 w-3.5 shrink-0 text-[#0369A1]" aria-hidden="true" />
          <span className="shrink-0">Dosen Pengampu:</span>
          <DosenInfo kode={dosen} />
        </span>
      </div>

      <div
        role="tablist"
        aria-label="Jenis bahan ajar"
        className="grid w-full grid-cols-2 gap-1.5 rounded-[10px] border-[1px] border-stroke bg-[#F0F7FB] p-1.5 sm:inline-flex sm:w-auto sm:flex-wrap"
      >
        {tabs.map((t) => {
          const active = view === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setView(t.key)}
              className={`inline-flex min-h-[38px] items-center justify-center gap-1.5 whitespace-nowrap rounded-[6px] px-3 text-xs font-medium transition-colors duration-200 ${
                active
                  ? "bg-[#072033] text-white"
                  : "text-secondary hover:bg-white hover:text-foreground"
              }`}
            >
              <span>{t.label}</span>
              {t.count !== null && (
                <span
                  className={`rounded-[9999px] px-1.5 py-0.5 font-mono text-[10px] leading-none tabular-nums ${
                    active ? "bg-white/15 text-white" : "bg-white text-secondary"
                  }`}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {view === "video" ? (
        mediaApi.loading ? (
          <LoadingState label="Memuat video pembelajaran..." />
        ) : media.video.length === 0 ? (
          <EmptyState
            title="Belum ada video pembelajaran."
            description="Dosen belum membagikan tautan video untuk mata kuliah ini di MyBest."
          />
        ) : (
          <ul className="page-in grid gap-4 sm:grid-cols-2">
            {media.video.map((video) => (
              <li key={video.id} className="glass-card overflow-hidden">
                <a href={video.url} target="_blank" rel="noopener noreferrer" className="group block">
                  <span className="relative block aspect-video w-full overflow-hidden bg-[#131b26]">
                    {video.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={video.thumb}
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-[#7DD3FC]">
                        <PlayCircle className="h-10 w-10" aria-hidden="true" />
                      </span>
                    )}
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="px-icon flex h-12 w-12 items-center justify-center bg-white/90 text-[#0369A1]">
                        <PlayCircle className="h-6 w-6" aria-hidden="true" />
                      </span>
                    </span>
                  </span>
                  <span className="block p-4">
                    <span className="block text-sm font-bold text-foreground">{video.judul}</span>
                    <span className="mt-1 inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-[#0369A1]">
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      Tonton video
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )
      ) : view === "slide" ? (
        mediaApi.loading ? (
          <LoadingState label="Memuat slide pembelajaran..." />
        ) : media.slide.length === 0 ? (
          <EmptyState
            title="Belum ada slide pembelajaran."
            description="Dokumen slide untuk mata kuliah ini belum tersedia di MyBest."
          />
        ) : (
          <ul className="page-in grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {media.slide.map((item) => (
              <li key={item.id} className="glass-card flex flex-col p-4">
                <span className="px-icon flex h-9 w-9 items-center justify-center">
                  <Presentation className="h-4 w-4" aria-hidden="true" />
                </span>
                <p className="mt-3 text-sm font-bold text-foreground">{item.judul}</p>
                <p className="mt-1 flex-1 text-xs text-secondary">{item.deskripsi || "-"}</p>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-btn mt-4 inline-flex min-h-10 items-center justify-center gap-1.5 px-3 text-xs font-bold"
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Unduh
                </a>
              </li>
            ))}
          </ul>
        )
      ) : view === "resmi" ? (
        <ul className="page-in min-w-0 divide-y-[1px] divide-stroke overflow-hidden rounded-[10px] border-[1px] border-stroke bg-white">
          {resmiPackages.map((pkg) => {
            const Icon = BAHAN_AJAR_ICONS[pkg.category] ?? Layers;
            return (
              <li key={pkg.key} className="min-w-0">
                <a
                  href={pkg.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex min-h-16 min-w-0 items-center gap-3 px-4 py-3 transition-colors hover:bg-[#F0F7FB] sm:px-5"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border-[1px] border-stroke bg-[#F0F7FB] text-[#0369A1]">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-semibold text-foreground">{pkg.title}</span>
                    <span className="block truncate text-xs text-secondary">{pkg.desc}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] font-semibold text-[#0369A1]">
                    <Download className="h-4 w-4 transition-transform group-hover:translate-y-0.5" aria-hidden="true" />
                    <span className="hidden sm:inline">ZIP</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      ) : materialsApi.loading ? (
        <LoadingState label="Memuat berkas MyBest..." />
      ) : materiDosen.length === 0 ? (
        <div className="space-y-3">
          <EmptyState
            mascot="/maskot/mura-buku-tumpuk.png"
            title="Belum ada berkas materi tambahan dari dosen."
            description="Dosen belum mengunggah materi untuk mata kuliah ini di MyBest."
          />
          <button type="button" onClick={() => setView("resmi")} className="px-btn-ghost inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 text-xs font-bold sm:w-auto">
            <Layers className="h-4 w-4" aria-hidden="true" />
            Lihat 5 Paket Resmi Kampus
          </button>
        </div>
      ) : (
        <ul className="page-in min-w-0 divide-y-[1px] divide-stroke overflow-hidden rounded-[10px] border-[1px] border-stroke bg-white">
          {materiDosen.map((m) => {
            const busy = downloadingUrl === m.file_url;
            return (
              <li key={m.id} className="flex min-w-0 items-center gap-3 px-4 py-3.5 sm:px-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border-[1px] border-stroke bg-[#F0F7FB] text-[#0369A1]">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-sm font-semibold leading-snug text-foreground">{m.judul}</span>
                  <span className="block truncate text-xs text-secondary">
                    {[m.update, m.deskripsi].filter(Boolean).join(" · ") || "-"}
                  </span>
                </span>
                {m.file_url ? (
                  m.file_url.startsWith("/v1/") ? (
                    <span className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                      <button
                        type="button"
                        onClick={() => setPreview({ url: m.file_url!, title: m.judul, subtitle: m.kode || undefined })}
                        aria-label={`Lihat dan ringkas ${m.judul}`}
                        className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-[6px] border-[1px] border-[#072033] bg-[#072033] px-2.5 text-xs font-medium text-white transition-colors hover:bg-white hover:text-[#072033] sm:px-3"
                      >
                        <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="hidden sm:inline">Lihat</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadMaterial(m.file_url!, m.judul)}
                        disabled={busy}
                        aria-label={`Unduh ${m.judul}`}
                        className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-[6px] border-[1px] border-stroke bg-white px-2.5 text-xs font-medium text-foreground transition-colors hover:border-[#072033] disabled:opacity-60 sm:px-3"
                      >
                        <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span className="hidden sm:inline">{busy ? "Mengunduh..." : "Unduh"}</span>
                      </button>
                    </span>
                  ) : (
                    <a
                      href={safeExternalHref(m.file_url) || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Buka ${m.judul}`}
                      className="inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-[6px] border-[1px] border-[#072033] bg-[#072033] px-2.5 text-xs font-medium text-white transition-colors hover:bg-white hover:text-[#072033] sm:px-3"
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span className="hidden sm:inline">Buka</span>
                    </a>
                  )
                ) : (
                  <span className="text-xs text-secondary">-</span>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {preview && (
        <FilePreviewSheet
          open
          onClose={() => setPreview(null)}
          path={preview.url}
          eyebrow="Bahan ajar"
          title={preview.title}
          subtitle={preview.subtitle}
        />
      )}
    </div>
  );
}
