"use client";

import { SiakadGateNotice, siakadGateIssue } from "@/components/SiakadGateNotice";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, CheckSquare, ChevronDown, Clock, MapPin, UserCheck } from "lucide-react";
import { useApi } from "@/lib/api";
import { findSubmission, formatShortDate, parseDeadline } from "@/lib/assignments";
import { DosenInfo } from "@/components/DosenInfo";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
} from "@/components/dashboard-ui";
import { describeRoom } from "@/lib/schedule";

interface ScheduleItem {
  id: string;
  kode: string;
  nama: string;
  hari: string;
  jam: string;
  sks: number;
  kelompok_praktek: string | null;
  ruang: string;
  kode_dosen: string;
}

interface AssignmentTask {
  id: string;
  kode?: string;
  mata_kuliah?: string;
  judul: string;
  pertemuan?: string;
  selesai?: string;
}

interface AssignmentsData {
  tasks?: AssignmentTask[];
  submissions?: { id?: string; judul: string; kode?: string; mata_kuliah?: string }[];
}

type ClassStatus = "live" | "next" | "done" | "upcoming";

const DAY_ORDER = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];
const JS_DAY_NAMES = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function parseRange(jam: string): [number, number] | null {
  const times = Array.from(jam?.matchAll(/(\d{1,2})[:.](\d{2})/g) ?? []).map(
    (m) => Number(m[1]) * 60 + Number(m[2])
  );
  if (times.length < 2) return null;
  return [times[0], times[1]];
}

const norm = (v?: string | null) => (v ?? "").trim().toLowerCase();

function sameDay(a?: string, b?: string) {
  return norm(a) === norm(b);
}

function taughtBy(schedule: ScheduleItem[], s: ScheduleItem) {
  const code = s.kode_dosen?.trim().toUpperCase();
  return code && code !== "-"
    ? schedule.filter((x) => x.kode_dosen?.trim().toUpperCase() === code)
    : [s];
}

function presensiHref(s: ScheduleItem) {
  const params = new URLSearchParams({ kode: s.kode ?? "", mk: s.nama ?? "" });
  return `/dashboard/presensi?${params.toString()}`;
}

function matchTasksForCourse(
  s: ScheduleItem,
  tasks: AssignmentTask[],
  submissions: NonNullable<AssignmentsData["submissions"]>
) {
  const sCode = norm(s.kode);
  const sName = norm(s.nama);
  return tasks
    .filter((t) => {
      const tCode = norm(t.kode);
      const tName = norm(t.mata_kuliah);
      return (sCode && tCode && sCode === tCode) || (sName && tName && (tName.includes(sName) || sName.includes(tName)));
    })
    .map((task) => ({
      task,
      done: Boolean(findSubmission(task, submissions)),
    }));
}

