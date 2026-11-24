"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  GraduationCap,
  Clock,
  BookOpen,
  Award,
  Library,
  HelpCircle,
} from "lucide-react";
import { useApi, AuthMeResponse } from "@/lib/api";
import { findSubmission, formatShortDate, parseDeadline } from "@/lib/assignments";
import { TodayClassCard, type TodayClass } from "@/components/TodayClassCard";
import { SiaKadLockedCard } from "@/components/SiaKadLockedCard";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  Skeleton,
} from "@/components/dashboard-ui";
import { DAY_NAMES, dayIndex, sessionTiming, shortDate } from "@/lib/schedule";

interface KhsData {
  items: unknown[];
  total_mutu: number;
  total_sks: number;
  ipk: number;
  ips?: number | null;
  semester?: number | string | null;
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

interface AcademicEventSummary {
  id: string;
  nama: string;
  tanggal_mulai_raw: string;
  tanggal_selesai_raw: string;
  status: string;
  countdown?: string | null;
  days_left?: number | null;
  kategori: string;
}

interface ElearningCourse {
  id?: string;
  kode?: string;
  nama: string;
  hari?: string;
  jam?: string;
  sks?: number;
  ruang?: string;
  kode_dosen?: string;
  kelas?: string;
  kelompok_praktek?: string | null;
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

function parseShortDateTile(raw: string): { day: string; month: string } {
  const m = raw.trim().match(/^(\d{1,2})\s+([A-Za-z]+)/);
  if (m) return { day: m[1].padStart(2, "0"), month: m[2].slice(0, 3).toUpperCase() };
  return { day: "--", month: "TGL" };
}

export default function DashboardOverviewPage() {
  const me = useApi<AuthMeResponse>("/v1/auth/me");
  const assignments = useApi<AssignmentsData>("/v1/elearning/assignments", {
    persistMs: 6 * 60 * 60 * 1000,
    refreshMs: 5 * 60_000,
  });
  const courses = useApi<ElearningCourse[]>("/v1/elearning/courses", { persistMs: PERSIST_12H });
  const elearningProfile = useApi<{ nama?: string; email?: string }>("/v1/elearning/profile", {
    persistMs: PERSIST_12H,
  });
  const academicEvents = useApi<AcademicEventSummary[]>("/v1/academic/events", {
    persistMs: PERSIST_12H,
  });
  const khs = useApi<KhsData>("/v1/studentv2/khs", { persistMs: PERSIST_12H });
  const utsExams = useApi<{
    exams: { mata_kuliah: string; no_ruang?: string | null; tanggal_ujian?: string | null; waktu?: string | null }[];
  }>("/v1/elearning/exams/uts", { persistMs: PERSIST_12H });
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(t);
  }, []);
  const [presentMap, setPresentMap] = useState<Record<string, boolean>>({});
  const reportStatus = useCallback(
    (key: string, present: boolean) =>
      setPresentMap((prev) => (prev[key] === present ? prev : { ...prev, [key]: present })),
    []
  );

  const todayIdx = now.getDay();
  const activeSchedule = useMemo(() => {
    return (courses.data ?? []).map((c) => ({
      id: c.id || `${c.kode}-${c.jam}`,
      kode: c.kode || "",
      nama: c.nama,
      hari: c.hari || "",
      jam: c.jam || "",
      sks: c.sks || 0,
      ruang: c.ruang || "",
      kode_dosen: c.kode_dosen || "-",
      kelompok_praktek: c.kelompok_praktek ?? null,
    }));
  }, [courses.data]);

  const todayClasses: TodayClass[] = useMemo(() => {
    const list = activeSchedule.filter((s) => dayIndex(s.hari) === todayIdx);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSchedule, courses.data, todayIdx, Math.floor(now.getTime() / 60_000)]);

