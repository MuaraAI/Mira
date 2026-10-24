"use client";

import Link from "next/link";
import {
  CalendarDays,
  GraduationCap,
  CheckSquare,
  UserCheck,
  Clock,
  ArrowRight,
  BookOpen,
  Award,
  Library,
  MapPin,
  School,
  AlertTriangle,
  HelpCircle,
  UserRound,
} from "lucide-react";
import { useApi } from "@/lib/api";
import { findSubmission, formatShortDate, parseDeadline } from "@/lib/assignments";
import { DosenInfo } from "@/components/DosenInfo";
import { PixelTrophy } from "@/components/PixelIcons";
import { splitProgram } from "@/lib/profile";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Skeleton,
} from "@/components/dashboard-ui";

interface StudentProfile {
  nim?: string;
  nama?: string;
  program_studi?: string;
  lokasi_cabang?: string;
  kelas?: string;
  semester_aktif?: string;
  status_aktif?: string;
  dosen_pa?: string;
}

interface ScheduleItem {
  id: string;
  kode: string;
  nama: string;
  hari: string;
  jam: string;
  sks: number;
  ruang: string;
  kode_dosen: string;
  kelompok_praktek?: string | null;
}

interface KhsData {
  items: unknown[];
  total_mutu: number;
  total_sks: number;
  ipk: number;
}

interface AssignmentTask {
  id: string;
  kode?: string;
  mata_kuliah?: string;
  kelas?: string;
  judul: string;
  deskripsi?: string;
  pertemuan?: string;
  mulai?: string;
  selesai?: string;
  file_soal_url?: string | null;
}

interface AssignmentsData {
  tasks?: AssignmentTask[];
  submissions?: { id?: string; judul: string; kode?: string; mata_kuliah?: string }[];
}

interface PresenceData {
  status_sesi?: string | null;
  matakuliah?: string;
  ruang?: string;
}

const DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

