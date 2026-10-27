"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  MessagesSquare,
} from "lucide-react";
import { useApi } from "@/lib/api";
import { findSubmission, formatShortDate, parseDeadline } from "@/lib/assignments";
import { TodayClassCard, type TodayClass } from "@/components/TodayClassCard";
import { PixelTrophy } from "@/components/PixelIcons";
import { splitProgram } from "@/lib/profile";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Skeleton,
} from "@/components/dashboard-ui";
import { DAY_NAMES, dayIndex, describeRoom, sessionTiming, shortDate } from "@/lib/schedule";

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

interface ElearningCourse {
  id?: string;
  kode?: string;
  nama: string;
  hari?: string;
  jam?: string;
  ruang?: string;
  kode_dosen?: string;
  token_absen?: string | null;
}

const PERSIST_12H = 12 * 60 * 60 * 1000;

function greeting(hour: number) {
  if (hour < 11) return "Selamat pagi";
  if (hour < 15) return "Selamat siang";
  if (hour < 18) return "Selamat sore";
  return "Selamat malam";
}

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

export default function DashboardOverviewPage() {
  const me = useApi<{ nim: string; auth_type?: string }>("/v1/auth/me");
  const profile = useApi<StudentProfile>("/v1/studentv2/profile", { persistMs: PERSIST_12H });
  const schedule = useApi<ScheduleItem[]>("/v1/studentv2/schedule", { persistMs: PERSIST_12H });
  const khs = useApi<KhsData>("/v1/studentv2/khs", { persistMs: PERSIST_12H });
  const assignments = useApi<AssignmentsData>("/v1/elearning/assignments", { persistMs: 6 * 60 * 60 * 1000, refreshMs: 5 * 60_000 });
  // Token presensi per mapel berasal dari daftar mapel MyBest (dicocokkan dengan jadwal SIAKAD lewat kode/nama).
  const courses = useApi<ElearningCourse[]>("/v1/elearning/courses", { persistMs: PERSIST_12H });

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const [presentMap, setPresentMap] = useState<Record<string, boolean>>({});
  const reportStatus = useCallback(
    (key: string, present: boolean) => setPresentMap((prev) => (prev[key] === present ? prev : { ...prev, [key]: present })),
    []
  );

  const todayIdx = now.getDay();
  const todayClasses: TodayClass[] = useMemo(() => {
    const list = (schedule.data ?? []).filter((s) => dayIndex(s.hari) === todayIdx);
    const el = courses.data ?? [];
    return list
      .map((s) => {
        const match =
          el.find((c) => norm(c.kode) && norm(c.kode) === norm(s.kode) && dayIndex(c.hari) === todayIdx) ||
          el.find((c) => norm(c.kode) && norm(c.kode) === norm(s.kode)) ||
          el.find((c) => norm(c.nama) === norm(s.nama));
        return {
          key: s.id || `${s.kode}-${s.jam}`,
          kode: s.kode,
          nama: s.nama,
          jam: s.jam,
          ruang: s.ruang || match?.ruang || "",
          sks: s.sks,
          kode_dosen: s.kode_dosen || match?.kode_dosen,
          token: match?.token_absen ?? null,
          timing: sessionTiming(s.hari, s.jam, now),
        };
      })
      .sort((a, b) => (a.timing?.range?.[0] ?? 0) - (b.timing?.range?.[0] ?? 0));
    // Dihitung ulang per menit cukup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedule.data, courses.data, todayIdx, Math.floor(now.getTime() / 60_000)]);

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

  const nim = me.data?.nim ?? profile.data?.nim ?? "-";
  const firstName = (profile.data?.nama || "").trim().split(/\s+/)[0];
  const studentName = profile.data?.nama || `Mahasiswa (${nim})`;
  const { prodi: prodiName, kampus: kampusName } = splitProgram(profile.data);
  const prodi = prodiName || "Data belum tersedia";
  const kampus = kampusName;
  const semester = profile.data?.semester_aktif || "-";
  const kelas = profile.data?.kelas || "";

  const ipkValue = khs.data?.ipk != null ? khs.data.ipk.toFixed(2) : "-";
  const totalSks = khs.data?.total_sks != null ? String(khs.data.total_sks) : "-";

  const tasksList = assignments.data?.tasks ?? [];
  const submissionsList = assignments.data?.submissions ?? [];
  const pendingTasks = tasksList.filter((t) => !findSubmission(t, submissionsList));

  // Pengingat: tugas belum dikumpul dengan batas waktu terdekat yang belum lewat.
  const nowMs = now.getTime();
  const nextTask =
    pendingTasks
      .map((t) => ({ t, at: parseDeadline(t.selesai)?.getTime() ?? Infinity }))
      .filter(({ at }) => at >= nowMs)
      .sort((a, b) => a.at - b.at)[0]?.t ?? null;
  const nextDeadline = nextTask ? parseDeadline(nextTask.selesai) : null;
  const hoursLeft = nextDeadline ? Math.max(0, Math.round((nextDeadline.getTime() - nowMs) / 3_600_000)) : null;

  const liveClass = todayClasses.find((c) => c.timing?.state === "live") ?? null;
  const nextClass = todayClasses.find((c) => c.timing?.state === "soon" || c.timing?.state === "upcoming") ?? null;
  const spotlight = liveClass ?? nextClass;
  const doneCount = todayClasses.filter((c) => c.timing?.state === "done").length;
  const presentCount = todayClasses.filter((c) => presentMap[c.key]).length;
  const absenRelevant = todayClasses.filter((c) => c.timing?.state === "done" || c.timing?.state === "live").length;

  const taughtBy = (kode?: string) =>
    (schedule.data ?? []).filter((s) => kode && s.kode_dosen === kode).map((s) => ({ nama: s.nama, hari: s.hari, jam: s.jam }));

  return (
    <div className="space-y-7">
      {/* 1. Hero: sapaan, identitas singkat, dan sorotan kelas sekarang/berikutnya */}
      <section className="glass-card relative overflow-hidden p-5 sm:p-7" aria-label="Ringkasan hari ini">
        {/* Garis air pixel dekoratif di tepi bawah (ringan, CSS murni). */}
        <span
          className="pointer-events-none absolute inset-x-0 bottom-0 h-3 opacity-60"
          style={{ background: "repeating-linear-gradient(90deg, #9CC6E0 0 12px, transparent 12px 16px, #5FA3CC 16px 20px, transparent 20px 32px)" }}
          aria-hidden="true"
        />
        <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-stretch">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.16em] text-[#0369A1]">{shortDate(now)}</p>
            <h1 className="mt-2 break-words text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">
              {greeting(now.getHours())},{" "}
              {profilePending ? <Skeleton className="h-7 w-40 max-w-full align-middle" /> : firstName || studentName}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <span className="bg-[#0369A1]/10 px-2.5 py-1 font-mono font-bold text-[#0369A1]">NIM {nim}</span>
              {profilePending ? (
                <Skeleton className="h-6 w-40" />
              ) : (
                <>
                  <span className="inline-flex items-center gap-1 bg-[#F0F7FB] px-2.5 py-1 font-semibold text-secondary">
                    <School className="h-3.5 w-3.5 text-[#0369A1]" aria-hidden="true" />
                    {prodi}
                    {kelas ? ` · ${kelas}` : ""}
                  </span>
                  <span className="bg-[#F0F7FB] px-2.5 py-1 font-semibold text-secondary">Semester {semester}</span>
                  {kampus && (
                    <span className="inline-flex items-center gap-1 bg-[#F0F7FB] px-2.5 py-1 font-semibold text-secondary">
                      <MapPin className="h-3.5 w-3.5 text-[#0369A1]" aria-hidden="true" />
                      {kampus}
                    </span>
                  )}
                </>
              )}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              <Link href="/dashboard/jadwal" className="px-btn inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-xs font-bold sm:gap-2 sm:px-4 sm:text-sm">
                <CalendarDays className="h-4 w-4" aria-hidden="true" /> Jadwal
              </Link>
              <Link href="/dashboard/komunitas" className="px-btn-ghost inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-xs font-bold sm:gap-2 sm:px-4 sm:text-sm">
                <MessagesSquare className="h-4 w-4" aria-hidden="true" /> Komunitas
              </Link>
              <Link href="/dashboard/nilai?flexing=1" className="px-btn-ghost inline-flex min-h-11 items-center justify-center gap-1.5 px-2 text-xs font-bold sm:gap-2 sm:px-4 sm:text-sm">
                <PixelTrophy className="h-4 w-4" aria-hidden="true" /> Flexing
              </Link>
            </div>
          </div>

          {/* Sorotan: kelas yang sedang berlangsung, berikutnya, atau status hari ini */}
          <div
            className={`flex flex-col justify-between gap-3 p-4 sm:p-5 ${
              liveClass ? "bg-[#9A3412]/[0.07] shadow-[inset_4px_0_0_#9A3412]" : "bg-[#F0F7FB] shadow-[inset_4px_0_0_#0369A1]"
            }`}
          >
            {schedulePending ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : spotlight ? (
              <>
                <div>
                  <p className={`flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] ${liveClass ? "text-[#9A3412]" : "text-[#0369A1]"}`}>
                    <span className={`h-1.5 w-1.5 ${liveClass ? "px-cursor bg-[#9A3412]" : "bg-[#0369A1]"}`} aria-hidden="true" />
                    {liveClass ? "Sedang berlangsung" : "Kelas berikutnya"}
                  </p>
                  <p className="mt-1.5 text-lg font-bold leading-snug text-foreground">{spotlight.nama}</p>
                  <p className="mt-1 text-sm text-secondary">
                    {spotlight.timing?.label} · {describeRoom(spotlight.ruang).label}
                  </p>
                </div>
                <a href="#heading-kelas-hari-ini" className="inline-flex items-center gap-1 text-xs font-bold text-[#0369A1] hover:underline">
                  Lihat status absen <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              </>
            ) : todayClasses.length > 0 ? (
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#0F766E]">Kuliah hari ini selesai</p>
                <p className="mt-1.5 text-lg font-bold text-foreground">
                  {doneCount} kelas sudah lewat{presentCount ? `, ${presentCount} sudah absen` : ""}
                </p>
                <p className="mt-1 text-sm text-secondary">Cek tugas yang perlu dicicil malam ini.</p>
              </div>
            ) : (
              <div>
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-[#0F766E]">Hari bebas kuliah</p>
                <p className="mt-1.5 text-lg font-bold text-foreground">Tidak ada kelas hari {DAY_NAMES[todayIdx]}</p>
                <p className="mt-1 text-sm text-secondary">Waktu yang pas untuk mencicil tugas.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 2. Metrik singkat */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <MetricCard
          href="/dashboard/nilai"
          label="IPK"
          icon={GraduationCap}
          pending={khsPending}
          value={ipkValue}
          suffix="/ 4.00"
          note={`${totalSks} SKS lulus`}
        />
        <MetricCard
          href="#heading-kelas-hari-ini"
          label="Absen hari ini"
          icon={UserCheck}
          pending={schedulePending}
          value={todayClasses.length ? `${presentCount}/${todayClasses.length}` : "0"}
          note={
            !todayClasses.length
              ? "Tidak ada kelas"
              : presentCount === todayClasses.length
                ? "Semua sudah absen"
                : absenRelevant > presentCount
                  ? `${absenRelevant - presentCount} kelas belum absen`
                  : "Menunggu jam kuliah"
          }
          tone={todayClasses.length && absenRelevant > presentCount ? "warn" : "ok"}
        />
        <MetricCard
          href="/dashboard/tugas"
          label="Tugas belum selesai"
          icon={CheckSquare}
          pending={assignmentsPending}
          value={String(pendingTasks.length)}
          note={hoursLeft !== null ? (hoursLeft < 24 ? `Terdekat ${hoursLeft} jam lagi` : `Terdekat ${Math.round(hoursLeft / 24)} hari lagi`) : pendingTasks.length ? "Belum ada deadline" : "Semua beres"}
          tone={hoursLeft !== null && hoursLeft < 24 ? "warn" : "ok"}
        />
        <MetricCard
          href="/dashboard/jadwal"
          label="Kelas hari ini"
          icon={CalendarDays}
          pending={schedulePending}
          value={String(todayClasses.length)}
          note={todayClasses.length ? `${doneCount} selesai · ${todayClasses.length - doneCount} lagi` : "Hari bebas kuliah"}
        />
      </div>

      {/* 3. Kelas hari ini: status absen langsung + absen sekali ketuk */}
      <section aria-labelledby="heading-kelas-hari-ini" className="scroll-mt-24">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-2">
            <Clock className="h-5 w-5 shrink-0 text-[#0369A1]" aria-hidden="true" />
            <h2 id="heading-kelas-hari-ini" className="text-lg font-display font-bold tracking-tight text-foreground">
              Kelas Hari {DAY_NAMES[todayIdx]}
            </h2>
          </div>
          <Link href="/dashboard/jadwal" className="text-xs font-semibold text-[#0369A1] hover:underline">
            Lihat semua jadwal
          </Link>
        </div>

        {schedulePending ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2" aria-hidden="true">
            {[0, 1].map((i) => (
              <div key={i} className="glass-card space-y-3 p-5">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-11 w-full" />
              </div>
            ))}
          </div>
        ) : todayClasses.length === 0 ? (
          <EmptyState title={`Tidak ada jadwal kuliah hari ${DAY_NAMES[todayIdx]}.`} description="Santai dulu, atau cicil tugas di MyBest." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {todayClasses.map((c) => (
              <TodayClassCard key={c.key} item={c} taughtBy={taughtBy(c.kode_dosen)} onStatus={reportStatus} />
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

function MetricCard({
  href,
  label,
  icon: Icon,
  pending,
  value,
  suffix,
  note,
  tone = "ok",
}: {
  href: string;
  label: string;
  icon: typeof GraduationCap;
  pending: boolean;
  value: string;
  suffix?: string;
  note: string;
  tone?: "ok" | "warn";
}) {
  return (
    <Link href={href} className="glass-card group min-w-0 p-4 transition-transform hover:-translate-y-0.5 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-mono text-[10px] font-bold uppercase tracking-wider text-secondary sm:text-[11px]">{label}</span>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center transition-colors ${
            tone === "warn" ? "bg-[#9A3412]/10 text-[#9A3412]" : "bg-[#0369A1]/10 text-[#0369A1] group-hover:bg-[#0369A1] group-hover:text-white"
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-3">
        {pending ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <>
            <span className="text-2xl font-display font-bold text-foreground sm:text-3xl">{value}</span>
            {suffix && <span className="ml-1 font-mono text-xs text-secondary">{suffix}</span>}
          </>
        )}
      </div>
      <p className={`mt-1 truncate text-xs ${tone === "warn" ? "font-semibold text-[#9A3412]" : "text-secondary"}`}>{pending ? "\u00a0" : note}</p>
    </Link>
  );
}