  const nearestAgenda = useMemo(() => {
    const list = (academicEvents.data ?? []).filter((e) => e.days_left != null && e.days_left >= 0);
    return list.sort((a, b) => (a.days_left ?? 999) - (b.days_left ?? 999))[0] ?? null;
  }, [academicEvents.data]);

  if (me.loading && !me.data) {
    return <LoadingState label="Menyiapkan dashboard" />;
  }
  if (me.error) return <ErrorState error={me.error} onRetry={me.reload} />;

  const isPending = (q: { loading: boolean; data: unknown }) => q.loading && !q.data;
  const profilePending = isPending(elearningProfile);
  const schedulePending = isPending(courses);
  const assignmentsPending = isPending(assignments);

  const nim = me.data?.nim ?? "-";
  const rawName = (elearningProfile.data?.nama || "").trim();
  const firstName = rawName.split(/\s+/)[0] ?? "";
  const displayName = firstName
    ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase()
    : `Mahasiswa`;
  const prodi = courses.data && courses.data.length > 0 ? "Mahasiswa Aktif" : "Data belum tersedia";
  const kelas = courses.data?.[0]?.kelas || "";

  const tasksList = assignments.data?.tasks ?? [];
  const submissionsList = assignments.data?.submissions ?? [];
  const pendingTasks = tasksList.filter((t) => !findSubmission(t, submissionsList));

  const nowMs = now.getTime();
  const nextTask =
    pendingTasks
      .map((t) => ({ t, at: parseDeadline(t.selesai)?.getTime() ?? Infinity }))
      .filter(({ at }) => at >= nowMs)
      .sort((a, b) => a.at - b.at)[0]?.t ?? null;
  const nextDeadline = nextTask ? parseDeadline(nextTask.selesai) : null;
  const hoursLeft = nextDeadline
    ? Math.max(0, Math.round((nextDeadline.getTime() - nowMs) / 3_600_000))
    : null;

  const khsSiaKadMissing = khs.error?.status === 401;

  const liveClass = todayClasses.find((c) => c.timing?.state === "live") ?? null;
  const nextClass =
    todayClasses.find((c) => c.timing?.state === "soon" || c.timing?.state === "upcoming") ?? null;
  const spotlight = liveClass ?? nextClass;
  const doneCount = todayClasses.filter((c) => c.timing?.state === "done").length;
  const presentCount = todayClasses.filter((c) => presentMap[c.key]).length;
  const absenRelevant = todayClasses.filter(
    (c) => c.timing?.state === "done" || c.timing?.state === "live"
  ).length;

  const taughtBy = (kode?: string) =>
    activeSchedule
      .filter((s) => kode && s.kode_dosen === kode)
      .map((s) => ({ nama: s.nama, hari: s.hari, jam: s.jam }));

