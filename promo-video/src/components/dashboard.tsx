import React from "react";
import {
  ArrowRight,
  Award,
  BellRing,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  FileSpreadsheet,
  FileText,
  GraduationCap,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  Library,
  LogIn,
  LogOut,
  MessageSquare,
  MessagesSquare,
  Newspaper,
  RefreshCw,
  Repeat,
  Send,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import { Monogram, PageHeader, Spin, BlinkBlock } from "./ui";
import { pageIn, riseStyle } from "./motion";
import { CLASSES, DEMO, TASKS } from "../data";
import { EASE_PX, prog } from "../lib/anim";

/* ------------------------------------------------------------------ */
/* Sidebar (DashboardSidebar.tsx)                                      */
/* ------------------------------------------------------------------ */

const NAV_GROUPS = [
  {
    title: "Utama",
    items: [
      { href: "/dashboard", label: "Ringkasan", icon: LayoutDashboard },
      { href: "/dashboard/komunitas", label: "Komunitas", icon: MessagesSquare, badge: "Baru" },
    ],
  },
  {
    title: "Perkuliahan",
    items: [
      { href: "/dashboard/jadwal", label: "Jadwal Kuliah", icon: CalendarDays },
      { href: "/dashboard/tugas", label: "Tugas Kuliah", icon: CheckSquare },
      { href: "/dashboard/presensi", label: "Presensi Kehadiran", icon: UserCheck },
      { href: "/dashboard/pengganti", label: "Kuliah Pengganti", icon: Repeat },
      { href: "/dashboard/materi", label: "Bahan Ajar", icon: BookOpen },
      { href: "/dashboard/kuis", label: "Kuis Perkuliahan", icon: HelpCircle },
      { href: "/dashboard/diskusi", label: "Forum Diskusi", icon: MessageSquare },
    ],
  },
  {
    title: "Akademik",
    items: [
      { href: "/dashboard/nilai", label: "Nilai & KHS", icon: GraduationCap },
      { href: "/dashboard/krs", label: "Kartu KRS", icon: FileSpreadsheet },
      { href: "/dashboard/ujian", label: "Kartu Ujian", icon: Award },
    ],
  },
  {
    title: "Layanan Kampus",
    items: [
      { href: "/dashboard/agenda", label: "Agenda Kampus", icon: CalendarDays, badge: "Live" },
      { href: "/dashboard/berita", label: "Berita Kampus", icon: Newspaper },
      { href: "/dashboard/perpustakaan", label: "Perpustakaan OPAC", icon: Library },
    ],
  },
  {
    title: "Pengaturan & Integrasi",
    items: [
      { href: "/dashboard/keys", label: "Personal API Keys", icon: KeyRound },
      { href: "/dashboard/notifikasi", label: "Notifikasi Webhook", icon: BellRing },
      { href: "/dashboard/sesi", label: "Sesi & Keamanan", icon: ShieldCheck },
    ],
  },
];

const Sidebar: React.FC<{ active: string; hover?: string | null; compact?: boolean }> = ({ active, hover, compact }) => (
  <aside className="flex h-full flex-col bg-white border-r-2 border-px-soft">
    <div className={`flex h-16 shrink-0 items-center border-b-2 border-px-soft ${compact ? "justify-center px-2" : "px-4"}`}>
      <div className="flex items-center gap-2.5">
        <span className="px-frame flex h-9 w-9 items-center justify-center overflow-hidden bg-white" style={{ ["--px-line" as string]: "#CFE2EE" }}>
          <Monogram size={28} />
        </span>
        {!compact && (
          <span className="flex flex-col">
            <span className="font-display text-base font-bold leading-none tracking-tight text-foreground">Mira</span>
            <span className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#0369A1]">Muara AI</span>
          </span>
        )}
      </div>
    </div>
    <nav className={`flex-1 space-y-3 overflow-hidden py-3 ${compact ? "px-2" : "px-3"}`}>
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          {group.items.length > 1 && !compact && (
            <p className="mb-0.5 flex items-center gap-2 px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-secondary/80">
              <span className="h-1.5 w-1.5 bg-px-water" aria-hidden="true" />
              {group.title}
            </p>
          )}
          <ul className="space-y-px">
            {group.items.map(({ href, label, icon: Icon, badge }) => {
              const on = href === active;
              const hov = !on && href === hover;
              return (
                <li key={href}>
                  <span
                    data-anchor={`nav-${href}`}
                    className={`flex items-center gap-2.5 font-mono text-xs ${compact ? "min-h-10 justify-center px-0" : "min-h-8 px-2.5"} ${
                      on
                        ? "bg-px-highlight font-semibold text-foreground shadow-[inset_3px_0_0_#0369A1]"
                        : hov
                          ? "bg-[#F0F7FB] font-medium text-foreground shadow-[inset_3px_0_0_#9CC6E0]"
                          : "font-medium text-secondary"
                    }`}
                  >
                    <Icon className={`h-4 w-4 shrink-0 ${on ? "text-[#0369A1]" : "text-secondary"}`} aria-hidden="true" />
                    {!compact && <span className="truncate">{label}</span>}
                    {badge && !compact && <span className="px-chip ml-auto bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#0369A1]">{badge}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
    <div className={`shrink-0 border-t-2 border-px-soft ${compact ? "p-2" : "p-3"}`}>
      <div className={`flex items-center gap-2.5 ${compact ? "flex-col" : ""}`}>
        <span className={`flex min-h-11 min-w-0 items-center gap-2.5 py-1.5 ${compact ? "justify-center px-0" : "flex-1 px-2"}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center bg-[#072033] font-mono text-[11px] font-bold text-white shadow-[2px_2px_0_0_#0369A1]">
            {DEMO.nim.slice(-2)}
          </span>
          <span className={compact ? "hidden" : "flex min-w-0 flex-col"}>
            <span className="flex items-center gap-1.5 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-secondary">
              <span className="h-1.5 w-1.5 bg-[#0F766E]" aria-hidden="true" />
              Mahasiswa
            </span>
            <span className="truncate font-mono text-xs font-semibold text-foreground">{DEMO.nim}</span>
          </span>
        </span>
        <span className="px-frame flex h-11 w-11 shrink-0 items-center justify-center bg-white text-[#BE123C]" style={{ ["--px-line" as string]: "#FDA4AF" }}>
          <LogOut className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
    </div>
  </aside>
);

/* ------------------------------------------------------------------ */
/* Shell desktop (DashboardShell.tsx): sidebar 256px + header 64px      */
/* ------------------------------------------------------------------ */

export const DashboardShell: React.FC<{
  active: string;
  title: string;
  hover?: string | null;
  scroll?: number;
  children: React.ReactNode;
  overlay?: React.ReactNode;
  /** Rute Komunitas: sidebar ringkas (ikon saja) dan area chat selebar layar, seperti aslinya. */
  compact?: boolean;
  /** 0..1 transisi lebar sidebar 256 -> 64 */
  compactP?: number;
}> = ({ active, title, hover, scroll = 0, children, overlay, compact = false, compactP }) => (
  <div className="portal-type flex bg-background text-foreground" style={{ width: 1440, height: 900, position: "relative" }}>
    <div style={{ width: compactP !== undefined ? 256 - 192 * compactP : compact ? 64 : 256, height: 900, flex: "none", overflow: "hidden" }}>
      <Sidebar active={active} hover={hover} compact={compactP !== undefined ? compactP > 0.5 : compact} />
    </div>
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-16 shrink-0 items-center justify-between border-b-2 border-px-soft bg-white/85 px-8">
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="font-semibold text-[#0369A1]">Dashboard</span>
          <span className="text-px-water" aria-hidden="true">/</span>
          <span className="font-semibold text-foreground">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-chip flex shrink-0 items-center gap-1.5 bg-[#F0F7FB] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#0369A1]">
            <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="tabular">1x</span>
            <span>login hari ini</span>
          </span>
          <span className="px-frame flex h-10 items-center gap-2 bg-white px-3.5 font-mono text-xs font-bold text-[#BE123C]" style={{ ["--px-line" as string]: "#FDA4AF" }}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Keluar</span>
          </span>
        </div>
      </header>
      <main className="relative w-full flex-1 overflow-hidden">
        {compact ? (
          <div className="h-full w-full px-6 py-3">{children}</div>
        ) : (
          <div className="mx-auto w-full max-w-6xl px-8 py-6" style={{ transform: `translateY(${-scroll}px)` }}>
            {children}
          </div>
        )}
      </main>
    </div>
    {overlay}
  </div>
);

/* ------------------------------------------------------------------ */
/* Kartu kelas hari ini (TodayClassCard.tsx)                            */
/* ------------------------------------------------------------------ */

export type ClassStatus = "waiting" | "open" | "submitting" | "present";

export const TodayClassCard: React.FC<{
  t: number;
  item: (typeof CLASSES)[number];
  timingLabel: string;
  status: ClassStatus;
  openAt: string;
  anchor?: string;
  press?: boolean;
  compact?: boolean;
}> = ({ t, item, timingLabel, status, openAt, anchor, press, compact }) => {
  const present = status === "present";
  const chip =
    status === "present"
      ? { text: "Sudah absen", tone: "bg-[#0F766E] text-white" }
      : status === "open" || status === "submitting"
        ? { text: "Absen dibuka", tone: "bg-[#0369A1] text-white" }
        : { text: "Belum dimulai", tone: "bg-[#F0F7FB] text-secondary" };
  return (
    <article
      data-anchor={anchor}
      className={`relative flex flex-col bg-white ${compact ? "p-4" : "p-5"} ${
        present ? "shadow-[0_0_0_2px_#0F766E,5px_5px_0_0_#CCEBE5]" : "shadow-[0_0_0_2px_#CFE2EE,5px_5px_0_0_#EAF3F9]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="bg-[#0369A1]/10 px-2 py-0.5 font-mono text-[11px] font-bold text-[#0369A1]">{item.kode}</span>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-bold ${chip.tone}`}>
              {present && <CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
              {(status === "open" || status === "submitting") && <BlinkBlock t={t} className="h-1.5 w-1.5 bg-current" />}
              {chip.text}
            </span>
          </div>
          <h3 className="mt-2 text-base font-bold leading-snug text-foreground">{item.nama}</h3>
        </div>
        <span className="shrink-0 bg-[#F0F7FB] px-2 py-1 font-mono text-[11px] font-semibold text-secondary">{item.sks} SKS</span>
      </div>
      <dl className="mt-3 space-y-1.5 text-[13px]">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-[#0369A1]" aria-hidden="true" />
          <dd className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono font-semibold text-foreground">{item.jam}</span>
            <span className="text-xs text-secondary">{timingLabel}</span>
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 shrink-0 text-[#0369A1]" aria-hidden="true" />
          <dd className="text-foreground">{item.roomLabel}</dd>
        </div>
      </dl>
      <div className="mt-4 grid gap-2">
        {present ? (
          <p className="inline-flex min-h-11 items-center justify-center gap-2 bg-[#0F766E]/10 text-sm font-bold text-[#0F766E]">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Kamu sudah absen
          </p>
        ) : status === "open" || status === "submitting" ? (
          <span
            data-anchor={anchor ? `${anchor}-btn` : undefined}
            className="px-btn-success inline-flex min-h-12 items-center justify-center gap-2 px-4 text-sm font-bold text-white"
            style={press ? ({ ["--off" as string]: "1px", transform: "translate(2px, 2px)" } as React.CSSProperties) : undefined}
          >
            {status === "submitting" ? <Spin t={t} className="h-4 w-4" /> : <UserCheck className="h-4 w-4" aria-hidden="true" />}
            {status === "submitting" ? "Mengirim presensi..." : "Absen sekarang"}
          </span>
        ) : (
          <p className="inline-flex min-h-11 items-center justify-center gap-2 bg-px-tint px-3 text-center text-xs font-semibold text-secondary">
            Absen dibuka dosen sekitar {openAt}
          </p>
        )}
        <span className="text-center text-xs font-semibold text-[#0369A1]">Riwayat & rangkuman pertemuan</span>
      </div>
    </article>
  );
};

/* ------------------------------------------------------------------ */
/* Ringkasan (dashboard/page.tsx) versi desktop                         */
/* ------------------------------------------------------------------ */

const MetricCard: React.FC<{
  label: string;
  icon: typeof GraduationCap;
  value: string;
  suffix?: string;
  note: string;
  tone?: "ok" | "warn";
  anchor: string;
  style?: React.CSSProperties;
}> = ({ label, icon: Icon, value, suffix, note, tone = "ok", anchor, style }) => (
  <div data-anchor={anchor} className="min-w-0 bg-white p-4 shadow-[0_0_0_2px_#CFE2EE,4px_4px_0_0_#EAF3F9]" style={style}>
    <div className="flex items-center gap-2">
      <span className={`flex h-7 w-7 shrink-0 items-center justify-center ${tone === "warn" ? "bg-[#9A3412]/10 text-[#9A3412]" : "bg-[#0369A1]/10 text-[#0369A1]"}`}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="truncate text-[13px] font-semibold text-secondary">{label}</span>
    </div>
    <div className="mt-2.5 flex items-baseline gap-1">
      <span className="font-display text-[1.7rem] font-bold leading-none text-foreground">{value}</span>
      {suffix && <span className="font-mono text-[11px] text-secondary">{suffix}</span>}
    </div>
    <p className={`mt-1.5 truncate text-xs ${tone === "warn" ? "font-semibold text-[#9A3412]" : "text-secondary"}`}>{note}</p>
  </div>
);

export const RingkasanDesktop: React.FC<{ t: number; load: number; ipk: string; tablet?: boolean }> = ({ t, load, ipk, tablet }) => {
  const at = (i: number) => riseStyle(t, load + i * 0.08, 0.6, 14);
  return (
    <div className="space-y-7" style={pageIn(t, load)}>
      <section data-anchor="hero" className="overflow-hidden bg-white shadow-[0_0_0_2px_#163A55,6px_6px_0_0_#9CC6E0]" style={at(0)}>
        <div
          data-anchor="hero-band"
          className="relative px-6 pb-6 pt-5 text-white"
          style={{
            backgroundColor: "#0369A1",
            backgroundImage: "radial-gradient(rgba(255,255,255,.14) 1.5px, transparent 1.5px), linear-gradient(135deg, #0369A1 0%, #075985 60%, #0B2D46 100%)",
            backgroundSize: "14px 14px, 100% 100%",
          }}
        >
          <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">{DEMO.tanggal}</p>
          <h1 className="mt-1.5 text-3xl font-display font-bold leading-tight tracking-tight">Selamat pagi, {DEMO.nama}</h1>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-white/85">
            <span className="font-mono font-semibold text-white">{DEMO.nim}</span>
            <span>·</span>
            <span>
              {DEMO.prodi} {DEMO.kelas}
            </span>
            <span>·</span>
            <span>Semester {DEMO.semester}</span>
            <span>·</span>
            <span>{DEMO.kampus}</span>
          </p>
        </div>
        <div data-anchor="spotlight" className="flex items-center gap-3 border-b-2 border-[#EAF3F9] px-6 py-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#0369A1]/10 text-[#0369A1]">
            <Clock className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#0369A1]">Kelas berikutnya</span>
            <span className="block truncate text-[15px] font-bold text-foreground">{CLASSES[0].nama}</span>
            <span className="block truncate text-xs text-secondary">Dimulai 20 menit lagi · {CLASSES[0].roomLabel}</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
        </div>
        <nav className="grid grid-cols-4 gap-1 px-4 py-2.5">
          {[
            { label: "Jadwal", icon: CalendarDays },
            { label: "Presensi", icon: UserCheck },
            { label: "Tugas", icon: CheckSquare },
            { label: "Komunitas", icon: MessagesSquare },
          ].map(({ label, icon: Icon }) => (
            <span key={label} className="flex flex-col items-center gap-1.5 py-1.5 text-center">
              <span className="flex h-11 w-11 items-center justify-center bg-[#EAF3F9] text-[#0369A1] shadow-[0_0_0_2px_#CFE2EE]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <span className="text-[12px] font-semibold text-foreground">{label}</span>
            </span>
          ))}
        </nav>
      </section>

      <div className={`grid gap-3 ${tablet ? "grid-cols-2" : "grid-cols-4"}`}>
        <MetricCard anchor="m-ipk" label="IPK" icon={GraduationCap} value={ipk} suffix="/ 4.00" note={`${DEMO.sksLulus} SKS lulus`} style={at(1)} />
        <MetricCard anchor="m-absen" label="Absen" icon={UserCheck} value="0/2" note="Menunggu jam kuliah" style={at(1.5)} />
        <MetricCard anchor="m-tugas" label="Tugas" icon={CheckSquare} value="3" note="Deadline 9 jam lagi" tone="warn" style={at(2)} />
        <MetricCard anchor="m-kelas" label="Kelas" icon={CalendarDays} value="2" note="2 lagi hari ini" style={at(2.5)} />
      </div>

      <section style={at(3)}>
        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-2">
            <Clock className="h-5 w-5 shrink-0 text-[#0369A1]" aria-hidden="true" />
            <h2 className="text-lg font-display font-bold tracking-tight text-foreground">Kelas Hari Senin</h2>
          </div>
          <span className="text-xs font-semibold text-[#0369A1]">Lihat semua jadwal</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <TodayClassCard t={t} item={CLASSES[0]} timingLabel="Dimulai 20 menit lagi" status="waiting" openAt="08.00" />
          <TodayClassCard t={t} item={CLASSES[1]} timingLabel="Hari ini pukul 10.30" status="waiting" openAt="10.30" />
        </div>
      </section>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Halaman Tugas (dashboard/tugas/page.tsx)                             */
/* ------------------------------------------------------------------ */

const TONE_CLASS = {
  overdue: "bg-[#BE123C] text-white",
  urgent: "bg-[#9A3412] text-white",
  soon: "bg-[#FFF7ED] text-[#9A3412]",
  later: "bg-[#F0F7FB] text-[#075985]",
};

const TaskCard: React.FC<{
  task: (typeof TASKS)[number];
  done?: boolean;
  anchor: string;
  style?: React.CSSProperties;
  chipFlash?: number;
  submitPress?: boolean;
  submitHover?: boolean;
}> = ({ task, done, anchor, style, chipFlash = 0, submitPress, submitHover }) => {
  const urgent = !done && task.tone === "urgent";
  const btnStyle: React.CSSProperties = submitPress
    ? ({ ["--px-off" as string]: "1px", transform: "translate(2px, 2px)" } as React.CSSProperties)
    : submitHover
      ? ({ ["--px-off" as string]: "6px", transform: "translate(-2px, -2px)" } as React.CSSProperties)
      : {};
  return (
    <article
      data-anchor={anchor}
      className="glass-card flex h-full flex-col p-5"
      style={{
        ...(done
          ? { ["--px-line" as string]: "#99D5CC", ["--px-drop" as string]: "#CCEBE6" }
          : urgent
            ? { ["--px-line" as string]: "#FDBA74", ["--px-drop" as string]: "#FFEDD5" }
            : {}),
        ...style,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 truncate font-mono text-[11px] font-bold uppercase tracking-wide text-[#0369A1]">{task.mk}</p>
        {done ? (
          <span className="inline-flex shrink-0 items-center gap-1 bg-[#0F766E] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
            <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
            Dikumpul
          </span>
        ) : (
          <span
            data-anchor={`${anchor}-chip`}
            className={`shrink-0 px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${TONE_CLASS[task.tone]}`}
            style={{ transform: `scale(${1 + chipFlash * 0.18})`, boxShadow: chipFlash > 0 ? `0 0 0 ${2 + chipFlash * 2}px rgba(154,52,18,${0.35 * chipFlash})` : undefined }}
          >
            {task.chip}
          </span>
        )}
      </div>
      <h2 className="mt-1.5 text-base font-bold leading-snug text-foreground">{task.judul}</h2>
      <p className="mt-0.5 text-xs text-secondary">{task.meta}</p>
      <p className="mt-3 text-sm leading-relaxed text-secondary">{task.desc}</p>
      <div className="mt-3 flex items-center gap-2 border-t-2 border-dashed border-px-soft pt-3 text-xs">
        <Clock className={`h-3.5 w-3.5 shrink-0 ${done ? "text-secondary" : "text-[#9A3412]"}`} aria-hidden="true" />
        <span className="text-secondary">Batas</span>
        <span className={`font-mono font-semibold ${done ? "text-foreground" : "text-[#9A3412]"}`}>{task.batas}</span>
        {done && <span className="ml-auto bg-[#F0F7FB] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-secondary">Belum dinilai</span>}
      </div>
      <div className="mt-auto grid grid-cols-2 gap-3 pt-4">
        <span className="px-btn-ghost inline-flex min-h-11 items-center justify-center gap-1.5 px-3 text-xs font-semibold">
          <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          Lihat Soal
        </span>
        <span
          data-anchor={`${anchor}-submit`}
          className={`${done ? "px-btn-ghost" : "px-btn"} inline-flex min-h-11 items-center justify-center gap-1.5 px-3 text-xs font-bold`}
          style={btnStyle}
        >
          {done ? <Edit3 className="h-3.5 w-3.5" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
          {done ? "Ubah Link" : "Kumpulkan"}
        </span>
      </div>
    </article>
  );
};

export const TugasPage: React.FC<{
  t: number;
  load: number;
  firstDone: boolean;
  success: number;
  chipFlash: (i: number) => number;
  submitPress: boolean;
  submitHover: boolean;
  /** 0..1: tugas pertama keluar dari daftar "Belum", kartu lain bergeser mengisi tempatnya. */
  flip?: number;
  slots?: { x: number; y: number }[];
}> = ({ t, load, firstDone, success, chipFlash, submitPress, submitHover, flip = 0, slots }) => {
  const tabs = [
    { label: "Belum", count: firstDone ? 2 : 3, active: "bg-[#9A3412]", on: true },
    { label: "Selesai", count: firstDone ? 3 : 2, active: "bg-[#0F766E]", on: false },
    { label: "Semua", count: 5, active: "bg-[#0369A1]", on: false },
  ];
  return (
    <div className="space-y-6" style={pageIn(t, load)}>
      <PageHeader title="Tugas Kuliah & Deadline" description="5 tugas semester ini, langsung dari MyBest." />
      <div className="grid grid-cols-3 gap-1 bg-px-tint p-1 shadow-[0_-2px_0_0_#CFE2EE,0_2px_0_0_#CFE2EE,-2px_0_0_0_#CFE2EE,2px_0_0_0_#CFE2EE]" style={{ width: "26rem" }}>
        {tabs.map((tab) => (
          <span
            key={tab.label}
            className={`flex min-h-10 items-center justify-center px-2 font-mono text-xs font-bold ${tab.on ? `${tab.active} text-white shadow-[2px_2px_0_0_#072033]` : "text-secondary"}`}
          >
            {tab.label} ({tab.count})
          </span>
        ))}
      </div>
      {success > 0 && (
        <div
          className="px-frame flex items-center justify-between gap-3 bg-[#F0FDF4] p-3 text-sm text-[#0F766E]"
          style={{ ["--px-line" as string]: "#99D5CC", opacity: success, transform: `translateY(${(1 - success) * -8}px)` } as React.CSSProperties}
        >
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            Tugas berhasil dikumpulkan ke MyBest!
          </span>
          <X className="h-4 w-4 text-secondary" />
        </div>
      )}
      <div className="grid grid-cols-2 gap-5 p-[2px]">
        {TASKS.map((task, i) => {
          let style = riseStyle(t, load + 0.12 + i * 0.12, 0.6, 18);
          if (flip > 0 && slots && slots.length === 3) {
            if (i === 0) {
              const out = Math.min(1, flip * 2.2);
              style = { opacity: 1 - out, transform: `scale(${1 - 0.05 * out})` };
            } else {
              const move = Math.max(0, Math.min(1, (flip - 0.25) / 0.75));
              const dx = (slots[i - 1].x - slots[i].x) * move;
              const dy = (slots[i - 1].y - slots[i].y) * move;
              style = { transform: `translate(${dx}px, ${dy}px)` };
            }
          }
          return (
            <TaskCard
              key={task.judul}
              task={task}
              anchor={`task-${i}`}
              done={i === 0 && firstDone}
              chipFlash={chipFlash(i)}
              submitPress={i === 0 && submitPress}
              submitHover={i === 0 && submitHover}
              style={style}
            />
          );
        })}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Panel samping Kumpulkan (SideSheet + LinkCard)                       */
/* ------------------------------------------------------------------ */

export const SubmitSheet: React.FC<{
  t: number;
  open: number;
  linkText: string;
  focus: boolean;
  check: "none" | "checking" | "public";
  sendPress: boolean;
  sendHover: boolean;
  pasteFlash: number;
}> = ({ t, open, linkText, focus, check, sendPress, sendHover, pasteFlash }) => {
  if (open <= 0) return null;
  const color = check === "public" ? "#99D5CC" : "#D9E5ED";
  const sendStyle: React.CSSProperties = sendPress
    ? ({ ["--px-off" as string]: "1px", transform: "translate(2px, 2px)" } as React.CSSProperties)
    : sendHover
      ? ({ ["--px-off" as string]: "6px", transform: "translate(-2px, -2px)" } as React.CSSProperties)
      : {};
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 60 }}>
      <div style={{ position: "absolute", inset: 0, background: `rgba(7,32,51,${0.5 * open})` }} />
      <div
        data-anchor="sheet"
        className="absolute right-0 top-0 flex h-full flex-col bg-white"
        style={{ width: 576, borderLeft: "2px solid #163A55", boxShadow: "-6px 0 0 0 #0369A1", transform: `translateX(${(1 - open) * 105}%)` }}
      >
        <div className="flex shrink-0 items-start gap-3 border-b-2 border-px-soft bg-px-tint p-4">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#0369A1]">Pengumpulan Tugas MyBest</p>
            <h3 className="break-words text-base font-display font-bold leading-snug text-foreground">{TASKS[0].judul}</h3>
            <p className="mt-0.5 break-words text-xs text-secondary">PEMROGRAMAN WEB · Pertemuan 5</p>
          </div>
          <span className="px-frame flex min-h-11 min-w-11 shrink-0 items-center justify-center bg-white text-secondary" style={{ ["--px-line" as string]: "#CFE2EE" }}>
            <X className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden p-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <span className="block text-xs font-bold uppercase tracking-wider text-foreground">
                Link / URL Tugas Mahasiswa <span className="text-[#BE123C]">*</span>
              </span>
              <div
                data-anchor="sheet-input"
                data-focus={focus}
                className="px-input flex min-h-12 w-full items-center px-4 py-2.5 text-sm text-foreground"
                style={{ background: pasteFlash > 0 ? `rgba(220,235,245,${pasteFlash})` : "#fff" }}
              >
                {linkText ? (
                  <span className="truncate font-mono text-[13px]">{linkText}</span>
                ) : (
                  <span className="text-secondary/60">https://drive.google.com/... atau https://youtu.be/...</span>
                )}
                {focus && <BlinkBlock t={t} style={{ width: 2, height: 18, background: "#072033", marginLeft: 2, flex: "none" }} />}
              </div>
              <p className="text-[11px] leading-relaxed text-secondary">
                Tempel link Google Drive, Docs, GitHub, atau video YouTube; link dirapikan dan dicek otomatis. Pastikan video YouTube disetel ke <em>Publik</em> atau{" "}
                <em>Tidak Publik (Hanya yang punya link)</em>, jangan <em>Pribadi</em>.
              </p>
            </div>
            {check !== "none" && (
              <div className="space-y-2" style={riseStyle(t, 0, 0.01)}>
                <div
                  data-anchor="linkcard"
                  className="flex items-center gap-3 bg-white p-3"
                  style={{ boxShadow: `0 -2px 0 0 ${color}, 0 2px 0 0 ${color}, -2px 0 0 0 ${color}, 2px 0 0 0 ${color}` }}
                >
                  <span className="px-icon h-10 w-10 shrink-0">
                    <FileText className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 truncate text-sm font-bold text-foreground">{check === "public" ? "tugas2-form-registrasi.zip" : "Berkas Google Drive"}</p>
                      {check === "checking" ? (
                        <span className="inline-flex shrink-0 items-center gap-1 bg-[#F0F7FB] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-secondary">
                          <Spin t={t} className="h-3 w-3" />
                          Mengecek
                        </span>
                      ) : (
                        <span data-anchor="link-pill" className="inline-flex shrink-0 items-center gap-1 bg-[#0F766E] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                          Publik
                        </span>
                      )}
                    </div>
                    <p className="truncate font-mono text-[11px] text-secondary">{check === "public" ? "Berkas Google Drive · 1Qm8vR…7nWp3s" : "1Qm8vR…7nWp3s"}</p>
                  </div>
                </div>
                {check === "public" && (
                  <p data-anchor="link-msg" className="flex items-center gap-1.5 text-xs text-[#0F766E]">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    Link publik: siapa pun yang punya link bisa membukanya.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  {check === "public" && (
                    <span className="px-btn inline-flex min-h-11 items-center justify-center gap-1.5 px-3 text-xs font-bold">
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      Pratinjau
                    </span>
                  )}
                  <span className="px-btn-ghost inline-flex min-h-11 items-center justify-center gap-1.5 px-3 text-xs font-bold">
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    Buka
                  </span>
                  <span className="px-btn-ghost inline-flex min-h-11 items-center justify-center gap-1.5 px-3 text-xs font-bold">
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    Salin link
                  </span>
                  <span className="px-btn-ghost inline-flex min-h-11 items-center justify-center gap-1.5 px-3 text-xs font-bold">
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Cek ulang
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="shrink-0 border-t-2 border-dashed border-px-soft bg-white p-4">
          <div className="flex justify-end gap-3">
            <span className="px-btn-ghost inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-sm font-semibold">Batal</span>
            <span data-anchor="sheet-send" className="px-btn inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold" style={sendStyle}>
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              Kirim Tugas
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export { EASE_PX, prog };