export default function JadwalPage() {
  const elearningApi = useApi<ScheduleItem[]>("/v1/elearning/courses");
  const assignmentsApi = useApi<AssignmentsData>("/v1/elearning/assignments", {
    persistMs: 6 * 60 * 60 * 1000,
    refreshMs: 5 * 60_000,
  });
  const [selectedDay, setSelectedDay] = useState<string>("Semua");
  const [openTasksFor, setOpenTasksFor] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const schedule = elearningApi.data ?? [];
  const tasksList = assignmentsApi.data?.tasks ?? [];
  const submissionsList = assignmentsApi.data?.submissions ?? [];
  const loading = elearningApi.loading && !elearningApi.data;
  const reload = () => elearningApi.reload();

  const today = now ? JS_DAY_NAMES[now.getDay()] : "";
  const minutesNow = now ? now.getHours() * 60 + now.getMinutes() : 0;

  const todayClasses = useMemo(() => {
    const items = schedule.filter((s) => sameDay(s.hari, today));
    return items.sort((a, b) => (parseRange(a.jam)?.[0] ?? 0) - (parseRange(b.jam)?.[0] ?? 0));
  }, [schedule, today]);

  const todayStatus = useMemo(() => {
    const result = new Map<string, ClassStatus>();
    let nextAssigned = false;
    for (const s of todayClasses) {
      const range = parseRange(s.jam);
      if (!range) continue;
      if (minutesNow >= range[0] && minutesNow < range[1]) result.set(s.id, "live");
      else if (minutesNow >= range[1]) result.set(s.id, "done");
      else if (!nextAssigned) {
        result.set(s.id, "next");
        nextAssigned = true;
      } else result.set(s.id, "upcoming");
    }
    return result;
  }, [todayClasses, minutesNow]);

  if (loading) return <LoadingState label="Memuat jadwal kuliah" />;

  if (schedule.length === 0) {
    if (elearningApi.error) {
      return siakadGateIssue(elearningApi.error) ? (
        <SiakadGateNotice kind={siakadGateIssue(elearningApi.error)!} />
      ) : (
        <ErrorState error={elearningApi.error} onRetry={reload} />
      );
    }
    return (
      <div>
        <PageHeader title="Jadwal Kuliah" />
        <EmptyState
          mascot="/maskot/mura-empty.png"
          title="Belum ada jadwal kuliah terdaftar."
          description="Jadwal diambil dari mata kuliah aktif di MyBest. Kalau kosong, cek kembali setelah kamu terdaftar di kelas."
        />
      </div>
    );
  }

  const groupedAll = DAY_ORDER.map((day) => ({
    day,
    items: schedule
      .filter((s) => sameDay(s.hari, day))
      .sort((a, b) => (parseRange(a.jam)?.[0] ?? 0) - (parseRange(b.jam)?.[0] ?? 0)),
  })).filter((g) => g.items.length > 0);

  const dayTabs = ["Semua", ...groupedAll.map((g) => g.day)];
  const visibleGroups =
    selectedDay === "Semua" ? groupedAll : groupedAll.filter((g) => g.day === selectedDay);

  const totalSks = schedule.reduce((sum, s) => sum + (s.sks || 0), 0);
  const totalPendingTasks = tasksList.filter((t) => !findSubmission(t, submissionsList)).length;

  return (
    <div className="min-w-0 space-y-4 sm:space-y-5">
      {/* Compact mobile header + summary */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:border-b-[1px] sm:border-stroke sm:pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.015em] text-foreground sm:text-[28px] sm:font-normal">
            Jadwal Kuliah
          </h1>
          <p className="mt-1 hidden text-[13.5px] text-secondary sm:block">
            Absen langsung atau cek tugas tiap mata kuliah dari jadwal mingguanmu.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-1.5 font-mono text-[11px]">
          <span className="rounded-[5px] border-[1px] border-stroke bg-white px-2.5 py-0.5 text-secondary">
            <strong className="font-semibold text-foreground">{schedule.length}</strong> matkul
          </span>
          <span className="rounded-[5px] border-[1px] border-stroke bg-white px-2.5 py-0.5 text-secondary">
            <strong className="font-semibold text-foreground">{totalSks}</strong> SKS
          </span>
          <span
            className={`rounded-[5px] border-[1px] border-stroke bg-white px-2.5 py-0.5 ${
              totalPendingTasks > 0 ? "text-[#9A3412]" : "text-secondary"
            }`}
          >
            <strong className="font-semibold text-foreground">{totalPendingTasks}</strong> tugas aktif
          </span>
        </div>
      </div>

      {/* Day filter bar: crisp sharp rectangular tabs */}
      <div
        className="scroll-slim flex gap-1.5 overflow-x-auto pb-0.5"
        role="tablist"
        aria-label="Filter hari kuliah"
      >
        {dayTabs.map((d) => {
          const count =
            d === "Semua"
              ? schedule.length
              : groupedAll.find((g) => g.day === d)?.items.length ?? 0;
          const active = selectedDay === d;
          const isToday = sameDay(d, today);
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSelectedDay(d)}
              className={`inline-flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[6px] border-[1px] px-3 text-xs font-medium transition-colors ${
                active
                  ? "border-[#072033] bg-[#072033] text-white"
                  : "border-stroke bg-white text-secondary hover:border-[#072033]/40 hover:text-foreground"
              }`}
            >
              {isToday && (
                <span
                  className={`h-1.5 w-1.5 rounded-[2px] ${
                    active ? "bg-sky-300" : "bg-[#0369A1]"
                  }`}
                  aria-hidden="true"
                />
              )}
              <span>{d}</span>
              <span
                className={`font-mono text-[10.5px] tabular-nums ${
                  active ? "text-white/75" : "text-secondary/70"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Day-grouped Timetable */}
      <div className="space-y-5">
        {visibleGroups.map(({ day, items }) => {
          const isToday = sameDay(day, today);
          const daySks = items.reduce((s, x) => s + (x.sks || 0), 0);

          return (
            <section key={day} aria-labelledby={`hari-${day}`}>
              <div className="mb-2 flex items-baseline justify-between gap-2 px-0.5">
                <div className="flex items-center gap-2">
                  <h2
                    id={`hari-${day}`}
                    className="font-home-display text-[15px] tracking-[0.01em] text-foreground"
                  >
                    {day}
                  </h2>
                  {isToday && (
                    <span className="rounded-[4px] bg-[#EAF3F9] px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.1em] text-[#0369A1]">
                      Hari ini
                    </span>
                  )}
                </div>
                <span className="font-mono text-[11px] text-secondary">
                  {items.length} kelas · {daySks} SKS
                </span>
              </div>

              <div className="divide-y-[1px] divide-stroke overflow-hidden rounded-[12px] border-[1px] border-stroke bg-white">
                {items.map((s) => {
                  const status = isToday ? todayStatus.get(s.id) : undefined;
                  const courseTasks = matchTasksForCourse(s, tasksList, submissionsList);
                  const pendingCount = courseTasks.filter((x) => !x.done).length;
                  const tasksOpen = openTasksFor === s.id;
                  const taught = taughtBy(schedule, s);
                  const roomLabel = describeRoom(s.ruang).label;
                  const shortRoomLabel = roomLabel.replace(/^Tatap muka\s*·\s*/i, "");

                  const statusLabel =
                    status === "live"
                      ? "Berlangsung"
                      : status === "next"
                        ? "Berikutnya"
                        : status === "done"
                          ? "Selesai"
                          : isToday
                            ? "Hari ini"
                            : "Terjadwal";

                  const statusChipClass =
                    status === "live"
                      ? "border-[#072033] bg-[#072033] text-white"
                      : status === "next"
                        ? "border-stroke bg-[#F0F7FB] text-[#0369A1]"
                        : "border-stroke bg-[#F7FAFC] text-secondary";

                  const railColor =
                    status === "live"
                      ? "lg:border-[#0F766E]"
                      : status === "next"
                        ? "lg:border-[#9A3412]"
                        : "lg:border-[#0369A1]/40";

                  return (
                    <article key={s.id} className="transition-colors hover:bg-[#FAFDFE]">
                      <div className="flex flex-col gap-3 p-3.5 sm:p-4 lg:flex-row lg:items-center lg:gap-6 lg:p-5">
                        {/* Mobile top row: single-line time chip + status pill */}
                        <div className="flex items-center justify-between gap-2 lg:hidden">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-[6px] bg-[#F0F7FB] px-2 py-0.5 font-mono text-[11.5px] font-semibold text-[#0369A1]">
                            <Clock className="h-3 w-3 shrink-0" aria-hidden="true" />
                            {s.jam || "-"}
                          </span>
                          <span
                            className={`rounded-[4px] border-[1px] px-2 py-0.5 font-mono text-[10.5px] font-medium ${statusChipClass}`}
                          >
                            {statusLabel}
                          </span>
                        </div>

                        {/* Desktop left time & room column */}
                        <div className="hidden shrink-0 lg:flex lg:w-36 lg:flex-col lg:items-start lg:gap-1">
                          <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-xs font-medium text-foreground">
                            <Clock className="h-3.5 w-3.5 shrink-0 text-[#0369A1]" aria-hidden="true" />
                            {s.jam || "-"}
                          </span>
                          <span
                            className="inline-flex items-center gap-1 text-xs text-secondary"
                            title={s.ruang ? `Kode ruang: ${s.ruang}` : undefined}
                          >
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {roomLabel}
                          </span>
                        </div>

                        {/* Course info */}
                        <div className={`min-w-0 flex-1 lg:border-l-[2px] lg:pl-3.5 ${railColor}`}>
                          <div className="hidden flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px] lg:flex">
                            <span className="text-[#0369A1]">
                              {s.kode} · {s.sks} SKS
                            </span>
                            <span className="text-secondary/45" aria-hidden="true">
                              ·
                            </span>
                            <span
                              className={`font-sans text-[11.5px] ${
                                status === "live"
                                  ? "text-[#0F766E]"
                                  : status === "next"
                                    ? "text-[#9A3412]"
                                    : "text-secondary"
                              }`}
                            >
                              {statusLabel}
                            </span>
                          </div>

                          <h3 className="break-words text-[15px] font-semibold leading-snug text-foreground lg:mt-1 lg:font-normal">
                            {s.nama}
                            {s.kelompok_praktek && (
                              <span className="ml-1.5 font-mono text-[11px] font-normal text-secondary">
                                Kel. {s.kelompok_praktek}
                              </span>
                            )}
                          </h3>

                          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-secondary lg:mt-0.5">
                            <span
                              className="inline-flex items-center gap-1 lg:hidden"
                              title={s.ruang ? `Kode ruang: ${s.ruang}` : undefined}
                            >
                              <MapPin className="h-3 w-3 shrink-0 text-[#0369A1]" aria-hidden="true" />
                              <span>{shortRoomLabel}</span>
                            </span>
                            <span className="text-secondary/40 lg:hidden" aria-hidden="true">
                              ·
                            </span>
                            <span className="font-mono text-[11px] lg:hidden">{s.sks} SKS</span>
                            <span className="text-secondary/40 lg:hidden" aria-hidden="true">
                              ·
                            </span>
                            <DosenInfo
                              kode={s.kode_dosen}
                              courses={taught.map((t) => ({
                                nama: t.nama,
                                hari: t.hari,
                                jam: t.jam,
                              }))}
                            />
                          </div>
                        </div>

                        {/* Actions: balanced 1-tap row on mobile, compact inline on desktop */}
                        <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 pt-0.5 lg:flex lg:shrink-0 lg:pt-0">
                          <Link
                            href={presensiHref(s)}
                            className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[8px] border-[1px] px-3 text-xs font-medium transition-colors duration-200 lg:min-h-[38px] lg:rounded-[6px] lg:px-3.5 ${
                              status === "live" || status === "next"
                                ? "border-[#072033] bg-[#072033] text-white hover:bg-white hover:text-[#072033]"
                                : "border-stroke bg-[#F7FAFC] text-foreground hover:border-[#072033] hover:bg-white lg:bg-white"
                            }`}
                          >
                            <UserCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span>Absen</span>
                          </Link>

                          <button
                            type="button"
                            onClick={() => setOpenTasksFor(tasksOpen ? null : s.id)}
                            aria-expanded={tasksOpen}
                            className={`inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-[8px] border-[1px] px-3 text-xs font-medium transition-colors lg:min-h-[38px] lg:rounded-[6px] ${
                              tasksOpen
                                ? "border-[#0369A1] bg-[#E6F2FA] text-[#072033]"
                                : pendingCount > 0
                                  ? "border-[#FDBA74] bg-[#FFF7ED] text-[#9A3412] hover:border-[#9A3412]"
                                  : "border-stroke bg-white text-secondary hover:border-[#072033] hover:text-foreground"
                            }`}
                          >
                            <CheckSquare className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            <span className="whitespace-nowrap">
                              {pendingCount > 0
                                ? `${pendingCount} Tugas`
                                : courseTasks.length > 0
                                  ? `Tugas (${courseTasks.length})`
                                  : "Tugas"}
                            </span>
                            <ChevronDown
                              className={`h-3.5 w-3.5 shrink-0 transition-transform duration-200 ${
                                tasksOpen ? "rotate-180" : ""
                              }`}
                              aria-hidden="true"
                            />
                          </button>

                          <Link
                            href="/dashboard/materi"
                            title="Buka Bahan Ajar"
                            aria-label={`Bahan ajar ${s.nama}`}
                            className="inline-flex h-[40px] w-[40px] items-center justify-center rounded-[8px] border-[1px] border-stroke bg-white text-secondary transition-colors hover:border-[#072033] hover:text-foreground lg:h-[38px] lg:w-[38px] lg:rounded-[6px]"
                          >
                            <BookOpen className="h-4 w-4 lg:h-3.5 lg:w-3.5" aria-hidden="true" />
                          </Link>
                        </div>
                      </div>

                      {/* Smooth Inline Expandable Tugas Panel */}
                      <div
                        className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out ${
                          tasksOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="border-t-[1px] border-stroke bg-[#F7FAFC] px-4 py-3.5 sm:px-5">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-secondary">
                                Tugas {s.nama}
                              </span>
                              <Link
                                href="/dashboard/tugas"
                                className="text-xs text-[#0369A1] underline underline-offset-4 hover:text-[#072033]"
                              >
                                Buka halaman tugas
                              </Link>
                            </div>

                            {assignmentsApi.loading && !assignmentsApi.data ? (
                              <p className="text-xs text-secondary">Memuat daftar tugas...</p>
                            ) : courseTasks.length === 0 ? (
                              <p className="text-xs text-secondary">
                                Belum ada tugas aktif untuk mata kuliah ini.
                              </p>
                            ) : (
                              <ul className="divide-y-[1px] divide-stroke rounded-[8px] border-[1px] border-stroke bg-white">
                                {courseTasks.map(({ task, done }) => (
                                  <li
                                    key={task.id}
                                    className="flex flex-col gap-2.5 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                                  >
                                    <div className="min-w-0">
                                      <p className="font-mono text-[10.5px] text-secondary">
                                        {task.pertemuan ? `Pertemuan ${task.pertemuan} · ` : ""}
                                        <span className={done ? "text-[#0F766E]" : "text-[#9A3412]"}>
                                          {done
                                            ? "Terkumpul"
                                            : task.selesai
                                              ? `Deadline ${formatShortDate(parseDeadline(task.selesai), task.selesai)}`
                                              : "Menunggu dikumpulkan"}
                                        </span>
                                      </p>
                                      <p className="mt-0.5 text-[13.5px] text-foreground">
                                        {task.judul}
                                      </p>
                                    </div>
                                    <Link
                                      href="/dashboard/tugas"
                                      className="inline-flex min-h-[34px] shrink-0 items-center justify-center rounded-[6px] border-[1px] border-[#072033] bg-[#072033] px-3 text-xs font-medium text-white transition-colors duration-200 hover:bg-white hover:text-[#072033]"
                                    >
                                      {done ? "Lihat" : "Kumpulkan"}
                                    </Link>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
