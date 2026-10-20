"use client";

import { useEffect, useMemo, useState } from "react";
import {
  UserCheck,
  Calendar,
  Clock,
  MapPin,
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { apiFetch, useApi, clearApiCache } from "@/lib/api";
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
  hari?: string;
  jam?: string;
  ruang?: string;
  dosen_code?: string;
  token_absen?: string | null;
}

interface PresenceRecord {
  id: string;
  status_absen: string;
  tanggal: string;
  matakuliah?: string;
  pertemuan: string;
  rangkuman?: string | null;
  berita_acara?: string | null;
  dosen?: string | null;
  ruang?: string | null;
}

interface PresenceData {
  kode_mtk?: string;
  matakuliah?: string;
  kelas?: string;
  dosen?: string;
  ruang?: string;
  hari?: string;
  jam_masuk?: string;
  jam_keluar?: string;
  status_sesi?: string | null;
  can_submit?: boolean;
  total_kehadiran?: number;
  riwayat?: PresenceRecord[];
}

const DAY_ORDER = ["minggu", "senin", "selasa", "rabu", "kamis", "jumat", "sabtu"];

export default function PresensiPage() {
  const coursesApi = useApi<CourseItem[]>("/v1/elearning/courses");
  const [selectedCourseKey, setSelectedCourseKey] = useState<string | null>(null);

  const rawCourses = coursesApi.data ?? [];
  const todayDayIndex = new Date().getDay();
  const todayName = new Intl.DateTimeFormat("id-ID", { weekday: "long" }).format(new Date());

  // Urutkan mata kuliah:
  // 1. Hari ini (distance 0) paling depan di posisi pertama
  // 2. Jika hari ini tidak ada jadwal (libur), prioritaskan hari berikutnya (besok, lusa, dst)
  const courses = useMemo(() => {
    function getDistance(courseDay?: string): number {
      if (!courseDay) return 99;
      const clean = courseDay.toLowerCase().trim();
      const idx = DAY_ORDER.indexOf(clean);
      if (idx === -1) return 99;
      return (idx - todayDayIndex + 7) % 7;
    }

    return [...rawCourses].sort((a, b) => {
      const distA = getDistance(a.hari);
      const distB = getDistance(b.hari);
      if (distA !== distB) return distA - distB;
      return (a.jam || "").localeCompare(b.jam || "");
    });
  }, [rawCourses, todayDayIndex]);

  // Dari tombol "Absen" di Jadwal: /dashboard/presensi?kode=...&mk=... langsung memilih mata kuliahnya.
  const [requested, setRequested] = useState<{ kode: string; mk: string } | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const kode = params.get("kode")?.trim() ?? "";
    const mk = params.get("mk")?.trim() ?? "";
    if (kode || mk) setRequested({ kode, mk });
  }, []);
  useEffect(() => {
    if (!requested || courses.length === 0) return;
    const norm = (v?: string) => (v ?? "").trim().toLowerCase();
    const match =
      courses.find((c) => requested.kode && (norm(c.kode) === norm(requested.kode) || norm(c.kode_mtk) === norm(requested.kode))) ||
      courses.find((c) => requested.mk && norm(c.nama) === norm(requested.mk)) ||
      courses.find((c) => requested.mk && (norm(c.nama).includes(norm(requested.mk)) || norm(requested.mk).includes(norm(c.nama))));
    if (match) setSelectedCourseKey(match.id || match.kode || match.nama);
    setRequested(null);
  }, [requested, courses]);

  const activeCourse = useMemo(() => {
    if (selectedCourseKey) {
      return (
        courses.find((c) => (c.id || c.kode || c.nama) === selectedCourseKey) ||
        courses[0] ||
        null
      );
    }
    return courses[0] || null;
  }, [courses, selectedCourseKey]);

  const token = activeCourse?.token_absen;
  const presenceApi = useApi<PresenceData>(
    token ? `/v1/elearning/presence?token=${token}` : "/v1/elearning/presence"
  );
  const pData = presenceApi.data;

  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmitPresence() {
    if (!token || !window.confirm(`Kirim presensi untuk ${activeCourse?.nama ?? "mata kuliah ini"} sekarang?`)) return;
    setSubmitting(true);
    setSubmitMessage(null);
    setSubmitError(null);
    try {
      const result = await apiFetch<{ success: boolean; message?: string }>(
        `/v1/elearning/presence?token=${token}`,
        { method: "POST" }
      );
      if (!result.success) throw new Error(result.message || "Presensi tidak berhasil dikirim.");
      clearApiCache("/v1/elearning/presence");
      setSubmitMessage(result.message || "Presensi berhasil dikirim.");
      presenceApi.reload();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Presensi gagal dikirim.");
    } finally {
      setSubmitting(false);
    }
  }

  if (coursesApi.loading) {
    return <LoadingState label="Memuat daftar mata kuliah presensi" />;
  }
  if (coursesApi.error) {
    return <ErrorState error={coursesApi.error} onRetry={coursesApi.reload} />;
  }

  if (courses.length === 0) {
    return (
      <div>
        <PageHeader title="Presensi Perkuliahan" />
        <EmptyState
          title="Belum ada mata kuliah aktif di MyBest."
          description="Pastikan akun MyBest Anda telah terhubung dengan jadwal KRS semester ini."
        />
      </div>
    );
  }

  const records = pData?.riwayat ?? [];
  const isActiveSession =
    Boolean(pData?.can_submit) ||
    Boolean(pData?.status_sesi?.toLowerCase().includes("absen masuk"));
  const hadirCount = records.filter(
    (r) => r.status_absen.toLowerCase() === "hadir"
  ).length;
  const totalPertemuan = records.length;
  const persentase =
    totalPertemuan > 0 ? Math.round((hadirCount / totalPertemuan) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Presensi Perkuliahan"
        description="Pantau riwayat kehadiran, status sesi pertemuan, dan berita acara perkuliahan MyBest."
      />

      {/* Course Selector Tabs */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-xs text-secondary px-1">
          <span>
            Hari ini: <strong className="text-foreground">{todayName}</strong>. Diurutkan berdasarkan jadwal terdekat:
          </span>
          {activeCourse?.hari && (
            <span className="font-mono text-[#0369A1] font-semibold">
              Jadwal: {activeCourse.hari} ({activeCourse.jam || "-"})
            </span>
          )}
        </div>

        <div className="overflow-x-auto pb-2 -mx-2 px-2">
          <div className="flex items-center gap-2 w-max">
            {courses.map((course) => {
              const courseKey = course.id || course.kode || course.nama;
              const active = courseKey === (activeCourse?.id || activeCourse?.kode || activeCourse?.nama);
              const isToday = course.hari?.toLowerCase().trim() === todayName.toLowerCase();
              return (
                <button
                  key={courseKey}
                  type="button"
                  onClick={() => setSelectedCourseKey(courseKey)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-sm text-xs font-semibold whitespace-nowrap transition-all border ${
                    active
                      ? "bg-[#0369A1] text-white border-[#075985] shadow-sm"
                      : "bg-white text-secondary hover:text-foreground border-stroke hover:bg-[#F0F7FB]"
                  }`}
                >
                  <span>{course.nama}</span>
                  {course.hari && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full ${
                        active
                          ? "bg-white/20 text-white"
                          : isToday
                          ? "bg-[#0F766E]/15 text-[#0F766E] font-bold"
                          : "bg-slate-100 text-secondary"
                      }`}
                    >
                      {isToday ? "Hari Ini" : course.hari}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {presenceApi.loading ? (
        <LoadingState label="Memuat rekap presensi..." />
      ) : presenceApi.error ? (
        <ErrorState error={presenceApi.error} onRetry={presenceApi.reload} />
      ) : (
        <div className="space-y-6">
          {/* Header Info & Kehadiran Card */}
          <div className="glass-card p-6 border-l-4 border-l-[#0369A1]">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div className="space-y-2">
                <span className="font-mono text-xs font-bold text-[#0369A1] px-2 py-0.5 bg-[#0369A1]/10 rounded-sm">
                  {pData?.kode_mtk || activeCourse?.kode_mtk || activeCourse?.kode || "MTK"}
                </span>
                <h2 className="text-xl font-display font-bold text-foreground">
                  {pData?.matakuliah || activeCourse?.nama}
                </h2>

                <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-secondary pt-1">
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#0369A1]" aria-hidden="true" />
                    Dosen: {pData?.dosen || activeCourse?.dosen_code || "-"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-[#0369A1]" aria-hidden="true" />
                    Ruang: {pData?.ruang || activeCourse?.ruang || "-"} (Kelas {pData?.kelas || "-"})
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#0369A1]" aria-hidden="true" />
                    {pData?.hari || activeCourse?.hari || "-"}{" "}
                    {pData?.jam_masuk && pData?.jam_keluar
                      ? `(${pData.jam_masuk} - ${pData.jam_keluar})`
                      : activeCourse?.jam
                      ? `(${activeCourse.jam})`
                      : ""}
                  </span>
                </div>
              </div>

              {/* Status Sesi & Stat Box */}
              <div className="flex sm:items-center gap-4 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-stroke">
                <div className="p-3 bg-[#F0F7FB] border border-stroke rounded-md text-center min-w-[110px]">
                  <span className="text-[10px] font-mono uppercase text-secondary font-bold block">
                    Kehadiran
                  </span>
                  <span className="text-2xl font-display font-bold text-[#0369A1]">
                    {persentase}%
                  </span>
                  <span className="text-[11px] text-secondary block mt-0.5">
                    {hadirCount} / {totalPertemuan} Hadir
                  </span>
                </div>

                <div className="flex flex-col justify-center">
                  <span className="text-[10px] font-mono uppercase text-secondary font-bold mb-1">
                    Status Sesi Hari Ini:
                  </span>
                  <span
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-pill text-xs font-bold ${
                      isActiveSession
                        ? "bg-[#0F766E]/10 border border-[#0F766E]/30 text-[#0F766E]"
                        : "bg-[#F0F7FB] border border-stroke text-secondary"
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current" aria-hidden="true" />
                    {pData?.status_sesi || "Sesi Ditutup"}
                  </span>
                  <button
                    type="button"
                    onClick={handleSubmitPresence}
                    disabled={!isActiveSession || submitting || !token}
                    className="mt-3 inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-pill bg-[#0369A1] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#075985] disabled:cursor-not-allowed disabled:opacity-40 shadow-sm"
                  >
                    <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>{submitting ? "Mengirim presensi..." : "Absen Sekarang"}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {(submitMessage || submitError) && (
            <div
              className={`rounded-sm border px-4 py-3 text-sm ${
                submitError
                  ? "border-[#BE123C]/30 bg-[#F0F7FB] text-[#BE123C]"
                  : "border-[#0F766E]/30 bg-[#F0F7FB] text-[#0F766E]"
              }`}
              role="status"
            >
              {submitError || submitMessage}
            </div>
          )}

          {/* Riwayat Pertemuan Table */}
          <div className="glass-card overflow-hidden">
            <div className="p-4 border-b border-stroke flex items-center justify-between flex-wrap gap-x-4 gap-y-1">
              <h3 className="font-display font-bold text-sm text-foreground">
                Riwayat Pertemuan & Presensi
              </h3>
              <span className="text-xs text-secondary font-mono">
                Total {records.length} Pertemuan Tercatat
              </span>
            </div>

            {records.length === 0 ? (
              <div className="p-8 text-center text-secondary text-sm">
                Belum ada catatan riwayat presensi yang tersedia untuk mata kuliah ini.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="px-table w-full md:min-w-[640px] text-sm text-left">
                  <thead>
                    <tr className="border-b border-stroke bg-[#F7FAFC] text-xs font-mono uppercase tracking-wider text-secondary">
                      <th scope="col" className="px-4 py-3">Pertemuan</th>
                      <th scope="col" className="px-4 py-3">Tanggal</th>
                      <th scope="col" className="px-4 py-3">Status</th>
                      <th scope="col" className="px-4 py-3">Rangkuman / Materi Dosen</th>
                      <th scope="col" className="px-4 py-3">Berita Acara</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((r) => {
                      const isHadir = r.status_absen.toLowerCase() === "hadir";
                      return (
                        <tr
                          key={r.id}
                          className="border-b border-stroke/60 last:border-0 hover:bg-[#F0F7FB]/50"
                        >
                          <td data-label="Pertemuan" className="px-4 py-3 font-mono font-bold text-[#0369A1]">
                            P-{r.pertemuan}
                          </td>
                          <td data-label="Tanggal" className="px-4 py-3 text-secondary whitespace-nowrap">
                            {r.tanggal}
                          </td>
                          <td data-label="Status" className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill text-xs font-bold ${
                                isHadir
                                  ? "bg-[#0F766E]/10 text-[#0F766E] border border-[#0F766E]/25"
                                  : "bg-[#BE123C]/10 text-[#BE123C] border border-[#BE123C]/25"
                              }`}
                            >
                              {isHadir ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              {r.status_absen}
                            </span>
                          </td>
                          <td data-label="Rangkuman / Materi Dosen" data-stack="" className="px-4 py-3 text-foreground font-medium max-w-xs truncate">
                            {r.rangkuman || "-"}
                          </td>
                          <td data-label="Berita Acara" data-stack="" className="px-4 py-3 text-secondary text-xs max-w-xs truncate">
                            {r.berita_acara || "-"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
