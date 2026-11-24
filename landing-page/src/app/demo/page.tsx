"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Award,
  Bell,
  BookOpen,
  Calendar,
  CalendarDays,
  CheckSquare,
  Ellipsis,
  FileCheck2,
  FileQuestion,
  FileText,
  GraduationCap,
  Home,
  KeyRound,
  LayoutDashboard,
  Library,
  LogIn,
  MapPin,
  MessageSquare,
  MessagesSquare,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  X,
  type LucideIcon,
} from "lucide-react";
import { DialogProvider } from "@/components/ConfirmDialog";
import { Monogram } from "@/components/Monogram";
import { MuaraBackdrop } from "@/components/MuaraBackdrop";
import { SOCIAL_PROFILES } from "@/components/SocialIcons";
import { lockScroll } from "@/lib/scroll-lock";
import {
  DEMO_AGENDA,
  DEMO_SCHEDULE,
  DEMO_STUDENT,
  DEMO_TASKS,
  DEMO_UTS_EXAMS,
  type DemoViewId,
} from "@/data/demo-data";
import {
  DemoAgendaView,
  DemoBeritaView,
  DemoDiskusiView,
  DemoJadwalView,
  DemoKeysView,
  DemoKomunitasView,
  DemoKrsView,
  DemoKuisView,
  DemoMateriView,
  DemoNilaiView,
  DemoNotifikasiView,
  DemoPenggantiView,
  DemoPerpustakaanView,
  DemoPresensiView,
  DemoSesiView,
  DemoTugasView,
  DemoUjianView,
} from "@/components/demo/DemoViews";

interface DemoNavItem {
  id: DemoViewId;
  label: string;
  icon: LucideIcon;
}

interface DemoNavGroup {
  label: string;
  items: DemoNavItem[];
}

const DEMO_NAV_GROUPS: DemoNavGroup[] = [
  {
    label: "Utama",
    items: [
      { id: "ringkasan", label: "Ringkasan", icon: LayoutDashboard },
      { id: "komunitas", label: "Komunitas", icon: MessageSquare },
    ],
  },
  {
    label: "Perkuliahan",
    items: [
      { id: "jadwal", label: "Jadwal Kuliah", icon: Calendar },
      { id: "tugas", label: "Tugas Kuliah", icon: CheckSquare },
      { id: "presensi", label: "Presensi Kehadiran", icon: UserCheck },
      { id: "pengganti", label: "Kuliah Pengganti", icon: RefreshCw },
      { id: "materi", label: "Bahan Ajar", icon: BookOpen },
      { id: "kuis", label: "Kuis Perkuliahan", icon: FileQuestion },
      { id: "diskusi", label: "Forum Diskusi", icon: MessagesSquare },
    ],
  },
  {
    label: "Akademik",
    items: [
      { id: "nilai", label: "Nilai & KHS", icon: Award },
      { id: "krs", label: "Kartu KRS", icon: FileText },
      { id: "ujian", label: "Kartu Ujian", icon: FileCheck2 },
    ],
  },
  {
    label: "Layanan Kampus",
    items: [
      { id: "agenda", label: "Agenda Kampus", icon: CalendarDays },
      { id: "berita", label: "Berita Kampus", icon: Newspaper },
      { id: "perpustakaan", label: "Perpustakaan OPAC", icon: Library },
    ],
  },
  {
    label: "Pengaturan",
    items: [
      { id: "keys", label: "Personal API Keys", icon: KeyRound },
      { id: "notifikasi", label: "Notifikasi", icon: Bell },
      { id: "sesi", label: "Sesi & SIAKAD", icon: ShieldCheck },
    ],
  },
];

const ALL_NAV_ITEMS = DEMO_NAV_GROUPS.flatMap((group) => group.items);

const MOBILE_PRIMARY_VIEWS: { id: DemoViewId; label: string; icon: LucideIcon }[] = [
  { id: "ringkasan", label: "Ringkasan", icon: LayoutDashboard },
  { id: "jadwal", label: "Jadwal", icon: Calendar },
  { id: "tugas", label: "Tugas", icon: CheckSquare },
  { id: "komunitas", label: "Komunitas", icon: MessageSquare },
];

function formatDateID(): string {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
  } catch {
    return "Hari ini";
  }
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour >= 4 && hour < 11) return "Selamat pagi";
  if (hour >= 11 && hour < 15) return "Selamat siang";
  if (hour >= 15 && hour < 19) return "Selamat sore";
  return "Selamat malam";
}

