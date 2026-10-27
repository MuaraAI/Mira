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
  CheckCircle2,
  Radio,
  BookOpen,
  Award,
  Library,
  AlertTriangle,
  HelpCircle,
  MessagesSquare,
} from "lucide-react";
import { useApi } from "@/lib/api";
import { findSubmission, formatShortDate, parseDeadline } from "@/lib/assignments";
import { TodayClassCard, type TodayClass } from "@/components/TodayClassCard";
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
  const firstName = (profile.data?.nama || "").trim().split(/\s+/)[0] ?? "";
  // SIAKAD menulis nama dalam huruf kapital ("VERZIO"): tampilkan rapi ("Verzio").
  const displayName = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() : `Mahasiswa`;
  const hasKhs = Boolean(khs.data && (khs.data.total_sks ?? 0) > 0);
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
      {/* 1. Hero: pita aksen dengan sapaan + identitas, lalu sorotan kelas dan pintasan */}
      <section className="overflow-hidden bg-white shadow-[0_0_0_2px_#163A55,6px_6px_0_0_#9CC6E0]" aria-label="Ringkasan hari ini">
        <div
          className="relative px-4 pb-5 pt-4 text-white sm:px-6 sm:pb-6 sm:pt-5"
          style={{
            backgroundColor: "#0369A1",
            backgroundImage:
              "radial-gradient(rgba(255,255,255,.14) 1.5px, transparent 1.5px), linear-gradient(135deg, #0369A1 0%, #075985 60%, #0B2D46 100%)",
            backgroundSize: "14px 14px, 100% 100%",
          }}
        >
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">{shortDate(now)}</p>
          <h1 className="mt-1.5 break-words text-[1.6rem] font-display font-bold leading-tight tracking-tight sm:text-3xl">
            {greeting(now.getHours())},{" "}
            {profilePending ? <Skeleton className="h-7 w-32 max-w-full align-middle opacity-40" /> : displayName}
          </h1>
          {profilePending ? (
            <Skeleton className="mt-2 h-4 w-56 max-w-full opacity-40" />
          ) : (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-white/85">
              <span className="font-mono font-semibold text-white">{nim}</span>
              <span aria-hidden="true">·</span>
              <span>
                {prodi}
                {kelas ? ` ${kelas}` : ""}
              </span>
              <span aria-hidden="true">·</span>
              <span>Semester {semester}</span>
              {kampus && (
                <>
                  <span aria-hidden="true" className="hidden sm:inline">·</span>
                  <span className="hidden sm:inline">{kampus}</span>
                </>
              )}
            </p>
          )}
        </div>

        {/* Sorotan: kelas sekarang / berikutnya / status hari ini */}
        <a
          href="#heading-kelas-hari-ini"
          className="flex items-center gap-3 border-b-2 border-[#EAF3F9] px-4 py-3.5 transition-colors hover:bg-[#F7FAFC] sm:px-6"
        >
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center ${
              liveClass ? "bg-[#9A3412] text-white" : spotlight ? "bg-[#0369A1]/10 text-[#0369A1]" : "bg-[#0F766E]/10 text-[#0F766E]"
            }`}
            aria-hidden="true"
          >
            {liveClass ? <Radio className="h-5 w-5" /> : spotlight ? <Clock className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
          </span>
          <span className="min-w-0 flex-1">
            {schedulePending ? (
              <>
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="mt-1.5 h-5 w-3/4" />
              </>
            ) : spotlight ? (
              <>
                <span className={`block text-[11px] font-bold uppercase tracking-[0.12em] ${liveClass ? "text-[#9A3412]" : "text-[#0369A1]"}`}>
                  {liveClass ? "Sedang berlangsung" : "Kelas berikutnya"}
                </span>
                <span className="block truncate text-[15px] font-bold text-foreground">{spotlight.nama}</span>
                <span className="block truncate text-xs text-secondary">
                  {spotlight.timing?.label} · {describeRoom(spotlight.ruang).label}
                </span>
              </>
            ) : (
              <>
                <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#0F766E]">
                  {todayClasses.length ? "Kuliah hari ini selesai" : "Hari bebas kuliah"}
                </span>
                <span className="block text-[15px] font-bold text-foreground">
                  {todayClasses.length
                    ? `${presentCount} dari ${todayClasses.length} kelas sudah absen`
                    : `Tidak ada kelas hari ${DAY_NAMES[todayIdx]}`}
                </span>
                <span className="block text-xs text-secondary">
                  {pendingTasks.length ? `${pendingTasks.length} tugas menunggu dicicil` : "Tidak ada tugas yang menunggu"}
                </span>
              </>
            )}
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
        </a>

        {/* Pintasan ala aplikasi */}
        <nav aria-label="Pintasan" className="grid grid-cols-4 gap-1 px-2 py-2.5 sm:px-4">
          {[
            { href: "/dashboard/jadwal", label: "Jadwal", icon: CalendarDays },
            { href: "/dashboard/presensi", label: "Presensi", icon: UserCheck },
            { href: "/dashboard/tugas", label: "Tugas", icon: CheckSquare },
            { href: "/dashboard/komunitas", label: "Komunitas", icon: MessagesSquare },
          ].map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="group flex flex-col items-center gap-1.5 py-1.5 text-center">
              <span className="flex h-11 w-11 items-center justify-center bg-[#EAF3F9] text-[#0369A1] shadow-[0_0_0_2px_#CFE2EE] transition-[background-color,color,transform] duration-200 group-hover:-translate-y-0.5 group-hover:bg-[#0369A1] group-hover:text-white">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-[12px] font-semibold text-foreground">{label}</span>
            </Link>
          ))}
        </nav>
      </section>

      {/* 2. Metrik ringkas */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard
          href="/dashboard/nilai"
          label="IPK"
          icon={GraduationCap}
          pending={khsPending}
          value={hasKhs ? ipkValue : "Belum ada"}
          small={!hasKhs}
          suffix={hasKhs ? "/ 4.00" : undefined}
          note={hasKhs ? `${totalSks} SKS lulus` : "Muncul akhir semester"}
        />
        <MetricCard
          href="#heading-kelas-hari-ini"
          label="Absen"
          icon={UserCheck}
          pending={schedulePending}
          value={todayClasses.length ? `${presentCount}/${todayClasses.length}` : "-"}
          note={
            !todayClasses.length
              ? "Tidak ada kelas"
              : presentCount === todayClasses.length
                ? "Semua sudah absen"
                : absenRelevant > presentCount
                  ? `${absenRelevant - presentCount} belum absen`
                  : "Menunggu jam kuliah"
          }
          tone={todayClasses.length && absenRelevant > presentCount ? "warn" : "ok"}
        />
        <MetricCard
          href="/dashboard/tugas"
          label="Tugas"
          icon={CheckSquare}
          pending={assignmentsPending}
          value={String(pendingTasks.length)}
          note={
            hoursLeft !== null
              ? hoursLeft < 24
                ? `Deadline ${hoursLeft} jam lagi`
                : `Deadline ${Math.round(hoursLeft / 24)} hari lagi`
              : pendingTasks.length
                ? "Belum ada deadline"
                : "Semua beres"
          }
          tone={hoursLeft !== null && hoursLeft < 24 ? "warn" : "ok"}
        />
        <MetricCard
          href="/dashboard/jadwal"
          label="Kelas"
          icon={CalendarDays}
          pending={schedulePending}
          value={String(todayClasses.length)}
          note={todayClasses.length ? (todayClasses.length - doneCount ? `${todayClasses.length - doneCount} lagi hari ini` : "Semua selesai") : "Hari bebas"}
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
  small = false,
  tone = "ok",
}: {
  href: string;
  label: string;
  icon: typeof GraduationCap;
  pending: boolean;
  value: string;
  suffix?: string;
  note: string;
  small?: boolean;
  tone?: "ok" | "warn";
}) {
  return (
    <Link
      href={href}
      className="group min-w-0 bg-white p-3.5 shadow-[0_0_0_2px_#CFE2EE,4px_4px_0_0_#EAF3F9] transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_2px_#5FA3CC,4px_4px_0_0_#DCEBF5] sm:p-4"
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-7 w-7 shrink-0 items-center justify-center ${
            tone === "warn" ? "bg-[#9A3412]/10 text-[#9A3412]" : "bg-[#0369A1]/10 text-[#0369A1]"
          }`}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="truncate text-[13px] font-semibold text-secondary">{label}</span>
      </div>
      <div className="mt-2.5 flex items-baseline gap-1">
        {pending ? (
          <Skeleton className="h-7 w-14" />
        ) : (
          <>
            <span className={`font-display font-bold leading-none text-foreground ${small ? "text-lg" : "text-[1.7rem]"}`}>{value}</span>
            {suffix && <span className="font-mono text-[11px] text-secondary">{suffix}</span>}
          </>
        )}
      </div>
      <p className={`mt-1.5 truncate text-xs ${tone === "warn" ? "font-semibold text-[#9A3412]" : "text-secondary"}`}>{pending ? "\u00a0" : note}</p>
    </Link>
  );
}