  return (
    <div className="min-w-0 space-y-5">
      {/* 1. Clean Editorial Workspace Header + Detached Metric Bar */}
      <section className="space-y-3" aria-label="Ringkasan hari ini">
        <div className="relative overflow-hidden rounded-[12px] border-[1px] border-[#0E2F4A] bg-[#051828] px-5 py-5 text-white sm:px-7 sm:py-6">
          <Image
            src="/images/dashboard-banner-muara.webp"
            alt=""
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 960px"
            className="select-none object-cover object-center"
            aria-hidden="true"
          />

          <div className="relative z-10 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#9AD8F8]">
                {shortDate(now)}
              </p>
              <h1 className="font-home-display mt-1.5 break-words text-[clamp(1.5rem,3vw,2.05rem)] leading-[1.12] tracking-[-0.01em] text-white">
                {greeting(now.getHours())},{" "}
                {profilePending ? (
                  <Skeleton className="h-7 w-32 max-w-full align-middle opacity-40" />
                ) : (
                  displayName
                )}
              </h1>
              {profilePending ? (
                <Skeleton className="mt-2 h-4 w-56 max-w-full opacity-40" />
              ) : (
                <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-[#CBE0EE]">
                  <span className="font-mono text-white">{nim}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {prodi}
                    {kelas ? ` ${kelas}` : ""}
                  </span>
                </p>
              )}
            </div>

            <div className="flex flex-col gap-3 lg:items-end">
              {!schedulePending && (
                <a
                  href="#heading-kelas-hari-ini"
                  className="text-left text-xs text-[#DCEBF5] transition-colors hover:text-white lg:text-right"
                >
                  {spotlight ? (
                    <>
                      <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-[#7DD3FC]">
                        {liveClass ? "Sedang berlangsung" : "Berikutnya"}
                      </span>
                      <span className="mt-0.5 block truncate font-medium text-white">
                        {spotlight.nama} · {spotlight.timing?.label}
                      </span>
                    </>
                  ) : (
                    <span className="font-mono text-[11px] text-[#CBE0EE]">
                      {todayClasses.length
                        ? `${presentCount} dari ${todayClasses.length} kelas hari ini sudah absen`
                        : `Tidak ada kelas hari ${DAY_NAMES[todayIdx]}`}
                    </span>
                  )}
                </a>
              )}

              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/presensi"
                  className="inline-flex min-h-[38px] items-center justify-center rounded-[6px] border-[1px] border-white bg-white px-4 text-xs font-medium text-[#072033] transition-colors duration-200 hover:bg-transparent hover:text-white"
                >
                  Presensi
                </Link>
                <Link
                  href="/dashboard/komunitas"
                  className="inline-flex min-h-[38px] items-center justify-center rounded-[6px] border-[1px] border-white/30 bg-transparent px-3.5 text-xs text-white transition-colors hover:border-white hover:bg-white hover:text-[#072033]"
                >
                  Komunitas
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Grounded 4-Column Metric Strip on Light Surface */}
        <div className="grid grid-cols-2 divide-x-[1px] divide-y-[1px] divide-stroke overflow-hidden rounded-[10px] border-[1px] border-stroke bg-white sm:grid-cols-4 sm:divide-y-0">
          {[
            {
              href: khsSiaKadMissing ? "/dashboard/sesi" : "/dashboard/nilai",
              label: "IPK",
              pending: khs.loading && !khs.data && !khsSiaKadMissing,
              value: khs.data?.ipk ? khs.data.ipk.toFixed(2) : khsSiaKadMissing ? "Tautkan" : "-",
              sub: khsSiaKadMissing
                ? "Tautkan SIAKAD"
                : khs.data?.total_sks
                  ? `${khs.data.total_sks} SKS lulus`
                  : "Belum dirilis",
            },
            {
              href: "#heading-kelas-hari-ini",
              label: "Presensi",
              pending: schedulePending,
              value: todayClasses.length ? `${presentCount}/${todayClasses.length}` : "-",
              sub: !todayClasses.length
                ? "Hari bebas"
                : presentCount === todayClasses.length
                  ? "Semua hadir"
                  : absenRelevant > presentCount
                    ? `${absenRelevant - presentCount} belum absen`
                    : "Menunggu kelas",
            },
            {
              href: "/dashboard/tugas",
              label: "Tugas",
              pending: assignmentsPending,
              value: String(pendingTasks.length),
              sub:
                hoursLeft !== null
                  ? hoursLeft < 24
                    ? `${hoursLeft} jam lagi`
                    : `${Math.round(hoursLeft / 24)} hari lagi`
                  : pendingTasks.length
                    ? "Cek deadline"
                    : "Semua beres",
            },
            {
              href: "/dashboard/jadwal",
              label: "Kelas",
              pending: schedulePending,
              value: String(todayClasses.length),
              sub: todayClasses.length
                ? todayClasses.length - doneCount
                  ? `${todayClasses.length - doneCount} lagi hari ini`
                  : "Semua selesai"
                : "Hari bebas",
            },
          ].map((cell) => (
            <Link
              key={cell.label}
              href={cell.href}
              className="group flex flex-col justify-between px-4 py-3.5 text-left transition-colors hover:bg-[#FAFDFE]"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-secondary">
                {cell.label}
              </span>
              <span className="font-display mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.01em] text-foreground tabular-nums sm:text-2xl">
                {cell.pending ? <Skeleton className="h-6 w-12" /> : cell.value}
              </span>
              <span className="mt-1 truncate text-[11.5px] text-secondary group-hover:text-foreground">
                {cell.sub}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <SiaKadLockedCard compact />

      {/* 3. Kelas hari ini */}
      <section aria-labelledby="heading-kelas-hari-ini" className="scroll-mt-24">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-2">
            <Clock className="h-5 w-5 shrink-0 text-[#0369A1]" aria-hidden="true" />
            <h2
              id="heading-kelas-hari-ini"
              className="text-lg tracking-[-0.01em] text-foreground"
            >
              Kelas Hari {DAY_NAMES[todayIdx]}
            </h2>
          </div>
          <Link href="/dashboard/jadwal" className="text-xs text-[#0369A1] hover:underline">
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
          <EmptyState
            title={`Tidak ada jadwal kuliah hari ${DAY_NAMES[todayIdx]}.`}
            description="Santai dulu, atau cicil tugas di MyBest."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {todayClasses.map((c) => (
              <TodayClassCard
                key={c.key}
                item={c}
                taughtBy={taughtBy(c.kode_dosen)}
                onStatus={reportStatus}
              />
            ))}
          </div>
        )}
      </section>

      {/* 4. Pengingat Tugas Terdekat */}
      {nextTask && (
        <section aria-labelledby="heading-tugas-mendesak">
          <div className="flex flex-col gap-3 rounded-[10px] border-[1px] border-stroke border-l-[3px] border-l-[#9A3412] bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#9A3412]">
                Tugas Terdekat
              </p>
              <h3 id="heading-tugas-mendesak" className="mt-1 break-words text-[15px] font-medium text-foreground">
                {nextTask.judul}
              </h3>
              <p className="mt-0.5 text-xs text-secondary">
                {nextTask.mata_kuliah || nextTask.kode || "-"}
                {nextTask.selesai
                  ? ` · Batas ${formatShortDate(parseDeadline(nextTask.selesai), nextTask.selesai)}`
                  : ""}
              </p>
            </div>

            <Link
              href="/dashboard/tugas"
              className="inline-flex min-h-[38px] shrink-0 items-center justify-center rounded-[6px] border-[1px] border-[#072033] bg-[#072033] px-4 text-xs font-medium text-white transition-colors hover:bg-white hover:text-[#072033]"
            >
              Buka Tugas
            </Link>
          </div>
        </section>
      )}

      {/* 5. Jadwal Ujian UTS / UAS Aktif */}
      {utsExams.data?.exams && utsExams.data.exams.length > 0 && (
        <section aria-labelledby="heading-ujian-terdekat">
          <div className="flex flex-col gap-3 rounded-[10px] border-[1px] border-stroke bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="min-w-0">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-[#0369A1]">
                Ujian Online (UTS) · {utsExams.data.exams.length} Mata Kuliah
              </p>
              <h3 id="heading-ujian-terdekat" className="mt-1 text-[15px] font-medium text-foreground">
                Ujian Tengah Semester Terjadwal
              </h3>
              <p className="mt-0.5 text-xs text-secondary">
                Terdekat mulai {utsExams.data.exams[0]?.tanggal_ujian?.split(" - ")[0] || "segera"}:{" "}
                <span className="text-foreground">{utsExams.data.exams[0]?.mata_kuliah}</span>
                {utsExams.data.exams[0]?.no_ruang ? ` (${utsExams.data.exams[0]?.no_ruang})` : ""}
              </p>
            </div>

            <Link
              href="/dashboard/ujian"
              className="inline-flex min-h-[38px] shrink-0 items-center justify-center rounded-[6px] border-[1px] border-stroke bg-white px-4 text-xs font-medium text-foreground transition-colors hover:border-[#072033]"
            >
              Lihat Jadwal Ujian
            </Link>
          </div>
        </section>
      )}

      {/* 6. Info Kampus Terdekat (Clean Monochrome Editorial Strip) */}
      {nearestAgenda && (() => {
        const tile = parseShortDateTile(nearestAgenda.tanggal_mulai_raw);
        return (
          <section aria-labelledby="heading-agenda-terdekat">
            <div className="flex flex-col gap-3.5 rounded-[10px] border-[1px] border-stroke bg-white p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex min-w-0 items-start gap-3.5">
                <div
                  className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-[8px] border-[1px] border-stroke bg-[#F7FAFC] text-center"
                  aria-hidden="true"
                >
                  <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-secondary">
                    {tile.month}
                  </span>
                  <span className="font-display text-base font-bold leading-none text-foreground tabular-nums">
                    {tile.day}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-secondary">
                    Info Kampus
                    {nearestAgenda.countdown ? (
                      <span className="text-[#0369A1]"> · {nearestAgenda.countdown}</span>
                    ) : null}
                  </p>
                  <h3
                    id="heading-agenda-terdekat"
                    className="mt-1 break-words text-[14.5px] font-medium leading-snug text-foreground sm:text-[15px]"
                  >
                    {nearestAgenda.nama}
                  </h3>
                  <p className="mt-0.5 font-mono text-[11px] text-secondary">
                    {nearestAgenda.tanggal_mulai_raw}
                    {nearestAgenda.tanggal_selesai_raw !== nearestAgenda.tanggal_mulai_raw
                      ? ` s.d. ${nearestAgenda.tanggal_selesai_raw}`
                      : ""}
                  </p>
                </div>
              </div>

              <Link
                href="/dashboard/agenda"
                className="inline-flex min-h-[38px] shrink-0 items-center justify-center rounded-[6px] border-[1px] border-stroke bg-white px-4 text-xs font-medium text-foreground transition-colors hover:border-[#072033]"
              >
                Buka Info Kampus
              </Link>
            </div>
          </section>
        );
      })()}

      {/* 7. Akses Cepat Layanan Kampus */}
      <section aria-labelledby="heading-layanan-cepat">
        <h2 id="heading-layanan-cepat" className="mb-3 text-base font-medium tracking-[-0.01em] text-foreground sm:text-lg">
          Layanan Kampus
        </h2>

        <div className="grid grid-cols-2 divide-x-[1px] divide-y-[1px] divide-stroke overflow-hidden rounded-[10px] border-[1px] border-stroke bg-white sm:grid-cols-3 lg:grid-cols-5 lg:divide-y-0">
          {[
            { href: "/dashboard/materi", title: "Bahan Ajar", desc: "Slide & Modul", icon: BookOpen },
            { href: "/dashboard/kuis", title: "Kuis Online", desc: "Jadwal & Latihan", icon: HelpCircle },
            { href: "/dashboard/nilai", title: "Nilai & KHS", desc: "Transkrip Nilai", icon: GraduationCap },
            { href: "/dashboard/ujian", title: "Kartu Ujian", desc: "Jadwal UTS & UAS", icon: Award },
            { href: "/dashboard/perpustakaan", title: "Perpustakaan", desc: "Katalog OPAC", icon: Library, span: true },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`group flex flex-col justify-between gap-2 p-4 text-left transition-colors hover:bg-[#FAFDFE] ${
                item.span ? "col-span-2 sm:col-span-1" : ""
              }`}
            >
              <item.icon
                className="h-4 w-4 text-secondary transition-colors group-hover:text-[#0369A1]"
                aria-hidden="true"
              />
              <div>
                <span className="block text-[13.5px] font-medium text-foreground">{item.title}</span>
                <span className="mt-0.5 block text-[11.5px] text-secondary">{item.desc}</span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