function DeckStatCell({
  label,
  value,
  sub,
  onClick,
}: {
  label: string;
  value: string | number;
  sub: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[76px] flex-col justify-between px-4 py-3 text-left transition-colors hover:bg-white/10"
      style={{ backgroundColor: "rgba(6, 30, 50, 0.56)" }}
    >
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#9AD8F8]">
        {label}
      </span>
      <span className="font-display mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.01em] text-white tabular-nums sm:text-2xl">
        {value}
      </span>
      <span className="mt-1 truncate text-[11px] text-[#CBE0EE] group-hover:text-white">
        {sub}
      </span>
    </button>
  );
}

export default function DemoDashboardPage() {
  const [activeView, setActiveView] = useState<DemoViewId>("ringkasan");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const [secondClassPresent, setSecondClassPresent] = useState(false);
  const [taskDoneMap, setTaskDoneMap] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const item of DEMO_TASKS) {
      initial[item.id] = item.initialDone;
    }
    return initial;
  });

  const switchView = useCallback((view: DemoViewId) => {
    setActiveView(view);
    setSidebarCollapsed(view === "komunitas");
    setDrawerOpen(false);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const handleToggleTask = useCallback((taskId: string) => {
    setTaskDoneMap((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  }, []);

  const handleToggleSecondClass = useCallback(() => {
    setSecondClassPresent((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    const unlock = lockScroll();
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      unlock();
    };
  }, [drawerOpen]);

  const currentNav = useMemo(
    () => ALL_NAV_ITEMS.find((item) => item.id === activeView) ?? ALL_NAV_ITEMS[0],
    [activeView]
  );

  const isChatMode = activeView === "komunitas";
  const presentCount = secondClassPresent ? 2 : 1;
  const pendingTasksCount = useMemo(
    () => DEMO_TASKS.filter((task) => !taskDoneMap[task.id]).length,
    [taskDoneMap]
  );
  const urgentTask = DEMO_TASKS[0];
  const urgentTaskDone = Boolean(taskDoneMap[urgentTask.id]);
  const nearestUts = DEMO_UTS_EXAMS[0];
  const latestAgenda = DEMO_AGENDA[0];
  const dateLabel = formatDateID();
  const greetingText = getGreeting();
  const primaryActive = MOBILE_PRIMARY_VIEWS.some((item) => item.id === activeView);

  return (
    <DialogProvider>
      <div className="mira-portal relative flex min-h-screen flex-col bg-background text-foreground lg:flex-row">
        {!isChatMode ? <MuaraBackdrop /> : null}

      {/* Desktop Sidebar */}
      <aside
        className={`relative z-20 hidden shrink-0 flex-col border-r-[1px] border-border bg-white/95 backdrop-blur-md transition-[width] duration-200 lg:sticky lg:top-0 lg:flex lg:h-screen ${
          sidebarCollapsed ? "lg:w-16" : "lg:w-64"
        }`}
      >
        <div
          className={`flex h-16 shrink-0 items-center border-b-[1px] border-border ${
            sidebarCollapsed ? "justify-center px-2" : "justify-between px-4"
          }`}
        >
          {sidebarCollapsed ? (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              title="Buka sidebar menu"
              aria-label="Buka sidebar menu"
              className="flex h-10 w-10 items-center justify-center rounded-[8px] text-[#0369A1] transition-colors hover:bg-[#F0F7FB]"
            >
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchView("ringkasan")}
              title="Ringkasan Demo Mira"
              className="flex min-h-[44px] items-center gap-2.5 text-left"
            >
              <Monogram className="h-8 w-8 shrink-0" />
              <div className="min-w-0 leading-none">
                <span className="font-home-display block text-[17px] tracking-tight text-foreground">
                  Mira
                </span>
                <span className="mt-1 block font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-muted">
                  Portal · Demo
                </span>
              </div>
            </button>
          )}
        </div>

        <nav
          aria-label="Menu demo portal"
          className={`flex-1 space-y-4 overflow-y-auto py-3 ${sidebarCollapsed ? "px-2" : "px-3"}`}
        >
          {DEMO_NAV_GROUPS.map((group) => (
            <div key={group.label}>
              {!sidebarCollapsed ? (
                <p className="mb-1 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-muted">
                  {group.label}
                </p>
              ) : (
                <div className="mx-2 my-1.5 border-t-[1px] border-border" />
              )}

              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = activeView === item.id;
                  const taskCounter =
                    item.id === "tugas" && pendingTasksCount > 0 ? pendingTasksCount : null;

                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => switchView(item.id)}
                        title={sidebarCollapsed ? item.label : undefined}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-[38px] w-full items-center justify-between text-[13px] transition-colors ${
                          sidebarCollapsed ? "justify-center rounded-[6px] px-2 py-2" : "px-3 py-1.5"
                        } ${
                          active
                            ? sidebarCollapsed
                              ? "bg-[#E6F2FA] text-foreground"
                              : "rounded-r-[6px] rounded-l-none border-l-[2px] border-[#0369A1] bg-[#F0F7FB]/80 text-foreground"
                            : "rounded-[6px] text-foreground-muted hover:bg-background-subtle hover:text-foreground"
                        }`}
                      >
                        <span className={`flex items-center ${sidebarCollapsed ? "" : "gap-2.5"} min-w-0`}>
                          <Icon
                            className={`h-4 w-4 shrink-0 ${active ? "text-[#0369A1]" : ""}`}
                            aria-hidden="true"
                          />
                          {!sidebarCollapsed ? <span className="truncate">{item.label}</span> : null}
                        </span>

                        {!sidebarCollapsed && taskCounter !== null ? (
                          <span className="font-mono text-[11px] tabular-nums text-[#9A3412]">
                            {taskCounter}
                          </span>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div
          className={`shrink-0 space-y-2 border-t-[1px] border-border bg-white/80 ${
            sidebarCollapsed ? "p-2.5" : "p-3"
          }`}
        >
          <Link
            href="/"
            title="Kembali ke Beranda"
            className={`flex min-h-[38px] items-center rounded-[6px] border-[1px] border-border bg-white text-xs text-foreground-muted transition-colors hover:border-[#072033] hover:text-foreground ${
              sidebarCollapsed ? "justify-center px-2" : "gap-2 px-3"
            }`}
          >
            <Home className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            {!sidebarCollapsed ? <span>Kembali ke Beranda</span> : null}
          </Link>

          {sidebarCollapsed ? (
            <Link
              href="/login"
              title="Masuk dengan akun kampus"
              className="flex h-10 w-full items-center justify-center rounded-[6px] border-[1px] border-border bg-white text-foreground transition-colors hover:border-[#072033]"
            >
              <LogIn className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-[8px] border-[1px] border-border bg-background-subtle/50 p-2.5">
              <div className="min-w-0">
                <p className="truncate text-xs text-foreground">{DEMO_STUDENT.nama}</p>
                <p className="truncate font-mono text-[11px] text-foreground-muted">
                  NIM {DEMO_STUDENT.nim}
                </p>
              </div>
              <Link
                href="/login"
                className="shrink-0 rounded-[6px] border-[1px] border-[#072033] bg-[#072033] px-3 py-1.5 text-[11px] text-white transition-colors hover:bg-white hover:text-[#072033]"
              >
                Masuk
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Topbar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b-[1px] border-border bg-white/92 px-4 backdrop-blur-md lg:hidden">
        <button
          type="button"
          onClick={() => switchView("ringkasan")}
          className="flex items-center gap-2 text-left"
        >
          <Monogram className="h-7 w-7" />
          <span className="font-home-display text-[17px] tracking-tight text-foreground">
            Mira
          </span>
          <span className="font-mono text-[11px] text-foreground-muted">/ Demo</span>
        </button>

        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="inline-flex min-h-[40px] items-center text-xs text-foreground-muted hover:text-foreground"
          >
            Beranda
          </Link>
          <Link
            href="/login"
            className="inline-flex min-h-[38px] items-center rounded-[6px] bg-foreground px-3.5 text-xs text-white transition-colors hover:bg-[#0369A1]"
          >
            Masuk
          </Link>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        {/* Desktop Sticky Subheader */}
        <header className="sticky top-0 z-20 hidden h-16 items-center justify-between border-b-[1px] border-border bg-white/90 px-6 backdrop-blur-md lg:flex">
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              aria-label={sidebarCollapsed ? "Buka sidebar menu" : "Perkecil sidebar menu"}
              title={sidebarCollapsed ? "Buka sidebar" : "Perkecil sidebar"}
              className="inline-flex h-9 items-center gap-1.5 rounded-[6px] border-[1px] border-border bg-white px-2.5 text-xs text-foreground-muted transition-colors hover:border-[#072033] hover:text-foreground"
            >
              {sidebarCollapsed ? (
                <>
                  <PanelLeftOpen className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
                  <span>Menu</span>
                </>
              ) : (
                <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => switchView("ringkasan")}
                className="text-foreground-muted transition-colors hover:text-foreground"
              >
                Portal
              </button>
              <span className="text-foreground-muted/60">/</span>
              <span className="text-foreground">{currentNav.label}</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-0.5" aria-label="Follow media sosial Mira">
              {SOCIAL_PROFILES.map(({ id, name, handle, href, icon: Icon }) => (
                <a
                  key={id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Follow ${name} ${handle}`}
                  title={`Follow ${name} (${handle})`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-foreground-muted transition-colors hover:bg-[#EAF3F9] hover:text-foreground"
                >
                  <Icon className="h-[15px] w-[15px]" />
                </a>
              ))}
            </div>

            <span className="h-4 w-[1px] bg-border" aria-hidden="true" />

            <Link
              href="/"
              className="inline-flex min-h-[38px] items-center text-xs text-foreground-muted transition-colors hover:text-foreground"
            >
              Beranda
            </Link>
            <Link
              href="/login"
              className="inline-flex min-h-[38px] items-center rounded-[6px] border-[1px] border-[#072033] bg-[#072033] px-4 text-xs font-medium text-white transition-colors duration-200 hover:bg-white hover:text-[#072033]"
            >
              Masuk Akun
            </Link>
          </div>
        </header>

        <main
          className={`flex-1 ${
            isChatMode
              ? "w-full px-2 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-3 sm:px-4 lg:px-5 lg:py-3"
              : "mx-auto w-full max-w-6xl px-4 pb-24 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-6"
          }`}
        >
          {activeView === "ringkasan" ? (
            <div key="ringkasan" className="page-in space-y-5">
              {/* 1. Muara Command Deck: Greeting + Integrated Telemetry + Live Session Dock */}
              <section
                aria-label="Ringkasan akademik hari ini"
                className="overflow-hidden rounded-[12px] border-[1px] border-[#133A59] bg-[#072033] text-white"
              >
                <div className="relative overflow-hidden px-5 py-6 sm:px-7 sm:py-7">
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-cover bg-center"
                    style={{ backgroundImage: "url('/images/hero-ocean-muara.webp')" }}
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage: [
                        "linear-gradient(120deg, rgba(6, 26, 44, 0.94) 0%, rgba(8, 42, 70, 0.82) 55%, rgba(6, 26, 44, 0.90) 100%)",
                        "radial-gradient(ellipse 70% 80% at 90% 20%, rgba(125, 211, 252, 0.14) 0%, rgba(6, 26, 44, 0) 70%)",
                      ].join(", "),
                    }}
                  />

                  <div className="relative z-10 grid gap-5 lg:grid-cols-[1.15fr_1fr] lg:items-end">
                    <div>
                      <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#9AD8F8]">
                        {dateLabel}
                      </p>
                      <h1 className="font-home-display mt-1.5 text-[clamp(1.65rem,3vw,2.25rem)] leading-[1.1] tracking-[-0.01em] text-white">
                        {greetingText}, {DEMO_STUDENT.panggilan}
                      </h1>
                      <p className="mt-2 text-[12.5px] text-[#DCEBF5]">
                        <span className="font-mono text-white">{DEMO_STUDENT.nim}</span> ·{" "}
                        {DEMO_STUDENT.prodi}{" "}
                        <span className="font-mono">{DEMO_STUDENT.kelas}</span> · Sem{" "}
                        {DEMO_STUDENT.semester} · {DEMO_STUDENT.kampus}
                      </p>
                    </div>

                    {/* Integrated 2x2 / 4-col Telemetry Strip */}
                    <div
                      className="grid grid-cols-2 gap-[1px] overflow-hidden rounded-[8px] border-[1px] border-white/15 sm:grid-cols-4 lg:grid-cols-2"
                      style={{ backgroundColor: "rgba(255, 255, 255, 0.14)" }}
                    >
                      <DeckStatCell
                        label="IPK"
                        value="3.85"
                        sub="48 SKS lulus"
                        onClick={() => switchView("nilai")}
                      />
                      <DeckStatCell
                        label="Presensi"
                        value={`${presentCount}/2`}
                        sub={secondClassPresent ? "Semua hadir" : "1 belum absen"}
                        onClick={() => switchView("presensi")}
                      />
                      <DeckStatCell
                        label="Tugas"
                        value={pendingTasksCount}
                        sub={pendingTasksCount === 0 ? "Semua beres" : "1 mendekati"}
                        onClick={() => switchView("tugas")}
                      />
                      <DeckStatCell
                        label="Kelas"
                        value={2}
                        sub={secondClassPresent ? "Selesai dicatat" : "1 menunggu"}
                        onClick={() => switchView("jadwal")}
                      />
                    </div>
                  </div>
                </div>

                {/* Live Session Spotlight Bar */}
                <div className="flex flex-col gap-3 border-t-[1px] border-white/15 bg-[#051828] px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border-[1px] border-white/15 bg-white/10 text-[#7DD3FC]">
                      <GraduationCap className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#7DD3FC]">
                        {secondClassPresent ? "Sesi Hari Ini Selesai" : "Perlu Presensi Sekarang"}
                      </p>
                      <p className="truncate text-[13.5px] text-white">
                        {secondClassPresent ? DEMO_SCHEDULE[0].nama : DEMO_SCHEDULE[1].nama}
                        <span className="ml-2 font-mono text-[11.5px] text-[#9CC6E0]">
                          {secondClassPresent ? DEMO_SCHEDULE[0].jam : DEMO_SCHEDULE[1].jam} ·{" "}
                          {secondClassPresent ? DEMO_SCHEDULE[0].ruang : DEMO_SCHEDULE[1].ruang}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={handleToggleSecondClass}
                      className={`inline-flex min-h-[38px] items-center justify-center rounded-[6px] border-[1px] px-4 text-xs font-medium transition-colors duration-200 ${
                        secondClassPresent
                          ? "border-white/30 bg-transparent text-[#DCEBF5] hover:border-white hover:text-white"
                          : "border-white bg-white text-[#072033] hover:bg-transparent hover:text-white"
                      }`}
                    >
                      {secondClassPresent ? "Batalkan Presensi" : "Absen Sekarang"}
                    </button>
                    <button
                      type="button"
                      onClick={() => switchView("komunitas")}
                      className="inline-flex min-h-[38px] items-center justify-center rounded-[6px] border-[1px] border-white/25 bg-transparent px-3.5 text-xs text-white transition-colors hover:border-white hover:bg-white hover:text-[#072033]"
                    >
                      Komunitas
                    </button>
                  </div>
                </div>
              </section>

              {/* 2. Asymmetric Editorial Split: Vertical Class Timeline (Left) + Priority & Quick Access (Right) */}
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.35fr_0.95fr] lg:items-start">
                {/* Left: Today's Vertical Timeline Ledger */}
                <section
                  aria-labelledby="demo-today-heading"
                  className="overflow-hidden rounded-[10px] border-[1px] border-border bg-white"
                >
                  <div className="flex items-center justify-between gap-2 border-b-[1px] border-border px-5 py-3.5">
                    <div>
                      <h2 id="demo-today-heading" className="text-[15px] text-foreground">
                        Agenda Kuliah Hari Ini
                      </h2>
                      <p className="text-xs text-foreground-muted">
                        Urutan sesi kelas & status presensi langsung.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => switchView("jadwal")}
                      className="text-xs text-[#0369A1] underline underline-offset-4 hover:text-[#072033]"
                    >
                      Jadwal lengkap
                    </button>
                  </div>

                  <div className="divide-y-[1px] divide-border">
                    {/* Class 1: Verified */}
                    <article className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-5 sm:p-5">
                      <div className="flex shrink-0 items-center justify-between sm:w-28 sm:flex-col sm:items-start">
                        <span className="font-mono text-xs text-foreground">
                          {DEMO_SCHEDULE[0].jam}
                        </span>
                        <span className="mt-0.5 inline-flex items-center gap-1.5 text-[11.5px] text-[#0F766E]">
                          <span className="h-1.5 w-1.5 rounded-[9999px] bg-[#0F766E]" aria-hidden="true" />
                          Hadir
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 border-l-[2px] border-[#0F766E] pl-3.5">
                        <p className="font-mono text-[11px] text-[#0369A1]">
                          {DEMO_SCHEDULE[0].kode} · {DEMO_SCHEDULE[0].sks} SKS
                        </p>
                        <h3 className="mt-1 text-[15px] text-foreground">
                          {DEMO_SCHEDULE[0].nama}
                        </h3>
                        <p className="mt-0.5 text-xs text-foreground-muted">
                          {DEMO_SCHEDULE[0].dosen}
                        </p>
                        <p className="mt-2 inline-flex items-center gap-1 text-xs text-foreground-muted">
                          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                          {DEMO_SCHEDULE[0].ruang}
                        </p>
                      </div>
                    </article>

                    {/* Class 2: Interactive 1-tap attendance */}
                    <article className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:gap-5 sm:p-5">
                      <div className="flex shrink-0 items-center justify-between sm:w-28 sm:flex-col sm:items-start">
                        <span className="font-mono text-xs text-foreground">
                          {DEMO_SCHEDULE[1].jam}
                        </span>
                        <span
                          className={`mt-0.5 inline-flex items-center gap-1.5 text-[11.5px] ${
                            secondClassPresent ? "text-[#0F766E]" : "text-[#9A3412]"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-[9999px] ${
                              secondClassPresent ? "bg-[#0F766E]" : "bg-[#9A3412]"
                            }`}
                            aria-hidden="true"
                          />
                          {secondClassPresent ? "Hadir" : "Belum absen"}
                        </span>
                      </div>

                      <div
                        className={`min-w-0 flex-1 border-l-[2px] pl-3.5 ${
                          secondClassPresent ? "border-[#0F766E]" : "border-[#9A3412]"
                        }`}
                      >
                        <p className="font-mono text-[11px] text-[#0369A1]">
                          {DEMO_SCHEDULE[1].kode} · {DEMO_SCHEDULE[1].sks} SKS
                        </p>
                        <h3 className="mt-1 text-[15px] text-foreground">
                          {DEMO_SCHEDULE[1].nama}
                        </h3>
                        <p className="mt-0.5 text-xs text-foreground-muted">
                          {DEMO_SCHEDULE[1].dosen}
                        </p>
                        <p className="mt-2 inline-flex items-center gap-1 text-xs text-foreground-muted">
                          <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                          {DEMO_SCHEDULE[1].ruang}
                        </p>

                        <div className="mt-3.5 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={handleToggleSecondClass}
                            className={`inline-flex min-h-[38px] items-center justify-center rounded-[6px] border-[1px] px-4 text-xs font-medium transition-colors duration-200 ${
                              secondClassPresent
                                ? "border-border bg-white text-foreground-muted hover:border-[#072033] hover:text-foreground"
                                : "border-[#072033] bg-[#072033] text-white hover:bg-white hover:text-[#072033]"
                            }`}
                          >
                            {secondClassPresent ? "Batalkan Presensi" : "Absen Sekarang"}
                          </button>
                          <button
                            type="button"
                            onClick={() => switchView("materi")}
                            className="inline-flex min-h-[38px] items-center justify-center rounded-[6px] border-[1px] border-border bg-white px-3.5 text-xs text-foreground-muted transition-colors hover:border-[#072033] hover:text-foreground"
                          >
                            Bahan Ajar
                          </button>
                        </div>
                      </div>
                    </article>
                  </div>
                </section>

                {/* Right: Priority & Quick Access Rail */}
                <div className="space-y-4">
                  {/* Urgent Task + UTS + Agenda Unified Card */}
                  <div className="divide-y-[1px] divide-border overflow-hidden rounded-[10px] border-[1px] border-border bg-white">
                    <div className="p-4 sm:p-5">
                      <div className="flex items-center justify-between gap-2 font-mono text-[10.5px]">
                        <span className="uppercase tracking-[0.12em] text-foreground-muted">
                          Tugas Terdekat
                        </span>
                        <span className={urgentTaskDone ? "text-[#0F766E]" : "text-[#9A3412]"}>
                          {urgentTaskDone ? "Selesai" : `Pertemuan ${urgentTask.pertemuan}`}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-foreground">{urgentTask.judul}</p>
                      <p className="mt-0.5 text-xs text-foreground-muted">
                        {urgentTask.matkul} · <span className="font-mono">{urgentTask.deadline}</span>
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleTask(urgentTask.id)}
                          className={`inline-flex min-h-[36px] flex-1 items-center justify-center rounded-[6px] border-[1px] px-3 text-xs font-medium transition-colors duration-200 ${
                            urgentTaskDone
                              ? "border-border bg-white text-foreground-muted hover:border-[#072033] hover:text-foreground"
                              : "border-[#072033] bg-[#072033] text-white hover:bg-white hover:text-[#072033]"
                          }`}
                        >
                          {urgentTaskDone ? "Buka Lagi" : "Tandai Selesai"}
                        </button>
                        <button
                          type="button"
                          onClick={() => switchView("tugas")}
                          className="inline-flex min-h-[36px] items-center rounded-[6px] border-[1px] border-border bg-white px-3 text-xs text-foreground-muted hover:border-[#072033] hover:text-foreground"
                        >
                          Semua
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => switchView("ujian")}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-background-subtle/50 sm:px-5"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#0369A1]">
                          Kartu Ujian · Terbit
                        </p>
                        <p className="mt-0.5 truncate text-[13.5px] text-foreground">
                          {nearestUts.matkul}
                        </p>
                        <p className="truncate text-xs text-foreground-muted">
                          {nearestUts.tanggal} · {nearestUts.ruang}
                        </p>
                      </div>
                      <FileCheck2 className="h-4 w-4 shrink-0 text-[#0369A1]" aria-hidden="true" />
                    </button>

                    <button
                      type="button"
                      onClick={() => switchView("agenda")}
                      className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors hover:bg-background-subtle/50 sm:px-5"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-foreground-muted">
                          Agenda · {latestAgenda.kategori}
                        </p>
                        <p className="mt-0.5 truncate text-[13.5px] text-foreground">
                          {latestAgenda.judul}
                        </p>
                        <p className="truncate text-xs text-foreground-muted">
                          {latestAgenda.tanggal} · {latestAgenda.countdown}
                        </p>
                      </div>
                      <CalendarDays className="h-4 w-4 shrink-0 text-foreground-muted" aria-hidden="true" />
                    </button>
                  </div>

                  {/* Quick Services Compact 2x2 Grid */}
                  <div className="grid grid-cols-2 divide-x-[1px] divide-y-[1px] divide-border overflow-hidden rounded-[10px] border-[1px] border-border bg-white">
                    {[
                      { id: "materi" as DemoViewId, title: "Bahan Ajar", icon: BookOpen },
                      { id: "kuis" as DemoViewId, title: "Kuis Online", icon: FileQuestion },
                      { id: "nilai" as DemoViewId, title: "Nilai & KHS", icon: Award },
                      { id: "perpustakaan" as DemoViewId, title: "Perpustakaan", icon: Library },
                    ].map((service) => {
                      const Icon = service.icon;
                      return (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => switchView(service.id)}
                          className="group flex min-h-[54px] items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-background-subtle/60"
                        >
                          <Icon
                            className="h-4 w-4 shrink-0 text-[#0369A1] transition-colors group-hover:text-foreground"
                            aria-hidden="true"
                          />
                          <span className="truncate text-xs text-foreground">{service.title}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Follow Update Mira Strip */}
                  <div className="rounded-[10px] border-[1px] border-border bg-white p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-muted">
                        Ikuti Update Mira
                      </span>
                      <span className="font-mono text-[10.5px] text-[#0369A1]">@muara.ai</span>
                    </div>
                    <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                      {SOCIAL_PROFILES.map(({ id, name, handle, href, icon: Icon }) => (
                        <a
                          key={id}
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Follow ${name} ${handle}`}
                          className="group flex min-h-[38px] items-center justify-center gap-1.5 rounded-[6px] border-[1px] border-border bg-white px-2 text-xs text-foreground transition-colors duration-200 hover:border-[#072033] hover:bg-[#072033] hover:text-white"
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0 text-[#0369A1] transition-colors group-hover:text-[#7DD3FC]" />
                          <span className="truncate">{name}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div key={activeView} className="page-in">
              {activeView === "komunitas" ? <DemoKomunitasView /> : null}
              {activeView === "jadwal" ? (
                <DemoJadwalView
                  taskDoneMap={taskDoneMap}
                  onToggleTask={handleToggleTask}
                  secondClassPresent={secondClassPresent}
                  onToggleSecondClass={handleToggleSecondClass}
                  onNavigate={(v) => switchView(v)}
                />
              ) : null}
              {activeView === "tugas" ? (
                <DemoTugasView taskDoneMap={taskDoneMap} onToggleTask={handleToggleTask} />
              ) : null}
              {activeView === "presensi" ? (
                <DemoPresensiView
                  secondClassPresent={secondClassPresent}
                  onToggleSecondClass={handleToggleSecondClass}
                />
              ) : null}
              {activeView === "pengganti" ? <DemoPenggantiView /> : null}
              {activeView === "materi" ? <DemoMateriView /> : null}
              {activeView === "kuis" ? <DemoKuisView /> : null}
              {activeView === "diskusi" ? <DemoDiskusiView /> : null}
              {activeView === "nilai" ? <DemoNilaiView /> : null}
              {activeView === "krs" ? <DemoKrsView /> : null}
              {activeView === "ujian" ? <DemoUjianView /> : null}
              {activeView === "agenda" ? <DemoAgendaView /> : null}
              {activeView === "berita" ? <DemoBeritaView /> : null}
              {activeView === "perpustakaan" ? <DemoPerpustakaanView /> : null}
              {activeView === "keys" ? <DemoKeysView /> : null}
              {activeView === "notifikasi" ? <DemoNotifikasiView /> : null}
              {activeView === "sesi" ? <DemoSesiView /> : null}
            </div>
          )}
        </main>

        {/* Minimal Footer */}
        {!isChatMode ? (
          <footer className="hidden border-t-[1px] border-border px-8 py-4 text-xs text-foreground-muted lg:block">
            <div className="mx-auto flex max-w-6xl items-center justify-between">
              <span>Mira Demo Portal · Muara AI</span>
              <Link href="/" className="text-foreground-muted hover:text-foreground">
                Kembali ke Beranda
              </Link>
            </div>
          </footer>
        ) : null}
      </div>

      {/* Edge-to-edge Mobile Bottom Navigation */}
      <nav
        aria-label="Navigasi bawah mobile"
        className="dashboard-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 lg:hidden"
      >
        {MOBILE_PRIMARY_VIEWS.map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => switchView(item.id)}
              aria-current={active ? "page" : undefined}
              className="bottom-nav-item"
              data-active={active}
            >
              <span className="bottom-nav-icon" aria-hidden="true">
                <Icon className="h-[18px] w-[18px]" />
              </span>
              <span className="bottom-nav-label">{item.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-expanded={drawerOpen}
          aria-label="Buka semua menu demo"
          className="bottom-nav-item"
          data-active={!primaryActive || drawerOpen}
        >
          <span className="bottom-nav-icon" aria-hidden="true">
            <Ellipsis className="h-[18px] w-[18px]" />
          </span>
          <span className="bottom-nav-label">Menu</span>
        </button>
      </nav>

      {/* Mobile Slide-Over Menu Drawer */}
      {drawerOpen ? (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu navigasi portal demo"
        >
          <button
            type="button"
            aria-label="Tutup menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-[#072033]/40 backdrop-blur-[2px]"
          />

          <div className="relative flex h-full w-80 max-w-[88vw] flex-col overflow-hidden rounded-r-[12px] border-r-[1px] border-border bg-white shadow-2xl">
            <div className="flex h-14 shrink-0 items-center justify-between border-b-[1px] border-border px-4">
              <div className="flex items-center gap-2">
                <Monogram className="h-7 w-7" />
                <span className="font-home-display text-base text-foreground">Mira</span>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Tutup"
                className="flex h-10 w-10 items-center justify-center rounded-[6px] border-[1px] border-border text-foreground-muted hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-3.5 py-4">
              {DEMO_NAV_GROUPS.map((group) => (
                <div key={group.label}>
                  <p className="mb-1.5 px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-foreground-muted">
                    {group.label}
                  </p>
                  <ul className="grid grid-cols-2 gap-1.5">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const active = activeView === item.id;
                      const taskCounter =
                        item.id === "tugas" && pendingTasksCount > 0 ? pendingTasksCount : null;

                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            onClick={() => switchView(item.id)}
                            className={`flex min-h-[44px] w-full items-center gap-2 rounded-[8px] border-[1px] px-2.5 py-2 text-left text-[12px] transition-colors ${
                              active
                                ? "border-[#0369A1] bg-[#E6F2FA] text-foreground"
                                : "border-border bg-white text-foreground-muted hover:border-[#9CC6E0] hover:text-foreground"
                            }`}
                          >
                            <Icon
                              className={`h-4 w-4 shrink-0 ${active ? "text-[#0369A1]" : ""}`}
                              aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1 truncate">{item.label}</span>
                            {taskCounter !== null ? (
                              <span className="font-mono text-[10.5px] tabular-nums text-[#9A3412]">
                                {taskCounter}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>

            <div className="shrink-0 space-y-2 border-t-[1px] border-border bg-background-subtle/40 p-3">
              <div className="grid grid-cols-3 gap-1.5">
                {SOCIAL_PROFILES.map(({ id, name, handle, href, icon: Icon }) => (
                  <a
                    key={id}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Follow ${name} ${handle}`}
                    className="flex min-h-[38px] items-center justify-center gap-1.5 rounded-[6px] border-[1px] border-border bg-white px-2 text-[11.5px] text-foreground transition-colors hover:border-[#072033]"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 text-[#0369A1]" />
                    <span>{name}</span>
                  </a>
                ))}
              </div>
              <Link
                href="/"
                onClick={() => setDrawerOpen(false)}
                className="flex min-h-[42px] w-full items-center gap-2 rounded-[6px] border-[1px] border-border bg-white px-3 text-xs text-foreground hover:border-[#072033]"
              >
                <Home className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
                <span>Kembali ke Beranda</span>
              </Link>
              <Link
                href="/login"
                onClick={() => setDrawerOpen(false)}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[6px] bg-foreground px-3 text-xs text-white hover:bg-[#0369A1]"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                <span>Masuk dengan Akun Kampus</span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}
      </div>
    </DialogProvider>
  );
}
