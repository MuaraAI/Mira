"use client";

import { useState } from "react";
import {
  BookOpen,
  Download,
  FileText,
  Layers,
  FileCode,
  FileCheck2,
  ExternalLink,
} from "lucide-react";
import { useApi } from "@/lib/api";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/dashboard-ui";

interface CourseItem {
  id: string;
  kode?: string;
  kode_mtk?: string;
  nama: string;
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
  const coursesApi = useApi<CourseItem[]>("/v1/elearning/courses");
  const [selectedIdx, setSelectedIdx] = useState(0);

  const courses = coursesApi.data ?? [];
  const activeCourse = courses.length > 0 ? courses[selectedIdx] : null;
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
          description="Bahan ajar akan muncul otomatis sesuai mata kuliah di semester Anda."
        />
      </div>
    );
  }

  const courseCode = activeCourse?.kode_mtk || activeCourse?.kode || "101";
  const materials = materialsApi.data ?? [];

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bahan Ajar & Modul Kuliah"
        description="Unduh paket berkas resmi kampus (Slide, Modul, Silabus, RPS, RTM) serta berkas materi dari MyBest."
      />

      {/* Course Selector Tabs */}
      <div className="overflow-x-auto pb-2 -mx-2 px-2">
        <div className="flex items-center gap-2 w-max">
          {courses.map((course, idx) => {
            const active = idx === selectedIdx;
            return (
              <button
                key={course.id || idx}
                type="button"
                onClick={() => setSelectedIdx(idx)}
                className={`px-3.5 py-2 rounded-sm text-xs font-semibold whitespace-nowrap transition-all border ${
                  active
                    ? "bg-[#0369A1] text-white border-[#075985] shadow-sm"
                    : "bg-white text-secondary hover:text-foreground border-stroke hover:bg-[#F0F7FB]"
                }`}
              >
                {course.nama}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Course Banner */}
      <div className="glass-card p-5 border-l-4 border-l-[#0369A1] flex items-center justify-between">
        <div>
          <span className="font-mono text-xs font-bold text-[#0369A1] px-2 py-0.5 bg-[#0369A1]/10 rounded-sm">
            Kode: {courseCode}
          </span>
          <h2 className="mt-1 text-lg font-display font-bold text-foreground">
            {activeCourse?.nama}
          </h2>
          <p className="text-xs text-secondary mt-0.5">
            Dosen Pengampu: {activeCourse?.dosen_code || "-"}
          </p>
        </div>
      </div>

      {/* 5 Paket Berkas Standar */}
      <section aria-labelledby="heading-paket-standar">
        <h3 id="heading-paket-standar" className="text-base font-display font-bold text-foreground mb-3">
          Paket Berkas Resmi Kampus (ZIP)
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {standardPackages.map((pkg) => {
            const Icon = pkg.icon;
            return (
              <div
                key={pkg.category}
                className="glass-card p-5 flex flex-col justify-between hover:border-[#0369A1]/40 transition-all hover:bg-[#F0F7FB]/40 group"
              >
                <div>
                  <div className="w-9 h-9 rounded-sm bg-[#0369A1]/10 text-[#0369A1] flex items-center justify-center mb-3 group-hover:bg-[#0369A1] group-hover:text-white transition-colors">
                    <Icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <h4 className="font-bold text-sm text-foreground">
                    {pkg.title}
                  </h4>
                  <p className="text-xs text-secondary mt-1 leading-relaxed">
                    {pkg.desc}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-stroke/60">
                  <a
                    href={pkg.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-[#0369A1] hover:bg-[#075985] text-white text-xs font-bold transition-all w-full justify-center shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Unduh Paket ZIP</span>
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Berkas Materi Elearning MyBest */}
      <section aria-labelledby="heading-berkas-mybest" className="pt-2">
        <h3 id="heading-berkas-mybest" className="text-base font-display font-bold text-foreground mb-3">
          Materi Pertemuan dari Dosen Pengampu (MyBest)
        </h3>

        {materialsApi.loading ? (
          <LoadingState label="Memuat berkas MyBest..." />
        ) : (() => {
          const materiDosen = materials.filter(
            (m) => m.kategori === "materi_dosen" || (!m.kategori && m.kode)
          );

          if (materiDosen.length === 0) {
            return (
              <EmptyState
                title="Belum ada berkas materi tambahan dari dosen."
                description="Dosen pengampu belum mengunggah berkas modul khusus di MyBest untuk mata kuliah ini. Silakan unduh 5 paket berkas resmi kampus di atas."
              />
            );
          }

          return (
            <div className="glass-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm text-left">
                  <thead>
                    <tr className="border-b border-stroke bg-[#F7FAFC] text-xs font-mono uppercase tracking-wider text-secondary">
                      <th scope="col" className="px-4 py-3">Materi</th>
                      <th scope="col" className="px-4 py-3">Deskripsi</th>
                      <th scope="col" className="px-4 py-3">Terakhir Diperbarui</th>
                      <th scope="col" className="px-4 py-3 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materiDosen.map((m) => (
                      <tr
                        key={m.id}
                        className="border-b border-stroke/60 last:border-0 hover:bg-[#F0F7FB]/50"
                      >
                        <td className="px-4 py-3 font-semibold text-foreground">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-[#0369A1] shrink-0" aria-hidden="true" />
                            <span>{m.judul}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-secondary max-w-xs truncate">
                          {m.deskripsi || "-"}
                        </td>
                        <td className="px-4 py-3 text-xs text-secondary whitespace-nowrap">
                          {m.update || "-"}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          {m.file_url ? (
                            <a
                              href={m.file_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill bg-[#0369A1] hover:bg-[#075985] text-xs font-bold text-white transition-all shadow-sm"
                            >
                              <Download className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>Unduh Berkas</span>
                            </a>
                          ) : (
                            <span className="text-xs text-secondary">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </section>
    </div>
  );
}
