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

export default function MateriPage() {
  const { notify } = useDialog();
  useEffect(() => preloadPdfjs(), []);
  const coursesApi = useApi<CourseItem[]>("/v1/elearning/courses");
  // Jadwal SIAKAD dipakai untuk hari kuliah + cadangan kode dosen bila kartu MyBest tidak mencantumkannya.
  const scheduleApi = useApi<{ kode: string; nama: string; hari?: string; kode_dosen?: string }[]>("/v1/studentv2/schedule");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [view, setView] = useState<"dosen" | "resmi">("dosen");
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

  // 5 Official Campus Standard Categories
  const standardPackages = [
    {
      category: "slide",
      title: "Slide Presentasi (P1 - P14)",
      desc: "Kumpulan PDF slide materi tatap muka mingguan dosen.",
      icon: Layers,
      url: `https://students.bsi.ac.id/mhs_download/bahan_ajar/slide/${courseCode}.zip`,
    },
    {
      category: "modul",
      title: "Modul Praktikum & Teori",
      desc: "Panduan praktikum laboratorium, studi kasus, dan teori lengkap.",
      icon: FileCode,
      url: `https://students.bsi.ac.id/mhs_download/bahan_ajar/modul/${courseCode}.zip`,
    },
    {
      category: "silabus",
      title: "Silabus Mata Kuliah",
      desc: "Garis besar pokok bahasan mata kuliah selama satu semester.",
      icon: FileText,
      url: `https://students.bsi.ac.id/mhs_download/bahan_ajar/silabus/${courseCode}.zip`,
    },
    {
      category: "rps",
      title: "Rencana Pembelajaran Semester (RPS)",
      desc: "Capaian pembelajaran lulusan (CPL), CPMK, dan buku referensi dosen.",
      icon: FileCheck2,
      url: `https://students.bsi.ac.id/mhs_download/bahan_ajar/rps/${courseCode}.zip`,
    },
    {
      category: "rtm",
      title: "Rencana Tugas Mahasiswa (RTM)",
      desc: "Pedoman tugas, kriteria luaran, dan rubrik penilaian resmi.",
      icon: BookOpen,
      url: `https://students.bsi.ac.id/mhs_download/bahan_ajar/rtm/${courseCode}.zip`,
    },
  ];

  const tabs = [
    { key: "dosen" as const, label: `Materi Dosen${materialsApi.loading ? "" : ` (${materiDosen.length})`}` },
    { key: "resmi" as const, label: `Paket Resmi (${standardPackages.length})` },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bahan Ajar & Modul Kuliah"
        description="Materi dari dosen dan paket resmi kampus (slide, modul, silabus, RPS, RTM)."
      />

      <CourseSelect
        options={courses.map((c) => ({ key: c.id || c.kode || c.nama, label: c.nama }))}
        value={activeCourse ? activeCourse.id || activeCourse.kode || activeCourse.nama : null}
        onChange={setSelectedKey}
      />

      {/* Ringkasan mata kuliah aktif */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-secondary">
        <span className="px-chip bg-px-tint px-2 py-0.5 font-mono font-bold text-[#0369A1]">{courseCode}</span>
        <span className="inline-flex items-center gap-1.5">
          <User className="h-3.5 w-3.5 text-[#0369A1]" aria-hidden="true" />
          <span className="shrink-0">Dosen Pengampu:</span>
          <DosenInfo kode={dosen} />
        </span>
      </div>

      <div role="tablist" aria-label="Jenis bahan ajar" className="grid grid-cols-2 gap-1 bg-px-tint p-1 shadow-[0_-2px_0_0_#CFE2EE,0_2px_0_0_#CFE2EE,-2px_0_0_0_#CFE2EE,2px_0_0_0_#CFE2EE] sm:w-96">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={view === t.key}
            onClick={() => setView(t.key)}
            className={`min-h-10 px-2 font-mono text-xs font-bold transition-colors duration-200 ${
              view === t.key ? "bg-[#0369A1] text-white shadow-[2px_2px_0_0_#072033]" : "text-secondary hover:bg-white hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {view === "resmi" ? (
        <ul className="page-in glass-card divide-y-2 divide-dashed divide-px-soft">
          {standardPackages.map((pkg) => {
            const Icon = pkg.icon;
            return (
              <li key={pkg.category}>
                <a
                  href={pkg.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-[#F0F7FB] sm:px-5"
                >
                  <span className="px-icon h-9 w-9 shrink-0">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-foreground">{pkg.title}</span>
                    <span className="block truncate text-xs text-secondary">{pkg.desc}</span>
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-[11px] font-bold text-[#0369A1]">
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
        <ul className="page-in glass-card divide-y-2 divide-dashed divide-px-soft">
          {materiDosen.map((m) => {
            const busy = downloadingUrl === m.file_url;
            return (
              <li key={m.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <span className="px-icon h-9 w-9 shrink-0">
                  <FileText className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold leading-snug text-foreground">{m.judul}</span>
                  <span className="block truncate text-xs text-secondary">
                    {[m.update, m.deskripsi].filter(Boolean).join(" · ") || "-"}
                  </span>
                </span>
                {m.file_url ? (
                  m.file_url.startsWith("/v1/") ? (
                    <span className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPreview({ url: m.file_url!, title: m.judul, subtitle: m.kode || undefined })}
                        aria-label={`Lihat dan ringkas ${m.judul}`}
                        className="px-btn inline-flex min-h-10 items-center gap-1.5 px-3 text-xs font-bold"
                      >
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">Lihat</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadMaterial(m.file_url!, m.judul)}
                        disabled={busy}
                        aria-label={`Unduh ${m.judul}`}
                        className="px-btn-ghost inline-flex min-h-10 min-w-10 items-center justify-center gap-1.5 px-3 text-xs font-bold"
                      >
                        <Download className="h-4 w-4" aria-hidden="true" />
                        <span className="hidden sm:inline">{busy ? "Mengunduh..." : "Unduh"}</span>
                      </button>
                    </span>
                  ) : (
                    <a
                      href={m.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Buka ${m.judul}`}
                      className="px-btn inline-flex min-h-10 shrink-0 items-center gap-1.5 px-3 text-xs font-bold"
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
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