export default function DashboardOverviewPage() {
  const me = useApi<{ nim: string; auth_type?: string }>("/v1/auth/me");
  const profile = useApi<StudentProfile>("/v1/studentv2/profile");
  const schedule = useApi<ScheduleItem[]>("/v1/studentv2/schedule");
  const khs = useApi<KhsData>("/v1/studentv2/khs");
  const assignments = useApi<AssignmentsData>("/v1/elearning/assignments");
  const presence = useApi<PresenceData>("/v1/elearning/presence");

  if (me.loading && !me.data) {
    return <LoadingState label="Menyiapkan dashboard" />;
  }
  if (me.error) return <ErrorState error={me.error} onRetry={me.reload} />;

  // Selama request belum selesai tampilkan skeleton, bukan fallback, supaya teks tidak berganti di tengah jalan.
  const isPending = (q: { loading: boolean; data: unknown }) => q.loading && !q.data;
  const profilePending = isPending(profile);
  const schedulePending = isPending(schedule);
  const khsPending = isPending(khs);
  const assignmentsPending = isPending(assignments);
  const presencePending = isPending(presence);

  const nim = me.data?.nim ?? profile.data?.nim ?? "-";
  const studentName = profile.data?.nama || `Mahasiswa (${nim})`;
  const { prodi: prodiName, kampus: kampusName } = splitProgram(profile.data);
  const prodi = prodiName || "Data belum tersedia";
  const kampus = kampusName;
  const semester = profile.data?.semester_aktif || "Data belum tersedia";
  const kelas = profile.data?.kelas || "Data belum tersedia";

  const todayIndex = new Date().getDay();
  const today = DAY_NAMES[todayIndex];
  const allSchedules = schedule.data ?? [];
  const todayClasses = allSchedules.filter(
    (s) => s.hari?.toLowerCase() === today.toLowerCase()
  );

  const ipkValue = khs.data?.ipk != null ? khs.data.ipk.toFixed(2) : "Data belum tersedia";
  const totalSks = khs.data?.total_sks != null ? String(khs.data.total_sks) : "Data belum tersedia";

  const tasksList = assignments.data?.tasks ?? [];
  const submissionsList = assignments.data?.submissions ?? [];
  const pendingTasks = tasksList.filter((t) => !findSubmission(t, submissionsList));

  // Pengingat: tugas belum dikumpul dengan batas waktu terdekat yang belum lewat.
  const nowMs = Date.now();
  const nextTask =
    pendingTasks
      .map((t) => ({ t, at: parseDeadline(t.selesai)?.getTime() ?? Infinity }))
      .filter(({ at }) => at >= nowMs)
      .sort((a, b) => a.at - b.at)[0]?.t ?? null;

  return (
    <div className="space-y-8">
      {/* 1. Header Profil Mahasiswa */}
      <div className="glass-card p-6 sm:p-8 relative overflow-hidden bg-gradient-to-br from-white via-white to-[#F0F7FB] border border-stroke">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-pill bg-[#0369A1]/10 border border-[#0369A1]/25 text-[11px] font-mono font-bold text-[#0369A1]">
                NIM {nim}
              </span>
              {profilePending ? (
                <>
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-14" />
                </>
              ) : (
                <>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill bg-[#F0F7FB] border border-stroke text-[11px] font-semibold text-secondary">
                    Semester {semester}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-pill bg-[#0F766E]/10 border border-[#0F766E]/30 text-[11px] font-semibold text-[#0F766E]">
                    {profile.data?.status_aktif || "Aktif"}
                  </span>
                </>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-display font-bold tracking-tight text-foreground break-words">
              Selamat Datang,{" "}
              {profilePending ? (
                <>
                  <Skeleton className="h-7 w-48 max-w-full sm:h-8 sm:w-64" />
                  <span className="sr-only">memuat nama mahasiswa</span>
                </>
              ) : (
                studentName
              )}
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-secondary">
              {profilePending ? (
                <>
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-4 w-20" />
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1">
                    <School className="w-3.5 h-3.5 shrink-0 text-[#0369A1]" aria-hidden="true" />
                    {prodi}
                    {profile.data?.kelas ? ` · Kelas ${kelas}` : ""}
                  </span>
                  {kampus && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 shrink-0 text-[#0369A1]" aria-hidden="true" />
                      {kampus}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* HP: tombol utama selebar kartu, dua tombol lain berdampingan; teks selalu satu baris. */}
          <div className="grid shrink-0 grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:flex sm:items-center">
            <Link
              href="/dashboard/jadwal"
              className="min-[360px]:col-span-2 inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 rounded-pill text-xs font-semibold transition-all sm:px-4 sm:text-sm bg-[#0369A1] text-white shadow-sm hover:bg-[#075985]"
            >
              <CalendarDays className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Jadwal Lengkap</span>
            </Link>
            <Link href="/dashboard/sesi" className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 rounded-pill text-xs font-semibold transition-all sm:px-4 sm:text-sm border border-stroke bg-white text-secondary hover:bg-[#F0F7FB] hover:text-foreground">
              <UserRound className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Profil Saya</span>
            </Link>
            <Link href="/dashboard/nilai?flexing=1" className="inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap px-3 py-2 rounded-pill text-xs font-semibold transition-all sm:px-4 sm:text-sm border border-stroke bg-white text-secondary hover:bg-[#F0F7FB] hover:text-foreground">
              <PixelTrophy className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Flexing Nilai</span>
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Top 4 Quick-Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: IPK & SKS */}
        <Link
          href="/dashboard/nilai"
          className="glass-card min-w-0 p-4 sm:p-5 group hover:border-[#0369A1]/40 transition-all hover:translate-y-[-2px]"
        >
          <div className="flex items-center justify-between">
            <span className="min-w-0 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-secondary">
              Prestasi Akademik
            </span>
            <div className="hidden sm:flex w-8 h-8 shrink-0 rounded-sm bg-[#0369A1]/10 flex items-center justify-center text-[#0369A1] group-hover:bg-[#0369A1] group-hover:text-white transition-colors">
              <GraduationCap className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            {khsPending ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <span className="text-2xl font-display font-bold text-foreground">
                  {ipkValue}
                </span>
                <span className="ml-1 text-xs text-secondary font-mono">/ 4.00</span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-secondary flex items-center justify-between">
            {khsPending ? <Skeleton className="h-3.5 w-20" /> : <span>{totalSks} SKS Lulus</span>}
            <span className="text-[#0369A1] font-semibold group-hover:translate-x-0.5 transition-transform hidden sm:flex items-center gap-0.5">
              KHS <ArrowRight className="w-3 h-3" />
            </span>
          </p>
        </Link>

        {/* Metric 2: Kelas Hari Ini */}
        <Link
          href="/dashboard/jadwal"
          className="glass-card min-w-0 p-4 sm:p-5 group hover:border-[#0369A1]/40 transition-all hover:translate-y-[-2px]"
        >
          <div className="flex items-center justify-between">
            <span className="min-w-0 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-secondary">
              Kelas Hari {today}
            </span>
            <div className="hidden sm:flex w-8 h-8 shrink-0 rounded-sm bg-[#0369A1]/10 flex items-center justify-center text-[#0369A1] group-hover:bg-[#0369A1] group-hover:text-white transition-colors">
              <CalendarDays className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            {schedulePending ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <span className="text-2xl font-display font-bold text-foreground">
                  {todayClasses.length}
                </span>
                <span className="ml-1 text-xs text-secondary">Kelas</span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-secondary flex items-center justify-between">
            {schedulePending ? (
              <Skeleton className="h-3.5 w-24" />
            ) : (
              <span>{todayClasses.length > 0 ? "Ada perkuliahan" : "Hari bebas kuliah"}</span>
            )}
            <span className="text-[#0369A1] font-semibold group-hover:translate-x-0.5 transition-transform hidden sm:flex items-center gap-0.5">
              Jadwal <ArrowRight className="w-3 h-3" />
            </span>
          </p>
        </Link>

        {/* Metric 3: Tugas Pending */}
        <Link
          href="/dashboard/tugas"
          className="glass-card min-w-0 p-4 sm:p-5 group hover:border-[#0369A1]/40 transition-all hover:translate-y-[-2px]"
        >
          <div className="flex items-center justify-between">
            <span className="min-w-0 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-secondary">
              Tugas Belum Selesai
            </span>
            <div className="hidden sm:flex w-8 h-8 shrink-0 rounded-sm bg-[#9A3412]/10 flex items-center justify-center text-[#9A3412] group-hover:bg-[#9A3412] group-hover:text-white transition-colors">
              <CheckSquare className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            {assignmentsPending ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <span className="text-2xl font-display font-bold text-foreground">
                  {pendingTasks.length}
                </span>
                <span className="ml-1 text-xs text-secondary">Tugas</span>
              </>
            )}
          </div>
          <p className="mt-1 text-xs text-secondary flex items-center justify-between">
            {assignmentsPending ? (
              <Skeleton className="h-3.5 w-24" />
            ) : (
              <span>{pendingTasks.length > 0 ? "Perlu dikumpulkan" : "Semua tugas beres"}</span>
            )}
            <span className="text-[#0369A1] font-semibold group-hover:translate-x-0.5 transition-transform hidden sm:flex items-center gap-0.5">
              Tugas <ArrowRight className="w-3 h-3" />
            </span>
          </p>
        </Link>

        {/* Metric 4: Status Sesi Presensi */}
        <Link
          href="/dashboard/presensi"
          className="glass-card min-w-0 p-4 sm:p-5 group hover:border-[#0369A1]/40 transition-all hover:translate-y-[-2px]"
        >
          <div className="flex items-center justify-between">
            <span className="min-w-0 text-[10px] sm:text-xs font-mono font-bold uppercase tracking-wider text-secondary">
              Sesi MyBest
            </span>
            <div className="hidden sm:flex w-8 h-8 shrink-0 rounded-sm bg-[#0F766E]/10 flex items-center justify-center text-[#0F766E] group-hover:bg-[#0F766E] group-hover:text-white transition-colors">
              <UserCheck className="w-4 h-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3">
            {presencePending ? (
              <Skeleton className="h-5 w-28" />
            ) : (
              <span className="text-sm font-display font-bold text-foreground truncate block">
                {presence.data?.status_sesi || "Sesi Ditutup"}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-secondary flex items-center justify-between">
            <span>Presensi perkuliahan</span>
            <span className="text-[#0369A1] font-semibold group-hover:translate-x-0.5 transition-transform hidden sm:flex items-center gap-0.5">
              Presensi <ArrowRight className="w-3 h-3" />
            </span>
          </p>
        </Link>
      </div>

      {/* 3. Section Kelas Hari Ini */}
      <section aria-labelledby="heading-kelas-hari-ini">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 mb-4">
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="w-5 h-5 shrink-0 text-[#0369A1]" aria-hidden="true" />
            <h2 id="heading-kelas-hari-ini" className="text-lg font-display font-bold tracking-tight text-foreground">
              Jadwal Kelas Hari {today}
            </h2>
          </div>
          <Link
            href="/dashboard/jadwal"
            className="text-xs font-semibold text-[#0369A1] hover:underline"
          >
            Lihat Semua Jadwal
          </Link>
        </div>

        {schedulePending ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" aria-hidden="true">
            <div className="glass-card p-5 space-y-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ) : todayClasses.length === 0 ? (
          <EmptyState
            title={`Tidak ada jadwal kuliah hari ${today}.`}
            description="Santai dulu, atau cicil tugas di MyBest."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {todayClasses.map((s) => (
              <div key={s.id} className="glass-card p-5 border-l-4 border-l-[#0369A1]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="font-mono text-xs font-bold text-[#0369A1] px-2 py-0.5 bg-[#0369A1]/10 rounded-sm">
                      {s.kode}
                    </span>
                    <h3 className="mt-1.5 font-bold text-foreground text-base leading-snug">
                      {s.nama}
                    </h3>
                  </div>
                  <span className="text-xs font-semibold font-mono text-secondary bg-[#F0F7FB] px-2.5 py-1 rounded-sm border border-stroke shrink-0">
                    {s.sks} SKS
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t-2 border-dashed border-px-soft grid grid-cols-2 gap-2 text-xs text-secondary">
                  <div>
                    <span className="block text-[10px] font-mono uppercase text-secondary font-semibold">Waktu:</span>
                    <span className="font-semibold text-foreground">{s.jam}</span>
                  </div>
                  <div className="min-w-0">
                    <span className="block text-[10px] font-mono uppercase text-secondary font-semibold">Ruang:</span>
                    <span className="font-semibold text-foreground break-words block">{s.ruang || "-"}</span>
                  </div>
                  <div className="col-span-2 min-w-0">
                    <span className="block text-[10px] font-mono uppercase text-secondary font-semibold">Dosen:</span>
                    <DosenInfo kode={s.kode_dosen} />
                  </div>
                </div>
                <Link
                  href={`/dashboard/presensi?${new URLSearchParams({ kode: s.kode ?? "", mk: s.nama ?? "" }).toString()}`}
                  className="px-btn-ghost mt-4 inline-flex min-h-10 w-full items-center justify-center gap-1.5 px-3 text-xs font-bold"
                >
                  <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  Absen
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. Banner Tugas Terdekat jika ada */}
      {nextTask && (
        <section aria-labelledby="heading-tugas-mendesak">
          <div className="p-5 sm:p-6 rounded-md bg-[#FFF7ED] border border-[#FDBA74] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2 rounded-sm bg-[#9A3412]/10 text-[#9A3412] shrink-0 mt-0.5">
                <AlertTriangle className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <span className="text-[11px] font-mono font-bold text-[#9A3412] uppercase tracking-wider">
                  Pengingat Tugas Perkuliahan
                </span>
                <h3 className="font-bold text-foreground text-base mt-0.5">
                  {nextTask.judul}
                </h3>
                <p className="text-xs text-secondary mt-1">
                  Mata Kuliah: {nextTask.mata_kuliah || nextTask.kode || "-"}
                  {nextTask.selesai ? ` | Batas Waktu: ${formatShortDate(parseDeadline(nextTask.selesai), nextTask.selesai)}` : ""}
                </p>
              </div>
            </div>

            <Link
              href="/dashboard/tugas"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-pill bg-[#9A3412] hover:bg-[#7C2D12] text-white text-xs font-bold transition-all shrink-0"
            >
              <span>Buka Tugas</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}

      {/* 5. Akses Cepat Fitur Akademik */}
      <section aria-labelledby="heading-layanan-cepat">
        <h2 id="heading-layanan-cepat" className="text-lg font-display font-bold tracking-tight text-foreground mb-4">
          Akses Cepat Layanan Kampus
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <Link
            href="/dashboard/materi"
            className="glass-card p-4 text-center hover:border-[#0369A1]/40 transition-all hover:bg-[#F0F7FB] flex flex-col items-center justify-center gap-2 group"
          >
            <div className="p-2.5 rounded-pill bg-[#0369A1]/10 text-[#0369A1] group-hover:scale-110 transition-transform">
              <BookOpen className="w-5 h-5" aria-hidden="true" />
            </div>
            <span className="text-xs font-bold text-foreground">Bahan Ajar</span>
            <span className="text-[10px] text-secondary">Slide & Modul Lab</span>
          </Link>

          <Link
            href="/dashboard/kuis"
            className="glass-card p-4 text-center hover:border-[#0369A1]/40 transition-all hover:bg-[#F0F7FB] flex flex-col items-center justify-center gap-2 group"
          >
            <div className="p-2.5 rounded-pill bg-[#0369A1]/10 text-[#0369A1] group-hover:scale-110 transition-transform">
              <HelpCircle className="w-5 h-5" aria-hidden="true" />
            </div>
            <span className="text-xs font-bold text-foreground">Kuis Online</span>
            <span className="text-[10px] text-secondary">Jadwal & Latihan</span>
          </Link>

          <Link
            href="/dashboard/nilai"
            className="glass-card p-4 text-center hover:border-[#0369A1]/40 transition-all hover:bg-[#F0F7FB] flex flex-col items-center justify-center gap-2 group"
          >
            <div className="p-2.5 rounded-pill bg-[#0369A1]/10 text-[#0369A1] group-hover:scale-110 transition-transform">
              <GraduationCap className="w-5 h-5" aria-hidden="true" />
            </div>
            <span className="text-xs font-bold text-foreground">Nilai & KHS</span>
            <span className="text-[10px] text-secondary">Transkrip Kumulatif</span>
          </Link>

          <Link
            href="/dashboard/ujian"
            className="glass-card p-4 text-center hover:border-[#0369A1]/40 transition-all hover:bg-[#F0F7FB] flex flex-col items-center justify-center gap-2 group"
          >
            <div className="p-2.5 rounded-pill bg-[#0369A1]/10 text-[#0369A1] group-hover:scale-110 transition-transform">
              <Award className="w-5 h-5" aria-hidden="true" />
            </div>
            <span className="text-xs font-bold text-foreground">Kartu Ujian</span>
            <span className="text-[10px] text-secondary">Jadwal UTS & UAS</span>
          </Link>

          <Link
            href="/dashboard/perpustakaan"
            className="glass-card p-4 text-center hover:border-[#0369A1]/40 transition-all hover:bg-[#F0F7FB] flex flex-col items-center justify-center gap-2 group col-span-2 sm:col-span-1"
          >
            <div className="p-2.5 rounded-pill bg-[#0369A1]/10 text-[#0369A1] group-hover:scale-110 transition-transform">
              <Library className="w-5 h-5" aria-hidden="true" />
            </div>
            <span className="text-xs font-bold text-foreground">Perpustakaan</span>
            <span className="text-[10px] text-secondary">Katalog Buku OPAC</span>
          </Link>
        </div>
      </section>
    </div>
  );
}
