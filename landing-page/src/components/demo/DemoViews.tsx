"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  Copy,
  KeyRound,
  MapPin,
  Plus,
  Search,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard-ui";
import {
  DEMO_AGENDA,
  DEMO_BERITA,
  DEMO_BOOKS,
  DEMO_DISCUSSIONS,
  DEMO_KHS_SEMESTERS,
  DEMO_MATERI,
  DEMO_PENGGANTI,
  DEMO_QUIZ_QUESTIONS,
  DEMO_SCHEDULE,
  DEMO_STUDENT,
  DEMO_TASKS,
  DEMO_UTS_EXAMS,
} from "@/data/demo-data";

function underlineTabClass(active: boolean) {
  return `-mb-[1px] inline-flex min-h-[44px] shrink-0 items-center border-b-[2px] px-1 text-[13px] transition-colors ${
    active
      ? "border-[#072033] text-foreground"
      : "border-transparent text-secondary hover:text-foreground"
  }`;
}

export { DemoKomunitasView } from "./DemoKomunitasView";

export function DemoJadwalView({
  taskDoneMap,
  onToggleTask,
  secondClassPresent,
  onToggleSecondClass,
  onNavigate,
}: {
  taskDoneMap?: Record<string, boolean>;
  onToggleTask?: (id: string) => void;
  secondClassPresent?: boolean;
  onToggleSecondClass?: () => void;
  onNavigate?: (view: "tugas" | "presensi" | "materi") => void;
} = {}) {
  const days = ["Semua", "Senin", "Selasa", "Rabu", "Kamis", "Jumat"] as const;
  const todayDay = "Selasa";
  const [day, setDay] = useState<(typeof days)[number]>("Semua");
  const [openTasksFor, setOpenTasksFor] = useState<string | null>("inf201");
  const [extraPresent, setExtraPresent] = useState<Record<string, boolean>>({ inf101: true });

  const isPresent = (id: string) =>
    id === "inf201" ? Boolean(secondClassPresent) : Boolean(extraPresent[id]);

  const togglePresent = (id: string) => {
    if (id === "inf201" && onToggleSecondClass) {
      onToggleSecondClass();
      return;
    }
    setExtraPresent((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const totalSks = DEMO_SCHEDULE.reduce((sum, item) => sum + item.sks, 0);
  const totalPendingTasks = DEMO_TASKS.filter((t) => !taskDoneMap?.[t.id]).length;

  const visibleDays =
    day === "Semua"
      ? (["Senin", "Selasa", "Rabu", "Kamis", "Jumat"] as const).filter((d) =>
          DEMO_SCHEDULE.some((item) => item.hari === d)
        )
      : [day];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Jadwal Kuliah"
          description="Absen langsung atau cek tugas tiap mata kuliah dari jadwal mingguanmu."
        />
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-secondary">
          <span>
            <strong className="font-display text-sm font-semibold text-foreground">
              {DEMO_SCHEDULE.length}
            </strong>{" "}
            matkul
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <strong className="font-display text-sm font-semibold text-foreground">
              {totalSks}
            </strong>{" "}
            SKS
          </span>
          <span aria-hidden="true">·</span>
          <span className={totalPendingTasks > 0 ? "text-[#9A3412]" : "text-[#0F766E]"}>
            <strong className="font-display text-sm font-semibold">{totalPendingTasks}</strong>{" "}
            tugas aktif
          </span>
        </div>
      </div>

      {/* Day filter bar with per-day counts & Today dot */}
      <div
        className="flex gap-5 overflow-x-auto border-b-[1px] border-stroke"
        role="tablist"
        aria-label="Filter hari"
      >
        {days.map((d) => {
          const count =
            d === "Semua"
              ? DEMO_SCHEDULE.length
              : DEMO_SCHEDULE.filter((item) => item.hari === d).length;
          const isToday = d === todayDay;
          return (
            <button
              key={d}
              type="button"
              role="tab"
              aria-selected={day === d}
              onClick={() => setDay(d)}
              className={`${underlineTabClass(day === d)} gap-1.5`}
            >
              {isToday && (
                <span className="h-1.5 w-1.5 rounded-[9999px] bg-[#0369A1]" aria-hidden="true" />
              )}
              <span>{d}</span>
              <span className="font-mono text-[10.5px] text-secondary/75">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Day-grouped Architectural Timetable Ledger */}
      <div className="space-y-6">
        {visibleDays.map((dayName) => {
          const items = DEMO_SCHEDULE.filter((item) => item.hari === dayName);
          const daySks = items.reduce((s, x) => s + x.sks, 0);
          const isToday = dayName === todayDay;

          return (
            <section key={dayName} aria-labelledby={`demo-day-${dayName}`}>
              <div className="mb-2.5 flex items-baseline justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <h2
                    id={`demo-day-${dayName}`}
                    className="font-home-display text-[15px] tracking-[0.01em] text-foreground"
                  >
                    {dayName}
                  </h2>
                  {isToday && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#0369A1]">
                      Hari ini
                    </span>
                  )}
                </div>
                <span className="font-mono text-[11px] text-secondary">
                  {items.length} kelas · {daySks} SKS
                </span>
              </div>

              <div className="divide-y-[1px] divide-stroke overflow-hidden rounded-[10px] border-[1px] border-stroke bg-white">
                {items.map((item) => {
                  const present = isPresent(item.id);
                  const courseTasks = DEMO_TASKS.filter((t) => t.kode === item.kode);
                  const pendingCount = courseTasks.filter((t) => !taskDoneMap?.[t.id]).length;
                  const tasksOpen = openTasksFor === item.id;
                  const railColor = present
                    ? "border-[#0F766E]"
                    : isToday
                      ? "border-[#9A3412]"
                      : "border-[#0369A1]/40";

                  return (
                    <article key={item.id} className="transition-colors hover:bg-[#FAFDFE]">
                      <div className="flex flex-col gap-3.5 p-4 sm:p-5 lg:flex-row lg:items-center lg:gap-6">
                        {/* Left: Time & Room block */}
                        <div className="flex shrink-0 items-center justify-between gap-3 lg:w-36 lg:flex-col lg:items-start lg:gap-1">
                          <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-foreground">
                            <Clock className="h-3.5 w-3.5 text-[#0369A1]" aria-hidden="true" />
                            {item.jam}
                          </span>
                          <span className="inline-flex items-center gap-1 text-xs text-secondary">
                            <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {item.ruang}
                          </span>
                        </div>

                        {/* Middle: Course Identity with left status rail */}
                        <div className={`min-w-0 flex-1 border-l-[2px] pl-3.5 ${railColor}`}>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[11px]">
                            <span className="text-[#0369A1]">
                              {item.kode} · {item.sks} SKS
                            </span>
                            <span className="text-secondary/45" aria-hidden="true">
                              ·
                            </span>
                            <span
                              className={`font-sans text-[11.5px] ${
                                present
                                  ? "text-[#0F766E]"
                                  : isToday
                                    ? "text-[#9A3412]"
                                    : "text-secondary"
                              }`}
                            >
                              {present ? "Presensi tercatat" : isToday ? "Belum absen" : "Terjadwal"}
                            </span>
                          </div>
                          <h3 className="mt-1 text-[15.5px] leading-snug text-foreground">
                            {item.nama}
                          </h3>
                          <p className="mt-0.5 text-xs text-secondary">{item.dosen}</p>
                        </div>

                        {/* Right: Direct Actions (Absen + Inline Tugas + Materi) */}
                        <div className="flex flex-wrap items-center gap-2 lg:shrink-0">
                          <button
                            type="button"
                            onClick={() => togglePresent(item.id)}
                            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-[6px] border-[1px] px-3.5 text-xs font-medium transition-colors duration-200 ${
                              present
                                ? "border-[#0F766E]/35 bg-[#F0FDF9] text-[#0F766E] hover:border-[#0F766E]"
                                : isToday
                                  ? "border-[#072033] bg-[#072033] text-white hover:bg-white hover:text-[#072033]"
                                  : "border-stroke bg-white text-foreground hover:border-[#072033]"
                            }`}
                          >
                            {present ? (
                              <>
                                <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                                <span>Hadir</span>
                              </>
                            ) : (
                              <>
                                <UserCheck className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Absen</span>
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => setOpenTasksFor(tasksOpen ? null : item.id)}
                            aria-expanded={tasksOpen}
                            className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-[6px] border-[1px] px-3 text-xs transition-colors ${
                              tasksOpen
                                ? "border-[#0369A1] bg-[#E6F2FA] text-[#072033]"
                                : pendingCount > 0
                                  ? "border-[#FDBA74] bg-[#FFF7ED] text-[#9A3412] hover:border-[#9A3412]"
                                  : "border-stroke bg-white text-secondary hover:border-[#072033] hover:text-foreground"
                            }`}
                          >
                            <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>
                              {pendingCount > 0
                                ? `${pendingCount} Tugas`
                                : courseTasks.length > 0
                                  ? `Tugas (${courseTasks.length})`
                                  : "Tugas"}
                            </span>
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform duration-200 ${
                                tasksOpen ? "rotate-180" : ""
                              }`}
                              aria-hidden="true"
                            />
                          </button>

                          {onNavigate && (
                            <button
                              type="button"
                              onClick={() => onNavigate("materi")}
                              title="Buka Bahan Ajar"
                              aria-label={`Bahan ajar ${item.nama}`}
                              className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-[6px] border-[1px] border-stroke bg-white text-secondary transition-colors hover:border-[#072033] hover:text-foreground"
                            >
                              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
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
                                Tugas {item.nama}
                              </span>
                              {onNavigate && (
                                <button
                                  type="button"
                                  onClick={() => onNavigate("tugas")}
                                  className="text-xs text-[#0369A1] underline underline-offset-4 hover:text-[#072033]"
                                >
                                  Buka halaman tugas
                                </button>
                              )}
                            </div>

                            {courseTasks.length === 0 ? (
                              <p className="text-xs text-secondary">
                                Belum ada tugas aktif untuk mata kuliah ini.
                              </p>
                            ) : (
                              <ul className="divide-y-[1px] divide-stroke rounded-[8px] border-[1px] border-stroke bg-white">
                                {courseTasks.map((task) => {
                                  const done = Boolean(taskDoneMap?.[task.id]);
                                  return (
                                    <li
                                      key={task.id}
                                      className="flex flex-col gap-2.5 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                      <div className="min-w-0">
                                        <p className="font-mono text-[10.5px] text-secondary">
                                          Pertemuan {task.pertemuan} ·{" "}
                                          <span className={done ? "text-[#0F766E]" : "text-[#9A3412]"}>
                                            {done ? "Terkumpul" : `Deadline ${task.deadline}`}
                                          </span>
                                        </p>
                                        <p className="mt-0.5 text-[13.5px] text-foreground">
                                          {task.judul}
                                        </p>
                                      </div>
                                      {onToggleTask && (
                                        <button
                                          type="button"
                                          onClick={() => onToggleTask(task.id)}
                                          className={`inline-flex min-h-[34px] shrink-0 items-center justify-center rounded-[6px] border-[1px] px-3 text-xs font-medium transition-colors duration-200 ${
                                            done
                                              ? "border-stroke bg-white text-secondary hover:border-[#072033] hover:text-foreground"
                                              : "border-[#072033] bg-[#072033] text-white hover:bg-white hover:text-[#072033]"
                                          }`}
                                        >
                                          {done ? "Batalkan" : "Tandai Selesai"}
                                        </button>
                                      )}
                                    </li>
                                  );
                                })}
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

export function DemoTugasView({
  taskDoneMap,
  onToggleTask,
}: {
  taskDoneMap: Record<string, boolean>;
  onToggleTask: (id: string) => void;
}) {
  const [filter, setFilter] = useState<"semua" | "belum" | "selesai">("semua");
  const doneCount = DEMO_TASKS.filter((t) => Boolean(taskDoneMap[t.id])).length;
  const pendingCount = DEMO_TASKS.length - doneCount;

  const list = DEMO_TASKS.filter((t) => {
    const done = Boolean(taskDoneMap[t.id]);
    if (filter === "belum") return !done;
    if (filter === "selesai") return done;
    return true;
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tugas & Deadline"
        description="Status pengumpulan di sini langsung tersinkron dengan ringkasan."
      />

      <div
        className="flex gap-5 overflow-x-auto border-b-[1px] border-stroke"
        role="tablist"
        aria-label="Filter status tugas"
      >
        {(
          [
            { id: "semua", label: `Semua (${DEMO_TASKS.length})` },
            { id: "belum", label: `Menunggu (${pendingCount})` },
            { id: "selesai", label: `Terkumpul (${doneCount})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={filter === tab.id}
            onClick={() => setFilter(tab.id)}
            className={underlineTabClass(filter === tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="rounded-[10px] border-[1px] border-stroke bg-white p-8 text-center text-sm text-secondary">
          Tidak ada tugas pada kategori ini.
        </div>
      ) : (
        <div className="divide-y-[1px] divide-stroke rounded-[10px] border-[1px] border-stroke bg-white">
          {list.map((task) => {
            const done = Boolean(taskDoneMap[task.id]);
            return (
              <div
                key={task.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="font-mono text-[11px] tracking-[0.04em] text-[#0369A1]">
                      {task.kode} · P{task.pertemuan}
                    </span>
                    <span className="text-secondary/50" aria-hidden="true">
                      ·
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs ${
                        done ? "text-[#0F766E]" : "text-[#9A3412]"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-[2px] ${
                          done ? "bg-[#0F766E]" : "bg-[#9A3412]"
                        }`}
                        aria-hidden="true"
                      />
                      {done ? "Terkumpul" : task.deadline}
                    </span>
                  </div>
                  <h2 className="mt-1.5 text-[15px] text-foreground">{task.judul}</h2>
                  <p className="mt-0.5 text-xs text-secondary">{task.matkul}</p>
                </div>

                {done ? (
                  <button
                    type="button"
                    onClick={() => onToggleTask(task.id)}
                    className="inline-flex min-h-[40px] shrink-0 items-center justify-start gap-1.5 text-xs text-secondary underline decoration-stroke underline-offset-4 transition-colors hover:text-foreground sm:justify-end"
                  >
                    <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Batalkan Kumpul</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onToggleTask(task.id)}
                    className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-[6px] bg-[#072033] px-4 text-xs text-white transition-colors hover:bg-[#0369A1]"
                  >
                    <CheckSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Kumpulkan Tugas</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DemoPresensiView({
  secondClassPresent,
  onToggleSecondClass,
}: {
  secondClassPresent: boolean;
  onToggleSecondClass: () => void;
}) {
  const records = [
    { kode: "INF101", matkul: "Pemrograman Web", hadir: 7, total: 7, status: "Tercatat" },
    {
      kode: "INF201",
      matkul: "Basis Data Lanjut",
      hadir: secondClassPresent ? 7 : 6,
      total: 7,
      status: secondClassPresent ? "Tercatat" : "Sesi dibuka",
      interactive: true,
    },
    { kode: "INF204", matkul: "Struktur Data & Algoritma", hadir: 6, total: 6, status: "Tercatat" },
    { kode: "INF208", matkul: "Jaringan Komputer", hadir: 6, total: 6, status: "Tercatat" },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Presensi Kehadiran"
        description="Rekap kehadiran pertemuan dan absen sekali ketuk."
      />

      <div className="grid gap-3 md:grid-cols-2">
        {records.map((rec) => {
          const pct = Math.round((rec.hadir / rec.total) * 100);
          return (
            <div
              key={rec.kode}
              className="flex flex-col justify-between gap-4 rounded-[10px] border-[1px] border-stroke bg-white p-5"
            >
              <div>
                <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                  <span className="text-[#0369A1]">{rec.kode}</span>
                  <span className="text-secondary">
                    {rec.hadir}/{rec.total} Pertemuan ({pct}%)
                  </span>
                </div>
                <h2 className="mt-2 text-[15.5px] text-foreground">{rec.matkul}</h2>
                <div className="mt-3 h-[3px] w-full overflow-hidden rounded-[2px] bg-surface-alt">
                  <div
                    className="h-full rounded-[2px] bg-[#0369A1] transition-all duration-300"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {rec.interactive ? (
                <button
                  type="button"
                  onClick={onToggleSecondClass}
                  className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-[6px] px-4 text-xs transition-colors ${
                    secondClassPresent
                      ? "border-[1px] border-stroke bg-white text-secondary hover:border-[#072033] hover:text-foreground"
                      : "bg-[#0F766E] text-white hover:bg-[#0D625B]"
                  }`}
                >
                  <UserCheck className="h-4 w-4" aria-hidden="true" />
                  <span>{secondClassPresent ? "Batalkan Presensi" : "Absen Sekarang"}</span>
                </button>
              ) : (
                <div className="inline-flex min-h-[36px] items-center gap-1.5 text-xs text-[#0F766E]">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{rec.status}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DemoPenggantiView() {
  return (
    <div className="space-y-5">
      <PageHeader title="Kuliah Pengganti" description="Perubahan ruang dan jadwal kelas pengganti." />
      <div className="divide-y-[1px] divide-stroke rounded-[10px] border-[1px] border-stroke bg-white">
        {DEMO_PENGGANTI.map((item) => (
          <div key={item.id} className="p-5">
            <span className="font-mono text-[11px] tracking-[0.04em] text-[#0369A1]">
              {item.kode}
            </span>
            <h2 className="mt-1.5 text-[15.5px] text-foreground">{item.matkul}</h2>
            <p className="mt-1 text-xs text-secondary">Jadwal asal: {item.tanggalAsli}</p>
            <p className="mt-1 font-mono text-xs text-foreground">
              Pengganti: {item.jadwalPengganti} · {item.ruang}
            </p>
            <p className="mt-1.5 text-xs text-secondary">Catatan: {item.alasan}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DemoMateriView() {
  const [courseFilter, setCourseFilter] = useState("Semua");
  const [previewItem, setPreviewItem] = useState<(typeof DEMO_MATERI)[number] | null>(null);

  useEffect(() => {
    if (!previewItem) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPreviewItem(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [previewItem]);

  const list =
    courseFilter === "Semua"
      ? DEMO_MATERI
      : DEMO_MATERI.filter((m) => m.kode === courseFilter);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bahan Ajar & Modul"
        description="Slide, modul praktikum, silabus, RPS, dan RTM dari dosen pengampu."
      />

      <div
        className="flex gap-5 overflow-x-auto border-b-[1px] border-stroke"
        role="tablist"
        aria-label="Filter mata kuliah"
      >
        {["Semua", "INF101", "INF201", "INF204"].map((code) => (
          <button
            key={code}
            type="button"
            role="tab"
            aria-selected={courseFilter === code}
            onClick={() => setCourseFilter(code)}
            className={`${underlineTabClass(courseFilter === code)} font-mono`}
          >
            {code}
          </button>
        ))}
      </div>

      <div className="divide-y-[1px] divide-stroke rounded-[10px] border-[1px] border-stroke bg-white">
        {list.map((m) => (
          <div
            key={m.id}
            className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <span className="font-mono text-[11px] text-[#0369A1]">
                {m.kode} · {m.pertemuan}
              </span>
              <h2 className="mt-1 text-[15.5px] text-foreground">{m.topik}</h2>
              <p className="mt-1 text-xs text-secondary">{m.matkul}</p>
              <p className="mt-2 font-mono text-[11px] text-secondary">{m.paket.join(" · ")}</p>
            </div>
            <button
              type="button"
              onClick={() => setPreviewItem(m)}
              className="inline-flex min-h-[40px] shrink-0 items-center justify-center gap-1.5 rounded-[6px] border-[1px] border-stroke bg-white px-4 text-xs text-foreground transition-colors hover:border-[#072033]"
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Pratinjau Materi</span>
            </button>
          </div>
        ))}
      </div>

      {previewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#072033]/55 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Pratinjau bahan ajar"
        >
          <div className="w-full max-w-md rounded-[10px] border-[1px] border-stroke bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-[#0369A1]">
                  {previewItem.kode} · {previewItem.pertemuan}
                </p>
                <h3 className="mt-1 text-lg text-foreground">{previewItem.topik}</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                aria-label="Tutup pratinjau"
                className="flex h-10 w-10 items-center justify-center rounded-[6px] text-secondary hover:bg-surface-alt hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-secondary">
              {previewItem.ringkasan}
            </p>
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewItem(null)}
                className="min-h-[40px] rounded-[6px] bg-[#072033] px-5 text-xs text-white hover:bg-[#0369A1]"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function DemoKuisView() {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const correctCount = DEMO_QUIZ_QUESTIONS.filter((q) => answers[q.id] === q.answer).length;
  const score = Math.round((correctCount / DEMO_QUIZ_QUESTIONS.length) * 100);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Kuis Perkuliahan"
        description="Latihan interaktif kuis Informatika sebelum sesi ujian berlangsung."
      />

      <div className="space-y-4">
        {DEMO_QUIZ_QUESTIONS.map((q, idx) => (
          <fieldset
            key={q.id}
            className="rounded-[10px] border-[1px] border-stroke bg-white p-5"
          >
            <legend className="px-1 font-mono text-xs text-[#0369A1]">Soal 0{idx + 1}</legend>
            <p className="mt-1 text-[14.5px] leading-relaxed text-foreground">{q.prompt}</p>
            <div className="mt-3 space-y-2">
              {q.options.map((opt, oIdx) => {
                const selected = answers[q.id] === oIdx;
                const isRight = submitted && q.answer === oIdx;
                const isWrong = submitted && selected && q.answer !== oIdx;
                return (
                  <label
                    key={opt}
                    className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-[6px] border-[1px] px-3.5 py-2 text-[13px] transition-colors ${
                      isRight
                        ? "border-[#0F766E] bg-[#0F766E]/10 text-[#0F766E]"
                        : isWrong
                          ? "border-[#BE123C] bg-[#FFF1F2] text-[#BE123C]"
                          : selected
                            ? "border-[#0369A1] bg-[#F0F7FB] text-foreground"
                            : "border-stroke bg-white text-secondary hover:border-[#0369A1]/45"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      checked={selected}
                      disabled={submitted}
                      onChange={() => setAnswers((p) => ({ ...p, [q.id]: oIdx }))}
                      className="accent-[#0369A1]"
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border-[1px] border-stroke bg-white p-5">
        {submitted ? (
          <>
            <div>
              <p className="font-mono text-xs text-[#0369A1]">Hasil Latihan</p>
              <p className="mt-0.5 text-lg text-foreground">
                Skor {score}/100 ({correctCount} dari {DEMO_QUIZ_QUESTIONS.length} benar)
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAnswers({});
                setSubmitted(false);
              }}
              className="min-h-[42px] rounded-[6px] border-[1px] border-stroke bg-white px-5 text-xs text-foreground hover:border-[#072033]"
            >
              Ulangi Latihan
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-secondary">
              Terjawab {Object.keys(answers).length} dari {DEMO_QUIZ_QUESTIONS.length} soal.
            </p>
            <button
              type="button"
              onClick={() => setSubmitted(true)}
              className="min-h-[42px] rounded-[6px] bg-[#072033] px-5 text-xs text-white transition-colors hover:bg-[#0369A1]"
            >
              Periksa Jawaban
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export function DemoDiskusiView() {
  const [threads, setThreads] = useState(DEMO_DISCUSSIONS);
  const [replyMap, setReplyMap] = useState<Record<string, string>>({});

  function sendReply(id: string, e: React.FormEvent) {
    e.preventDefault();
    const text = (replyMap[id] ?? "").trim();
    if (!text) return;
    setThreads((prev) =>
      prev.map((t) =>
        t.id === id
          ? { ...t, replies: [...t.replies, { author: DEMO_STUDENT.panggilan, text }] }
          : t
      )
    );
    setReplyMap((p) => ({ ...p, [id]: "" }));
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Forum Diskusi" description="Diskusi resmi mata kuliah bersama dosen." />
      <div className="divide-y-[1px] divide-stroke rounded-[10px] border-[1px] border-stroke bg-white">
        {threads.map((t) => (
          <div key={t.id} className="p-5">
            <span className="font-mono text-xs text-[#0369A1]">{t.matkul}</span>
            <h2 className="mt-1 text-[16px] text-foreground">{t.title}</h2>
            <p className="mt-1 text-xs text-secondary">Oleh {t.author}</p>
            <p className="mt-3 text-[13.5px] leading-relaxed text-foreground">{t.body}</p>

            <div className="mt-4 space-y-2 border-t-[1px] border-stroke pt-3">
              {t.replies.map((r, i) => (
                <p key={i} className="rounded-[6px] bg-surface-alt px-3 py-2 text-xs text-secondary">
                  <strong className="text-foreground">{r.author}:</strong> {r.text}
                </p>
              ))}
              <form onSubmit={(e) => sendReply(t.id, e)} className="mt-2 flex gap-2">
                <input
                  type="text"
                  value={replyMap[t.id] ?? ""}
                  onChange={(e) => setReplyMap((p) => ({ ...p, [t.id]: e.target.value }))}
                  placeholder="Tulis tanggapan..."
                  aria-label={`Tulis tanggapan untuk ${t.title}`}
                  className="px-input min-h-[42px] flex-1 px-3 text-sm"
                />
                <button
                  type="submit"
                  className="min-h-[42px] rounded-[6px] bg-[#072033] px-4 text-xs text-white hover:bg-[#0369A1]"
                >
                  Kirim
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DemoNilaiView() {
  const [sem, setSem] = useState<"1" | "2" | "3">("3");
  const current = DEMO_KHS_SEMESTERS[sem];

  return (
    <div className="space-y-5">
      <PageHeader title="Nilai & KHS" description="Rekap nilai semester dan indeks prestasi kumulatif." />

      <div className="flex flex-wrap items-end justify-between gap-3 border-b-[1px] border-stroke">
        <div className="flex gap-5" role="tablist" aria-label="Pilih semester">
          {(["1", "2", "3"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={sem === s}
              onClick={() => setSem(s)}
              className={underlineTabClass(sem === s)}
            >
              Semester {s}
            </button>
          ))}
        </div>
        <p className="pb-2.5 font-mono text-xs text-foreground">
          IPS {current.ips} · {current.sks} SKS · IPK 3.85
        </p>
      </div>

      <div className="overflow-hidden rounded-[10px] border-[1px] border-stroke bg-white">
        <table className="px-table w-full text-left text-sm">
          <thead className="border-b-[1px] border-stroke bg-surface-alt font-mono text-xs text-secondary">
            <tr>
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Mata Kuliah</th>
              <th className="px-4 py-3">SKS</th>
              <th className="px-4 py-3">Nilai</th>
              <th className="px-4 py-3">Mutu</th>
            </tr>
          </thead>
          <tbody className="divide-y-[1px] divide-stroke">
            {current.courses.map((c) => (
              <tr key={c.kode}>
                <td data-label="Kode" className="px-4 py-3 font-mono text-xs text-[#0369A1]">
                  {c.kode}
                </td>
                <td data-label="Mata Kuliah" data-primary="true" className="px-4 py-3 text-foreground">
                  {c.nama}
                </td>
                <td data-label="SKS" className="px-4 py-3 font-mono text-xs text-secondary">
                  {c.sks}
                </td>
                <td data-label="Nilai" className="px-4 py-3 font-mono text-xs text-[#0F766E]">
                  {c.nilai}
                </td>
                <td data-label="Mutu" className="px-4 py-3 font-mono text-xs text-foreground">
                  {c.mutu}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DemoKrsView() {
  const totalSks = DEMO_SCHEDULE.reduce((sum, c) => sum + c.sks, 0);
  return (
    <div className="space-y-5">
      <PageHeader
        title="Kartu Rencana Studi (KRS)"
        description={`Semester ${DEMO_STUDENT.semester} · Total ${totalSks} SKS aktif.`}
      />
      <div className="overflow-hidden rounded-[10px] border-[1px] border-stroke bg-white">
        <table className="px-table w-full text-left text-sm">
          <thead className="border-b-[1px] border-stroke bg-surface-alt font-mono text-xs text-secondary">
            <tr>
              <th className="px-4 py-3">Kode</th>
              <th className="px-4 py-3">Mata Kuliah</th>
              <th className="px-4 py-3">SKS</th>
              <th className="px-4 py-3">Jadwal</th>
            </tr>
          </thead>
          <tbody className="divide-y-[1px] divide-stroke">
            {DEMO_SCHEDULE.map((c) => (
              <tr key={c.id}>
                <td data-label="Kode" className="px-4 py-3 font-mono text-xs text-[#0369A1]">
                  {c.kode}
                </td>
                <td data-label="Mata Kuliah" data-primary="true" className="px-4 py-3 text-foreground">
                  {c.nama}
                </td>
                <td data-label="SKS" className="px-4 py-3 font-mono text-xs text-secondary">
                  {c.sks}
                </td>
                <td data-label="Jadwal" className="px-4 py-3 font-mono text-xs text-secondary">
                  {c.hari}, {c.jam}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DemoUjianView() {
  const [tab, setTab] = useState<"jadwal" | "kartu">("jadwal");
  return (
    <div className="space-y-5">
      <PageHeader title="Jadwal & Kartu Ujian" description="Ujian Tengah Semester (UTS) Ganjil 2026/2027." />
      <div className="flex gap-5 border-b-[1px] border-stroke" role="tablist" aria-label="Tab ujian">
        {(
          [
            { id: "jadwal", label: "Jadwal Ujian" },
            { id: "kartu", label: "Kartu Peserta" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={underlineTabClass(tab === t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "jadwal" ? (
        <div className="grid gap-3 md:grid-cols-2">
          {DEMO_UTS_EXAMS.map((ex) => (
            <div key={ex.kode} className="rounded-[10px] border-[1px] border-stroke bg-white p-5">
              <span className="font-mono text-xs text-[#0369A1]">{ex.kode}</span>
              <h2 className="mt-1.5 text-[15.5px] text-foreground">{ex.matkul}</h2>
              <p className="mt-1 font-mono text-xs text-secondary">{ex.tanggal}</p>
              <p className="mt-0.5 font-mono text-xs text-foreground">
                {ex.waktu} · Ruang {ex.ruang}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="max-w-lg rounded-[10px] border-[1px] border-stroke bg-white p-6">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-[#0369A1]">
            Kartu Peserta Ujian UTS
          </p>
          <p className="mt-2 text-lg text-foreground">{DEMO_STUDENT.nama}</p>
          <p className="mt-0.5 font-mono text-xs text-secondary">
            NIM {DEMO_STUDENT.nim} · Kelas {DEMO_STUDENT.kelas}
          </p>
          <p className="mt-4 rounded-[6px] bg-surface-alt p-3 text-xs text-secondary">
            Status syarat presensi & administrasi terpenuhi untuk {DEMO_UTS_EXAMS.length} mata
            kuliah ujian terjadwal.
          </p>
        </div>
      )}
    </div>
  );
}

export function DemoAgendaView() {
  return (
    <div className="space-y-5">
      <PageHeader title="Agenda Kampus" description="Kalender akademik dan jadwal kegiatan resmi UBSI." />
      <div className="divide-y-[1px] divide-stroke rounded-[10px] border-[1px] border-stroke bg-white">
        {DEMO_AGENDA.map((ag) => (
          <div
            key={ag.id}
            className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                <span className="text-[#0369A1]">{ag.kategori}</span>
                <span className="text-secondary/50" aria-hidden="true">
                  ·
                </span>
                <span className="text-secondary">{ag.tanggal}</span>
              </div>
              <h2 className="mt-1.5 text-[15.5px] text-foreground">{ag.judul}</h2>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1.5 font-mono text-xs text-[#9A3412]">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {ag.countdown}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DemoBeritaView() {
  const [openId, setOpenId] = useState<string | null>(DEMO_BERITA[0].id);
  return (
    <div className="space-y-5">
      <PageHeader title="Berita Kampus" description="Pengumuman terbaru dari portal berita UBSI." />
      <div className="divide-y-[1px] divide-stroke rounded-[10px] border-[1px] border-stroke bg-white">
        {DEMO_BERITA.map((b) => {
          const open = openId === b.id;
          return (
            <article key={b.id} className="p-5">
              <div className="flex items-center justify-between gap-2 font-mono text-xs">
                <span className="text-[#0369A1]">{b.kategori}</span>
                <span className="text-secondary">{b.tanggal}</span>
              </div>
              <h2 className="mt-1.5 text-[16px] text-foreground">{b.judul}</h2>
              <p className="mt-1 text-[13px] leading-relaxed text-secondary">{b.ringkasan}</p>
              {open && (
                <p className="mt-3 border-t-[1px] border-stroke pt-3 text-[13px] leading-relaxed text-foreground">
                  {b.isi}
                </p>
              )}
              <button
                type="button"
                onClick={() => setOpenId(open ? null : b.id)}
                className="mt-3 inline-flex min-h-[36px] items-center text-xs text-[#0369A1] underline underline-offset-4 hover:text-[#075985]"
              >
                {open ? "Tutup berita" : "Baca selengkapnya"}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function DemoPerpustakaanView() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = DEMO_BOOKS.filter(
    (b) =>
      !q ||
      b.judul.toLowerCase().includes(q) ||
      b.penulis.toLowerCase().includes(q) ||
      b.kode.toLowerCase().includes(q)
  );

  return (
    <div className="space-y-5">
      <PageHeader title="Perpustakaan OPAC" description="Cari ketersediaan buku fisik di rak perpustakaan." />

      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari judul buku, penulis, atau kode klasifikasi..."
          aria-label="Cari buku OPAC"
          className="px-input min-h-[44px] w-full pl-10 pr-4 text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-[10px] border-[1px] border-stroke bg-white p-8 text-center text-sm text-secondary">
          Tidak ditemukan buku yang cocok dengan kata kunci tersebut.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((b) => (
            <div key={b.id} className="rounded-[10px] border-[1px] border-stroke bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs text-[#0369A1]">{b.kode}</span>
                <span
                  className={`inline-flex items-center gap-1.5 font-mono text-[11px] ${
                    b.stok > 0 ? "text-[#0F766E]" : "text-[#BE123C]"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-[2px] ${
                      b.stok > 0 ? "bg-[#0F766E]" : "bg-[#BE123C]"
                    }`}
                    aria-hidden="true"
                  />
                  {b.stok > 0 ? `Tersedia (${b.stok})` : "Sedang dipinjam"}
                </span>
              </div>
              <h2 className="mt-2 text-[15px] text-foreground">{b.judul}</h2>
              <p className="mt-1 text-xs text-secondary">
                {b.penulis} · {b.lokasi}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DemoKeysView() {
  const [label, setLabel] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [keys, setKeys] = useState([
    { id: "k1", name: "CLI Laptop", token: "mira_demo_8a41f90c", created: "18 Nov 2026" },
  ]);

  function createKey(e: React.FormEvent) {
    e.preventDefault();
    const clean = label.trim();
    if (!clean) return;
    const suffix = Math.random().toString(16).slice(2, 10);
    setKeys((p) => [
      { id: `k-${Date.now()}`, name: clean, token: `mira_demo_${suffix}`, created: "Baru saja" },
      ...p,
    ]);
    setLabel("");
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Personal API Keys"
        description="Buat token pribadi untuk integrasi skrip atau klien MCP."
      />

      <form onSubmit={createKey} className="flex flex-col gap-2.5 sm:flex-row">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Nama kunci baru (mis. Claude Desktop)"
          aria-label="Nama kunci API baru"
          className="px-input min-h-[44px] flex-1 px-4 text-sm"
        />
        <button
          type="submit"
          className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[6px] bg-[#072033] px-5 text-xs text-white hover:bg-[#0369A1]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Buat Key</span>
        </button>
      </form>

      <div className="divide-y-[1px] divide-stroke rounded-[10px] border-[1px] border-stroke bg-white">
        {keys.map((k) => (
          <div
            key={k.id}
            className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
                <span className="text-[14px] text-foreground">{k.name}</span>
              </div>
              <p className="mt-1 font-mono text-xs text-secondary">
                {k.token} · {k.created}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(k.token).catch(() => undefined);
                  setCopiedId(k.id);
                  setTimeout(() => setCopiedId((prev) => (prev === k.id ? null : prev)), 1800);
                }}
                className="inline-flex min-h-[38px] items-center gap-1.5 rounded-[6px] border-[1px] border-stroke bg-white px-3 text-xs text-foreground hover:border-[#072033]"
              >
                {copiedId === k.id ? (
                  <Check className="h-3.5 w-3.5 text-[#0F766E]" aria-hidden="true" />
                ) : (
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                )}
                <span>{copiedId === k.id ? "Disalin" : "Salin"}</span>
              </button>
              <button
                type="button"
                onClick={() => setKeys((p) => p.filter((x) => x.id !== k.id))}
                aria-label={`Cabut ${k.name}`}
                className="inline-flex min-h-[38px] items-center gap-1 rounded-[6px] border-[1px] border-[#FDA4AF] bg-white px-3 text-xs text-[#BE123C] hover:bg-[#FFF1F2]"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Cabut</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DemoNotifikasiView() {
  const [settings, setSettings] = useState({
    kelas: true,
    tugas: true,
    presensi: true,
    discord: false,
    telegram: true,
  });

  const rows: { key: keyof typeof settings; label: string; desc: string }[] = [
    { key: "kelas", label: "Pengingat Kelas", desc: "Kirim notifikasi 15 menit sebelum jam kuliah." },
    { key: "tugas", label: "Deadline Tugas", desc: "Peringatan H-1 dan H-3 jam sebelum tenggat." },
    { key: "presensi", label: "Sesi Presensi Dibuka", desc: "Kabari segera saat dosen membuka absen." },
    { key: "telegram", label: "Saluran Telegram", desc: "Teruskan pengingat ke bot Telegram pribadi." },
    { key: "discord", label: "Webhook Discord", desc: "Kirim ringkasan jadwal ke server Discord." },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Notifikasi & Webhook"
        description="Atur saluran pengingat jadwal, tugas, dan presensi."
      />

      <div className="divide-y-[1px] divide-stroke rounded-[10px] border-[1px] border-stroke bg-white">
        {rows.map((r) => {
          const on = settings[r.key];
          return (
            <div key={r.key} className="flex items-center justify-between gap-4 p-4 sm:p-5">
              <div>
                <p className="text-[14px] text-foreground">{r.label}</p>
                <p className="mt-0.5 text-xs text-secondary">{r.desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={on}
                onClick={() => setSettings((p) => ({ ...p, [r.key]: !p[r.key] }))}
                className={`min-h-[38px] min-w-[72px] rounded-[6px] border-[1px] px-3 font-mono text-xs transition-colors ${
                  on
                    ? "border-[#0F766E] bg-[#0F766E] text-white"
                    : "border-stroke bg-surface-alt text-secondary"
                }`}
              >
                {on ? "Aktif" : "Mati"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DemoSesiView() {
  const [siakadLinked, setSiakadLinked] = useState(true);

  return (
    <div className="space-y-5">
      <PageHeader title="Sesi & Keamanan" description="Simulasi tautan kredensial kampus di akun Mira." />

      <div className="flex flex-col gap-3 rounded-[10px] border-[1px] border-stroke bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[14.5px] text-foreground">Tautan SIAKAD (students.bsi.ac.id)</p>
          <p className="mt-0.5 text-xs text-secondary">
            {siakadLinked
              ? "Tersambung untuk membaca KHS, IPK, dan KRS."
              : "Belum ditautkan. Nilai dan KRS dikunci."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setSiakadLinked((v) => !v)}
          className={`min-h-[40px] shrink-0 rounded-[6px] px-4 text-xs transition-colors ${
            siakadLinked
              ? "border-[1px] border-stroke bg-white text-foreground hover:border-[#072033]"
              : "bg-[#072033] text-white hover:bg-[#0369A1]"
          }`}
        >
          {siakadLinked ? "Lepas Tautan" : "Tautkan SIAKAD"}
        </button>
      </div>

      <div className="flex justify-end">
        <Link
          href="/login"
          className="inline-flex min-h-[42px] items-center rounded-[6px] bg-[#072033] px-5 text-xs text-white hover:bg-[#0369A1]"
        >
          Masuk dengan Akun Asli
        </Link>
      </div>
    </div>
  );
}
