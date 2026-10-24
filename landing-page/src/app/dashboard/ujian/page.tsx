"use client";

import { useState } from "react";
import { Award, ExternalLink, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { useApi } from "@/lib/api";
import { safeExternalHref } from "@/lib/links";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/dashboard-ui";

interface ExamData {
  title?: string;
  jadwal_online_url?: string | null;
  soal_offline_url?: string | null;
}

interface ScheduleItem {
  id: string;
  kode: string;
  nama: string;
  sks: number;
}

export default function UjianPage() {
  const [activeTab, setActiveTab] = useState<"uts" | "uas">("uts");
  const utsApi = useApi<ExamData>("/v1/studentv2/uts");
  const uasApi = useApi<ExamData>("/v1/studentv2/uas");
  const scheduleApi = useApi<ScheduleItem[]>("/v1/studentv2/schedule");

  if (utsApi.loading && scheduleApi.loading && uasApi.loading) {
    return <LoadingState label="Memuat informasi kartu ujian" />;
  }
  if (utsApi.error && uasApi.error) return <ErrorState error={utsApi.error} onRetry={utsApi.reload} />;

  const currentExam = activeTab === "uts" ? utsApi.data : uasApi.data;
  const courses = scheduleApi.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col">
        <PageHeader
          title="Kartu Ujian (UTS & UAS)"
          description="Ruang ujian, link jadwal ujian online, dan unduh soal dari SIAKAD."
        />

        {/* Tab Switcher UTS vs UAS */}
        <div className="w-full">
          <div className="px-seg">
          <button
            type="button"
            onClick={() => setActiveTab("uts")}
            className={`px-seg-btn ${
              activeTab === "uts"
                ? "px-seg-on"
                : ""
            }`}
          >
            Ujian Tengah Semester (UTS)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("uas")}
            className={`px-seg-btn ${
              activeTab === "uas"
                ? "px-seg-on"
                : ""
            }`}
          >
            Ujian Akhir Semester (UAS)
          </button>
          </div>
        </div>
      </div>

      {/* Main Info Card */}
      <div className="glass-card p-6 border-l-4 border-l-[#0369A1]">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Award className="w-5 h-5 text-[#0369A1]" aria-hidden="true" />
              <h2 className="text-lg font-display font-bold text-foreground">
                {currentExam?.title || (activeTab === "uts" ? "Ruang Ujian Tengah Semester (UTS)" : "Ruang Ujian Akhir Semester (UAS)")}
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-secondary leading-relaxed">
              Pastikan kamu sudah memenuhi syarat presensi minimal perkuliahan (75%) dan menyelesaikan administrasi akademik sebelum mengikuti ujian.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {safeExternalHref(currentExam?.jadwal_online_url) && (
              <a
                href={safeExternalHref(currentExam?.jadwal_online_url)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill bg-[#0369A1] hover:bg-[#075985] text-white text-xs font-semibold shadow-sm transition-all"
              >
                <span>Jadwal Ujian Online</span>
                <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            )}
            {safeExternalHref(currentExam?.soal_offline_url) && (
              <a
                href={safeExternalHref(currentExam?.soal_offline_url)!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-pill border border-stroke bg-white hover:bg-[#F0F7FB] text-[#0369A1] text-xs font-semibold transition-all"
              >
                <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Unduh Soal Ujian</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Rules Notice */}
      <div className="p-5 rounded-md bg-[#F0F7FB] border border-[#D9E5ED]">
        <h3 className="text-xs font-mono font-bold uppercase text-[#0369A1] tracking-wider mb-2 flex items-center gap-1.5">
          <AlertCircle className="w-4 h-4 text-[#0369A1]" />
          Tata Tertib Pelaksanaan Ujian Kampus UBSI
        </h3>
        <ul className="text-xs text-secondary space-y-1.5 list-disc list-inside leading-relaxed">
          <li>Wajib membawa Kartu Tanda Mahasiswa (KTM) atau Kartu Ujian fisik/digital saat ujian offline di kampus.</li>
          <li>Ujian daring MyBest wajib dikerjakan sesuai rentang jadwal dan waktu server yang ditetapkan panitia ujian.</li>
          <li>Keterlambatan pada ujian online tidak mendapatkan kompensasi perpanjangan waktu pengerjaan.</li>
        </ul>
      </div>

      {/* Course List Subject to Exams */}
      <div className="glass-card overflow-hidden">
        <div className="p-4 border-b border-stroke flex items-center justify-between flex-wrap gap-x-4 gap-y-1">
          <h3 className="font-display font-bold text-sm text-foreground">
            Mata Kuliah Yang Diujikan pada Semester Ini
          </h3>
          <span className="text-xs text-secondary font-mono">
            {courses.length} Mata Kuliah
          </span>
        </div>

        {courses.length === 0 ? (
          <div className="p-8 text-center text-secondary text-sm">
            Belum ada jadwal mata kuliah yang terdeteksi untuk ujian.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="px-table w-full md:min-w-[600px] text-sm text-left">
              <thead>
                <tr className="border-b border-stroke bg-[#F7FAFC] text-xs font-mono uppercase tracking-wider text-secondary">
                  <th scope="col" className="px-4 py-3">Kode</th>
                  <th scope="col" className="px-4 py-3">Mata Kuliah</th>
                  <th scope="col" className="px-4 py-3 text-center">Beban SKS</th>
                  <th scope="col" className="px-4 py-3 text-center">Bentuk Evaluasi</th>
                </tr>
              </thead>
              <tbody>
                {courses.map((c) => (
                  <tr
                    key={c.id || c.kode}
                    className="border-b border-stroke/60 last:border-0 hover:bg-[#F0F7FB]/50"
                  >
                    <td data-label="Kode" className="px-4 py-3 font-mono font-bold text-[#0369A1] text-xs">
                      {c.kode}
                    </td>
                    <td data-label="Mata Kuliah" data-primary="" className="px-4 py-3 font-semibold text-foreground">
                      {c.nama}
                    </td>
                    <td data-label="Beban SKS" className="px-4 py-3 text-center text-secondary font-mono">
                      {c.sks} SKS
                    </td>
                    <td data-label="Bentuk Evaluasi" className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-[#F0F7FB] text-secondary border border-stroke text-xs font-medium">
                        <CheckCircle2 className="w-3 h-3 text-[#0F766E]" />
                        Teori & Evaluasi
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
