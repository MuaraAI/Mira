"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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
  Sparkles,
  Building2,
  Layers,
  ChevronRight,
  ShieldCheck,
  BellRing,
  KeyRound,
  FileSpreadsheet,
  Repeat,
  Newspaper,
  LogOut,
  X,
  ExternalLink,
  Ellipsis,
  Menu,
} from "lucide-react";
import { Monogram } from "@/components/Monogram";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  active?: boolean;
  badge?: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}
interface MetricCardProps {
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
  value: string;
  suffix?: string;
  note: string;
  tone?: "ok" | "warn";
  onClick?: () => void;
}

function MetricCard({
  label,
  icon: Icon,
  value,
  suffix,
  note,
  tone = "ok",
  onClick,
}: MetricCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`glass-card p-4 text-left transition-all hover:bg-[#F0F7FB] flex flex-col justify-between ${
        tone === "warn" ? "border-l-4 border-l-[#9A3412]" : "border-l-4 border-l-[#0369A1]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs uppercase tracking-wider text-secondary">{label}</span>
        <div
          className={`p-1.5 rounded-sm ${
            tone === "warn" ? "bg-[#9A3412]/10 text-[#9A3412]" : "bg-[#0369A1]/10 text-[#0369A1]"
          }`}
        >
          <Icon className="w-4 h-4" aria-hidden="true" />
        </div>
      </div>
      <div className="mt-2">
        <div className="flex items-baseline gap-1">
          <span className="font-display text-2xl font-bold text-foreground">{value}</span>
          {suffix && <span className="font-mono text-xs text-secondary">{suffix}</span>}
        </div>
        <p className="mt-1 text-[11px] text-secondary truncate">{note}</p>
      </div>
    </button>
  );
}

export default function DemoPage() {
  const [now, setNow] = useState(() => new Date());
  const [isSecondClassPresent, setIsSecondClassPresent] = useState(false);
  const [isTaskDone, setIsTaskDone] = useState(false);
  const [demoMessage, setDemoMessage] = useState<string | null>(null);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const hour = now.getHours();
  const greetingText =
    hour < 11
      ? "Selamat pagi"
      : hour < 15
        ? "Selamat siang"
        : hour < 18
          ? "Selamat sore"
          : "Selamat malam";

  const daysIndo = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const monthsIndo = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];
  const formattedToday = `${daysIndo[now.getDay()]}, ${now.getDate()} ${monthsIndo[now.getMonth()]} ${now.getFullYear()}`;

  function triggerDemoFeedback(msg: string) {
    setDemoMessage(msg);
    setTimeout(() => {
      setDemoMessage((prev) => (prev === msg ? null : prev));
    }, 4000);
  }

  const navGroups: NavGroup[] = [
    {
      title: "Utama",
      items: [
        { href: "/demo", label: "Ringkasan", icon: Layers, active: true },
        { href: "/login", label: "Komunitas", icon: MessagesSquare, badge: "Baru" },
      ],
    },
    {
      title: "Perkuliahan",
      items: [
        { href: "/login", label: "Jadwal Kuliah", icon: CalendarDays },
        { href: "/login", label: "Tugas Kuliah", icon: CheckSquare },
        { href: "/login", label: "Presensi Kehadiran", icon: UserCheck },
        { href: "/login", label: "Kuliah Pengganti", icon: Repeat },
        { href: "/login", label: "Bahan Ajar", icon: BookOpen },
        { href: "/login", label: "Kuis Perkuliahan", icon: HelpCircle },
      ],
    },
    {
      title: "Akademik",
      items: [
        { href: "/login", label: "Nilai & KHS", icon: GraduationCap },
        { href: "/login", label: "Kartu KRS", icon: FileSpreadsheet },
        { href: "/login", label: "Kartu Ujian", icon: Award },
      ],
    },
    {
      title: "Layanan Kampus",
      items: [
        { href: "/login", label: "Agenda Kampus", icon: CalendarDays, badge: "Live" },
        { href: "/login", label: "Berita Kampus", icon: Newspaper },
        { href: "/login", label: "Perpustakaan OPAC", icon: Library },
      ],
    },
    {
      title: "Pengaturan & Integrasi",
      items: [
        { href: "/login", label: "Personal API Keys", icon: KeyRound },
        { href: "/login", label: "Notifikasi Webhook", icon: BellRing },
        { href: "/login", label: "Sesi & Keamanan", icon: ShieldCheck },
      ],
    },
  ];

  const presentCount = 1 + (isSecondClassPresent ? 1 : 0);

  return (
    <div className="portal-type min-h-screen bg-background text-foreground flex flex-col lg:flex-row">
      {/* 1. Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:z-30 lg:w-64 bg-white border-r-2 border-px-soft">
        <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b-2 border-px-soft">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="px-frame flex h-9 w-9 items-center justify-center overflow-hidden bg-white [--px-line:#CFE2EE]">
              <Monogram className="h-7 w-7 transition-transform duration-200 group-hover:scale-110" />
            </span>
            <span className="flex flex-col">
              <span className="font-display text-base font-bold leading-none tracking-tight text-foreground">
                Mira
              </span>
              <span className="mt-1 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#0369A1]">
                Mode Demo
              </span>
            </span>
          </Link>
          <span className="px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-800 font-mono text-[10px] font-bold uppercase">
            Simulasi
          </span>
        </div>

        <nav
          aria-label="Navigasi sidebar demo"
          className="scroll-slim flex-1 space-y-3 overflow-y-auto py-3 px-3"
        >
          {navGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-1 flex items-center gap-2 px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-secondary/80">
                <span className="h-1.5 w-1.5 bg-px-water" aria-hidden="true" />
                {group.title}
              </p>
              <ul className="space-y-px">
                {group.items.map((item) => (
                  <li key={item.label}>
                    {item.active ? (
                      <span className="flex min-h-8 items-center gap-2.5 px-2.5 font-mono text-xs bg-px-highlight font-semibold text-foreground shadow-[inset_3px_0_0_#0369A1]">
                        <item.icon className="h-4 w-4 shrink-0 text-[#0369A1]" aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </span>
                    ) : (
                      <Link
                        href="/login"
                        onClick={() =>
                          triggerDemoFeedback(
                            `Menu "${item.label}" memerlukan login akun UBSI aktif. Masuk ke halaman login untuk mencoba.`
                          )
                        }
                        className="flex min-h-8 items-center gap-2.5 px-2.5 font-mono text-xs font-medium text-secondary hover:bg-[#F0F7FB] hover:text-foreground transition-colors group"
                      >
                        <item.icon
                          className="h-4 w-4 shrink-0 text-secondary group-hover:text-foreground"
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.label}</span>
                        {item.badge && (
                          <span className="ml-auto px-1.5 py-0.5 font-mono text-[10px] bg-white border border-[#CFE2EE] text-[#0369A1]">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* User Badge Footer */}
        <div className="p-3 border-t-2 border-px-soft bg-[#F7FAFC]">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-xs truncate text-foreground">Dinda Putri Lestari</p>
              <p className="font-mono text-[10px] text-secondary">NIM: 15230789</p>
            </div>
            <Link
              href="/login"
              className="px-2 py-1 bg-[#0369A1] hover:bg-[#075985] text-white text-[11px] font-bold rounded-sm transition-all"
            >
              Login
            </Link>
          </div>
        </div>
      </aside>

      {/* 2. Mobile Navigation Topbar */}
      <header className="lg:hidden sticky top-0 z-40 flex h-16 items-center justify-between px-4 bg-white/95 backdrop-blur-xl border-b-2 border-px-soft">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="flex items-center gap-2">
            <span className="px-frame flex h-9 w-9 items-center justify-center bg-white [--px-line:#CFE2EE]">
              <Monogram className="h-7 w-7" />
            </span>
            <span className="font-display font-bold text-sm text-foreground">Mira Demo</span>
          </Link>
          <span className="px-1.5 py-0.5 rounded-sm bg-amber-100 text-amber-800 font-mono text-[10px] font-bold uppercase">
            Simulasi
          </span>
        </div>

        <button
          type="button"
          onClick={() => setMobileDrawerOpen(true)}
          className="p-2 text-secondary hover:text-foreground hover:bg-[#F0F7FB] rounded-sm lg:hidden"
          aria-label="Buka menu navigasi demo"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#0369A1] text-white text-xs font-bold rounded-sm shadow-sm"
          >
            <span>Login Asli</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      </header>

      {/* 3. Main Dashboard Wrapper */}
      <div className="flex-1 flex flex-col min-w-0 lg:pl-64">
        {/* Desktop Sticky Subheader */}
        <header className="hidden lg:flex sticky top-0 z-20 h-16 items-center justify-between px-8 bg-white/85 backdrop-blur-xl border-b-2 border-px-soft">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="font-semibold text-secondary">Dashboard</span>
            <span className="text-px-water" aria-hidden="true">
              /
            </span>
            <span className="font-semibold text-foreground">Ringkasan (Demo Interaktif)</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] text-xs font-mono font-bold">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Simulasi 100% Statis (Tanpa API)</span>
            </span>

            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0369A1] hover:bg-[#075985] text-white text-xs font-bold transition-all shadow-sm"
            >
              <span>Masuk Akun Mahasiswa</span>
              <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          </div>
        </header>

        {/* Content Body */}
        <main
          id="main-content"
          className="dashboard-main flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-8 space-y-7"
        >
          {/* Feedback Toast */}
          {demoMessage && (
            <div
              className="p-4 bg-[#0369A1] text-white text-xs font-semibold rounded-sm shadow-lg flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2"
              role="status"
            >
              <span>{demoMessage}</span>
              <button
                type="button"
                onClick={() => setDemoMessage(null)}
                className="p-1 hover:bg-white/20 rounded-sm"
                aria-label="Tutup pesan"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Banner Mode Demo Interaktif */}
          <div className="px-card bg-amber-50 border-2 border-dashed border-amber-300 p-4 text-xs text-amber-950">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-200/80 px-1.5 py-0.5">
                  Mode Demo
                </span>
                <span>
                  Ini adalah simulasi statis lengkap dasbor akademik Mira. Seluruh data berjalan cepat tanpa
                  memanggil API kampus.
                </span>
              </div>
              <Link
                href="/login"
                className="font-mono font-bold text-amber-900 underline hover:text-amber-700"
              >
                Coba dengan Akun Asli →
              </Link>
            </div>
          </div>

          {/* 1. Hero Card */}
          <section
            className="overflow-hidden bg-white shadow-[0_0_0_2px_#163A55,6px_6px_0_0_#9CC6E0]"
            aria-label="Ringkasan hari ini"
          >
            <div
              className="relative px-4 pb-5 pt-4 text-white sm:px-6 sm:pb-6 sm:pt-5"
              style={{
                backgroundColor: "#0369A1",
                backgroundImage:
                  "radial-gradient(rgba(255,255,255,.14) 1.5px, transparent 1.5px), linear-gradient(135deg, #0369A1 0%, #075985 60%, #0B2D46 100%)",
                backgroundSize: "14px 14px, 100% 100%",
              }}
            >
              <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                {formattedToday}
              </p>
              <h1 className="mt-1.5 break-words text-[1.6rem] font-display font-bold leading-tight tracking-tight sm:text-3xl">
                {greetingText}, Dinda
              </h1>
              <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-white/85">
                <span className="font-mono font-semibold text-white">15230789</span>
                <span aria-hidden="true">·</span>
                <span>Teknik Informatika (S1) 15.3A.01</span>
                <span aria-hidden="true">·</span>
                <span>Semester 3</span>
                <span aria-hidden="true" className="hidden sm:inline">
                  ·
                </span>
                <span className="hidden sm:inline">UBSI Pontianak</span>
              </p>
            </div>

            {/* Sorotan Kelas Sekarang */}
            <div className="flex items-center gap-3 border-b-2 border-[#EAF3F9] px-4 py-3.5 transition-colors hover:bg-[#F7FAFC] sm:px-6">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#0369A1]/10 text-[#0369A1]"
                aria-hidden="true"
              >
                <Radio className="h-5 w-5 text-[#0369A1] animate-pulse" />
              </span>
              <div className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#0369A1]">
                  Sesi Kuliah Aktif
                </span>
                <span className="block truncate text-[15px] font-bold text-foreground">
                  Pemrograman Web (INF101)
                </span>
                <span className="block truncate text-xs text-secondary">
                  08:00 - 10:30 WIB · Laboratorium Komputer 1 (LAB 1)
                </span>
              </div>
              <span className="px-2 py-1 text-[11px] font-mono font-bold bg-[#0F766E]/10 text-[#0F766E] border border-[#0F766E]/30 shrink-0">
                Presensi Terverifikasi
              </span>
            </div>

            {/* Pintasan Cepat */}
            <nav aria-label="Pintasan cepat" className="grid grid-cols-4 gap-1 px-2 py-2.5 sm:px-4">
              {[
                { label: "Jadwal", icon: CalendarDays },
                { label: "Presensi", icon: UserCheck },
                { label: "Tugas", icon: CheckSquare },
                { label: "Komunitas", icon: MessagesSquare },
              ].map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    triggerDemoFeedback(
                      `Fitur "${label}" aktif di akun asli. Masuk via tombol Login untuk melihat seluruh jadwal.`
                    )
                  }
                  className="group flex flex-col items-center gap-1.5 py-1.5 text-center cursor-pointer"
                >
                  <span className="flex h-11 w-11 items-center justify-center bg-[#EAF3F9] text-[#0369A1] shadow-[0_0_0_2px_#CFE2EE] transition-all group-hover:-translate-y-0.5 group-hover:bg-[#0369A1] group-hover:text-white">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="text-[12px] font-semibold text-foreground">{label}</span>
                </button>
              ))}
            </nav>
          </section>

          {/* 2. Metrik Ringkas */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricCard
              label="IPK"
              icon={GraduationCap}
              value="3.85"
              suffix="/ 4.00"
              note="48 SKS lulus kumulatif"
              onClick={() => triggerDemoFeedback("Transkrip KHS resmi: IPK 3.85 dengan predikat Pujian.")}
            />
            <MetricCard
              label="Absen"
              icon={UserCheck}
              value={`${presentCount}/2`}
              note={
                isSecondClassPresent ? "Semua kelas hari ini sudah absen" : "1 kelas belum diabsen"
              }
              tone={isSecondClassPresent ? "ok" : "warn"}
              onClick={() =>
                triggerDemoFeedback(
                  isSecondClassPresent
                    ? "Seluruh presensi kelas hari ini lengkap!"
                    : "Klik tombol 'Simulasi Absen Cepat' di bawah untuk mencoba absen."
                )
              }
            />
            <MetricCard
              label="Tugas"
              icon={CheckSquare}
              value={isTaskDone ? "0" : "1"}
              note={isTaskDone ? "Semua tugas beres" : "Deadline 2 hari lagi"}
              tone={isTaskDone ? "ok" : "warn"}
              onClick={() =>
                triggerDemoFeedback(
                  isTaskDone
                    ? "Tugas ERD Database berhasil dikumpulkan."
                    : "Tugas Basis Data menunggu dikerjakan."
                )
              }
            />
            <MetricCard
              label="Kelas"
              icon={CalendarDays}
              value="2"
              note={isSecondClassPresent ? "Semua selesai" : "1 lagi hari ini"}
              onClick={() => triggerDemoFeedback("2 mata kuliah terjadwal pada hari ini.")}
            />
          </div>

          {/* 3. Kelas Hari Ini */}
          <section aria-labelledby="heading-kelas-hari-ini" className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex min-w-0 items-center gap-2">
                <Clock className="h-5 w-5 shrink-0 text-[#0369A1]" aria-hidden="true" />
                <h2
                  id="heading-kelas-hari-ini"
                  className="text-lg font-display font-bold tracking-tight text-foreground"
                >
                  Kelas Hari Ini (2 Mata Kuliah)
                </h2>
              </div>
              <span className="text-xs font-mono font-semibold text-secondary">
                Mode Simulasi Interaktif
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Kelas 1 */}
              <div className="glass-card p-5 border-l-4 border-l-[#0F766E] flex flex-col justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[#0F766E] bg-[#0F766E]/10 px-2 py-0.5">
                      INF101 · 3 SKS
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0F766E]">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                      Sudah Absen
                    </span>
                  </div>
                  <h3 className="font-display font-bold text-base text-foreground">Pemrograman Web</h3>
                  <p className="text-xs text-secondary flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-secondary shrink-0" aria-hidden="true" />
                    <span className="font-mono">08:00 - 10:30 WIB</span>
                    <span>·</span>
                    <Building2 className="w-3.5 h-3.5 text-secondary shrink-0" aria-hidden="true" />
                    <span>Ruang LAB 1</span>
                  </p>
                  <p className="text-[11px] text-secondary font-mono">Dosen: DR. HENDRA, M.KOM (D001)</p>
                </div>

                <div className="pt-3 border-t border-stroke/60 flex items-center justify-between text-xs text-secondary">
                  <span>Kehadiran Pertemuan 7</span>
                  <span className="font-bold text-[#0F766E]">100% Tercatat</span>
                </div>
              </div>

              {/* Kelas 2 (Interaktif) */}
              <div className="glass-card p-5 border-l-4 border-l-[#0369A1] flex flex-col justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs font-bold text-[#0369A1] bg-[#0369A1]/10 px-2 py-0.5">
                      INF201 · 3 SKS
                    </span>
                    {isSecondClassPresent ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0F766E]">
                        <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                        Sudah Absen (Simulasi)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#0369A1] bg-sky-50 px-2 py-0.5 border border-sky-200">
                        <Radio className="w-3.5 h-3.5 animate-pulse" aria-hidden="true" />
                        Sesi Absen Dibuka
                      </span>
                    )}
                  </div>
                  <h3 className="font-display font-bold text-base text-foreground">Basis Data Lanjut</h3>
                  <p className="text-xs text-secondary flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-secondary shrink-0" aria-hidden="true" />
                    <span className="font-mono">10:45 - 13:15 WIB</span>
                    <span>·</span>
                    <Building2 className="w-3.5 h-3.5 text-secondary shrink-0" aria-hidden="true" />
                    <span>Ruang 204</span>
                  </p>
                  <p className="text-[11px] text-secondary font-mono">Dosen: SITI NURHALIZA, M.KOM (D002)</p>
                </div>

                <div className="pt-3 border-t border-stroke/60 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-secondary">
                    {isSecondClassPresent
                      ? "Presensi kehadiran tersimpan"
                      : "Presensi dibuka dosen selama sesi"}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsSecondClassPresent((prev) => !prev);
                      triggerDemoFeedback(
                        !isSecondClassPresent
                          ? "Berhasil! Simulasi presensi kehadiran Basis Data Lanjut tercatat."
                          : "Status presensi di-reset ke belum absen."
                      );
                    }}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold transition-all rounded-sm shadow-sm ${
                      isSecondClassPresent
                        ? "bg-[#F7FAFC] border border-stroke text-secondary hover:text-foreground"
                        : "bg-[#0369A1] hover:bg-[#075985] text-white"
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isSecondClassPresent ? "Batal Absen" : "Simulasi Absen Cepat"}</span>
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* 4. Banner Tugas Terdekat */}
          <section aria-labelledby="heading-tugas-mendesak">
            <div className="p-5 sm:p-6 rounded-md bg-[#FFF7ED] border border-[#FDBA74] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2 rounded-sm bg-[#9A3412]/10 text-[#9A3412] shrink-0 mt-0.5">
                  <AlertTriangle className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <span className="text-[11px] font-mono font-bold text-[#9A3412] uppercase tracking-wider">
                    Pengingat Tugas Kuliah
                  </span>
                  <h3 className="font-bold text-foreground text-base mt-0.5">
                    Tugas 3: Desain ERD & Normalisasi Database Toko Online
                  </h3>
                  <p className="text-xs text-secondary mt-1">
                    Mata Kuliah: Basis Data Lanjut (INF201) | Batas Waktu: 8 November 2026, 23:59 WIB (2 hari
                    lagi)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsTaskDone((v) => !v);
                    triggerDemoFeedback(
                      !isTaskDone
                        ? "Simulasi tugas: file berkas tugas berhasil terkirim ke sistem MyBest!"
                        : "Status tugas dikembalikan ke belum dikumpul."
                    );
                  }}
                  className={`inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-pill text-xs font-bold transition-all ${
                    isTaskDone
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-[#9A3412] hover:bg-[#7C2D12] text-white"
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isTaskDone ? "Tugas Terkumpul ✓" : "Simulasi Kumpul Tugas"}</span>
                </button>
              </div>
            </div>
          </section>

          {/* 5. Banner Jadwal Ujian UTS Aktif */}
          <section aria-labelledby="heading-ujian-terdekat">
            <div className="p-5 sm:p-6 rounded-md bg-[#F0F7FB] border border-[#CFE2EE] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2 rounded-sm bg-[#0369A1]/10 text-[#0369A1] shrink-0 mt-0.5">
                  <Award className="w-5 h-5" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-[#0369A1] uppercase tracking-wider bg-white px-2 py-0.5 border border-[#CFE2EE]">
                      Jadwal Ujian Online (UTS)
                    </span>
                    <span className="text-xs font-mono font-bold text-[#0369A1]">6 Mata Kuliah</span>
                  </div>
                  <h3 id="heading-ujian-terdekat" className="font-bold text-foreground text-base mt-1">
                    Ujian Tengah Semester Terjadwal
                  </h3>
                  <p className="text-xs text-secondary mt-0.5">
                    Ujian terdekat dimulai 10 November 2026:{" "}
                    <span className="font-semibold text-foreground">Bahasa Inggris I</span> (Ruang EN2-P1).
                  </p>
                </div>
              </div>

              <Link
                href="/login"
                onClick={() =>
                  triggerDemoFeedback(
                    "Kartu Ujian online resmi menampilkan nomor ruang ujian, durasi, dan download PDF bukti ujian."
                  )
                }
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-pill bg-[#0369A1] hover:bg-[#075985] text-white text-xs font-bold transition-all shrink-0"
              >
                <span>Lihat Jadwal Ujian</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </section>

          {/* 6. Banner Agenda Kampus */}
          <section aria-labelledby="heading-agenda-terdekat">
            <div className="p-5 sm:p-6 rounded-md bg-[#F0F7FB] border border-[#CFE2EE] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="p-2 rounded-sm bg-[#0369A1]/10 text-[#0369A1] shrink-0 mt-0.5">
                  <CalendarDays className="w-5 h-5" aria-hidden="true" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono font-bold text-[#0369A1] uppercase tracking-wider bg-white px-2 py-0.5 border border-[#CFE2EE]">
                      Agenda Kampus UBSI
                    </span>
                    <span className="text-xs font-mono font-bold text-[#9A3412]">H-4 Menuju Ujian</span>
                  </div>
                  <h3 className="font-bold text-foreground text-base mt-1">
                    Ujian Tengah Semester (UTS) Ganjil 2026/2027
                  </h3>
                  <p className="text-xs text-secondary mt-0.5">
                    Pelaksanaan: 10 November 2026 s.d. 21 November 2026
                  </p>
                </div>
              </div>

              <Link
                href="/login"
                onClick={() =>
                  triggerDemoFeedback(
                    "Kalender kegiatan akademik memuat seluruh jadwal UTS, UAS, wisuda, dan libur kampus."
                  )
                }
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-pill bg-[#0369A1] hover:bg-[#075985] text-white text-xs font-bold transition-all shrink-0"
              >
                <span>Lihat Kalender</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </Link>
            </div>
          </section>

          {/* 7. Akses Cepat Layanan Kampus */}
          <section aria-labelledby="heading-layanan-cepat">
            <h2
              id="heading-layanan-cepat"
              className="text-lg font-display font-bold tracking-tight text-foreground mb-4"
            >
              Akses Cepat Layanan Kampus
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { title: "Bahan Ajar", desc: "Slide & Modul Lab", icon: BookOpen },
                { title: "Kuis Online", desc: "Jadwal & Latihan", icon: HelpCircle },
                { title: "Nilai & KHS", desc: "Transkrip Kumulatif", icon: GraduationCap },
                { title: "Kartu Ujian", desc: "Jadwal UTS & UAS", icon: Award },
                { title: "Perpustakaan", desc: "Katalog Buku OPAC", icon: Library },
              ].map((card) => (
                <button
                  key={card.title}
                  type="button"
                  onClick={() =>
                    triggerDemoFeedback(
                      `Layanan ${card.title} terhubung ke server kampus. Masuk via Login untuk akses penuh.`
                    )
                  }
                  className="glass-card p-4 text-center hover:border-[#0369A1]/40 transition-all hover:bg-[#F0F7FB] flex flex-col items-center justify-center gap-2 group cursor-pointer"
                >
                  <div className="p-2.5 rounded-pill bg-[#0369A1]/10 text-[#0369A1] group-hover:scale-110 transition-transform">
                    <card.icon className="w-5 h-5" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-bold text-foreground">{card.title}</span>
                  <span className="text-[10px] text-secondary">{card.desc}</span>
                </button>
              ))}
            </div>
          </section>

          {/* 8. Call to action to Login */}
          <section className="p-6 bg-gradient-to-r from-[#0369A1] to-[#075985] text-white rounded-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <h3 className="font-display font-bold text-base">Siap Beralih ke Dasbor Asli?</h3>
              <p className="text-xs text-white/85 mt-1">
                Gunakan NIM dan password SIAKAD atau MyBest kamu untuk menikmati sinkronisasi otomatis,
                notifikasi WhatsApp/Telegram, dan presensi sekali klik.
              </p>
            </div>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-5 py-2.5 bg-white text-[#0369A1] hover:bg-[#F0F7FB] text-xs font-bold transition-all shadow-md shrink-0 rounded-pill"
            >
              <span>Login Sekarang</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          </section>
        </main>
      </div>
      {/* 4. Mobile Bottom Navigation Bar */}
      <nav
        aria-label="Navigasi bawah mobile"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-xl border-t-2 border-px-soft pb-[env(safe-area-inset-bottom)]"
      >
        <div className="grid grid-cols-5 h-14">
          <Link
            href="/demo"
            className="flex flex-col items-center justify-center gap-1 font-mono text-[10px] font-semibold text-[#0369A1]"
          >
            <Layers className="h-4 w-4" />
            <span>Ringkasan</span>
          </Link>
          <button
            type="button"
            onClick={() =>
              triggerDemoFeedback(
                "Jadwal kuliah lengkap terhubung ke akun SIAKAD & MyBest. Masuk via Login untuk melihat."
              )
            }
            className="flex flex-col items-center justify-center gap-1 font-mono text-[10px] text-secondary hover:text-foreground"
          >
            <CalendarDays className="h-4 w-4" />
            <span>Jadwal</span>
          </button>
          <button
            type="button"
            onClick={() =>
              triggerDemoFeedback(
                "Daftar tugas & berkas soal terhubung ke MyBest. Masuk via Login untuk melihat."
              )
            }
            className="flex flex-col items-center justify-center gap-1 font-mono text-[10px] text-secondary hover:text-foreground"
          >
            <CheckSquare className="h-4 w-4" />
            <span>Tugas</span>
          </button>
          <button
            type="button"
            onClick={() =>
              triggerDemoFeedback(
                "Rekap presensi dan riwayat pertemuan terhubung ke MyBest. Masuk via Login untuk melihat."
              )
            }
            className="flex flex-col items-center justify-center gap-1 font-mono text-[10px] text-secondary hover:text-foreground"
          >
            <UserCheck className="h-4 w-4" />
            <span>Presensi</span>
          </button>
          <button
            type="button"
            onClick={() => setMobileDrawerOpen(true)}
            className="flex flex-col items-center justify-center gap-1 font-mono text-[10px] text-secondary hover:text-foreground"
          >
            <Ellipsis className="h-4 w-4" />
            <span>Lainnya</span>
          </button>
        </div>
      </nav>

      {/* 5. Mobile Drawer Modal */}
      {mobileDrawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative w-4/5 max-w-xs bg-white h-full shadow-2xl flex flex-col z-10 animate-in slide-in-from-left duration-200">
            <div className="flex h-16 shrink-0 items-center justify-between px-4 border-b-2 border-px-soft">
              <span className="font-display font-bold text-sm text-foreground">Menu Mira Demo</span>
              <button
                type="button"
                onClick={() => setMobileDrawerOpen(false)}
                className="p-1 hover:bg-[#F0F7FB] rounded-sm text-secondary hover:text-foreground"
                aria-label="Tutup drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="scroll-slim flex-1 overflow-y-auto py-3 px-3 space-y-4">
              {navGroups.map((group) => (
                <div key={group.title}>
                  <p className="mb-1 flex items-center gap-2 px-2.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-secondary/80">
                    <span className="h-1.5 w-1.5 bg-px-water" aria-hidden="true" />
                    {group.title}
                  </p>
                  <ul className="space-y-px">
                    {group.items.map((item) => (
                      <li key={item.label}>
                        {item.active ? (
                          <span className="flex min-h-10 items-center gap-2.5 px-2.5 font-mono text-xs bg-px-highlight font-semibold text-foreground shadow-[inset_3px_0_0_#0369A1]">
                            <item.icon className="h-4 w-4 shrink-0 text-[#0369A1]" aria-hidden="true" />
                            <span className="truncate">{item.label}</span>
                          </span>
                        ) : (
                          <Link
                            href="/login"
                            onClick={() => {
                              setMobileDrawerOpen(false);
                              triggerDemoFeedback(
                                `Menu "${item.label}" memerlukan login akun UBSI aktif. Masuk ke halaman login untuk mencoba.`
                              );
                            }}
                            className="flex min-h-10 items-center gap-2.5 px-2.5 font-mono text-xs font-medium text-secondary hover:bg-[#F0F7FB] hover:text-foreground transition-colors"
                          >
                            <item.icon className="h-4 w-4 shrink-0 text-secondary" aria-hidden="true" />
                            <span className="truncate">{item.label}</span>
                            {item.badge && (
                              <span className="ml-auto px-1.5 py-0.5 font-mono text-[10px] bg-white border border-[#CFE2EE] text-[#0369A1]">
                                {item.badge}
                              </span>
                            )}
                          </Link>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="p-4 border-t-2 border-px-soft bg-[#F7FAFC]">
              <Link
                href="/login"
                className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 bg-[#0369A1] hover:bg-[#075985] text-white text-xs font-bold rounded-sm shadow-sm transition-all"
              >
                <span>Masuk Akun Asli</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
