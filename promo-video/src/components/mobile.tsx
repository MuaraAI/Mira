import React from "react";
import {
  BellRing,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Clock,
  Building2,
  Ellipsis,
  LayoutDashboard,
  LogIn,
  RefreshCw,
  Send,
  Smartphone,
  Trash2,
  User,
  UserCheck,
  X,
} from "lucide-react";
import { Monogram, BlinkBlock, Spin } from "./ui";
import { StatusBar } from "./phone";
import { RingkasanDesktop } from "./dashboard";
import { DEMO } from "../data";
import { EASE_PX, prog } from "../lib/anim";

/* ------------------------------------------------------------------ bingkai aplikasi HP (topbar + menu bawah) */

export const MobileChrome: React.FC<{
  active: "ringkasan" | "jadwal" | "tugas" | "presensi" | "lainnya";
  bellOn?: boolean;
  children: React.ReactNode;
  width?: number;
  statusTime?: string;
}> = ({ active, bellOn, children, width, statusTime }) => (
  <div className="portal-type" style={{ position: "absolute", inset: 0, background: "#F7FAFC", width }}>
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, zIndex: 10, background: "rgba(255,255,255,.96)" }}>
      <StatusBar time={statusTime} />
      <header className="flex h-14 items-center justify-between border-b-2 border-px-soft bg-white/90 px-4">
        <div className="flex items-center gap-2.5">
          <span className="px-frame flex h-8 w-8 items-center justify-center overflow-hidden bg-white" style={{ ["--px-line" as string]: "#CFE2EE" }}>
            <Monogram size={24} />
          </span>
          <span className="font-display text-sm font-bold tracking-tight text-foreground">Mira</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="px-chip flex min-h-[40px] shrink-0 items-center gap-1.5 bg-[#F0F7FB] px-2.5 font-mono text-[11px] font-semibold text-[#0369A1]">
            <LogIn className="h-3.5 w-3.5" />
            <span className="tabular">1x</span>
            <span>login</span>
          </span>
          <span
            data-anchor="m-bell2"
            className="px-frame flex min-h-[40px] min-w-[40px] items-center justify-center bg-white text-foreground"
            style={{ ["--px-line" as string]: bellOn ? "#0369A1" : "#CFE2EE", background: bellOn ? "#EAF3F9" : undefined }}
          >
            <BellRing className="h-5 w-5" />
          </span>
        </div>
      </header>
    </div>
    <div style={{ position: "absolute", left: 0, right: 0, top: 86, bottom: 66, overflow: "hidden" }}>{children}</div>
    <nav className="dashboard-bottom-nav" style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10, padding: 6 }}>
      <div className="grid grid-cols-5">
        {[
          { key: "ringkasan", label: "Ringkasan", icon: LayoutDashboard },
          { key: "jadwal", label: "Jadwal", icon: CalendarDays },
          { key: "tugas", label: "Tugas", icon: CheckSquare },
          { key: "presensi", label: "Presensi", icon: UserCheck },
          { key: "lainnya", label: "Lainnya", icon: Ellipsis },
        ].map(({ key, label, icon: Icon }) => (
          <span key={key} className="bottom-nav-item" data-active={key === active ? "true" : "false"}>
            <span className="bottom-nav-icon">
              <Icon className="h-[18px] w-[18px]" />
            </span>
            <span className="bottom-nav-label">{label}</span>
          </span>
        ))}
      </div>
    </nav>
  </div>
);

/* ------------------------------------------------------------------ tablet (820 x 1180) */

export const TabletRingkasan: React.FC<{ t: number }> = ({ t }) => (
  <MobileChrome active="ringkasan" width={820}>
    <div className="px-6 py-6">
      <RingkasanDesktop t={t} load={-10} ipk={DEMO.ipk} tablet />
    </div>
  </MobileChrome>
);

/* ------------------------------------------------------------------ halaman Notifikasi (PwaPushDeviceSection) */

export const MobileNotifikasi: React.FC<{ t: number; load: number; enabled: boolean; enableAt: number; pressAktifkan: boolean }> = ({ t, load, enabled, enableAt, pressAktifkan }) => {
  const p = prog(t, load, 0.4, EASE_PX);
  const cats = prog(t, enableAt + 0.15, 0.45, EASE_PX);
  return (
    <MobileChrome active="lainnya" bellOn>
      <div className="space-y-5 px-4 py-5" style={{ opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>
        <div className="border-b-2 border-dashed border-px-soft pb-4">
          <h1 className="flex items-center gap-3 text-2xl font-display font-bold tracking-tight text-foreground">
            <span className="h-2.5 w-2.5 shrink-0 bg-[#0369A1] shadow-[3px_3px_0_0_#9CC6E0]" />
            Notifikasi
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-secondary">Pengingat kelas, absen, dan tugas ke HP, Discord, atau Telegram.</p>
        </div>
        <section className="glass-card space-y-4 p-4">
          <div className="flex items-start gap-3">
            <span className="px-icon h-10 w-10 shrink-0">
              <BellRing className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-foreground" style={{ fontFamily: "Inter" }}>
                Notifikasi di HP dan Laptop
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-secondary">Pengingat kelas, absen, tugas, dan nilai masuk langsung ke layar kunci. Aktifkan di tiap perangkat yang kamu pakai.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className={`h-2 w-2 shrink-0 ${enabled ? "bg-[#0F766E]" : "bg-secondary/50"}`} />
            <span className={enabled ? "font-semibold text-[#0F766E]" : "text-secondary"}>{enabled ? "Perangkat ini aktif menerima notifikasi" : "Perangkat ini belum diaktifkan"}</span>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {enabled ? (
              <span className="px-btn-ghost inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-xs font-semibold">
                <Trash2 className="h-4 w-4" />
                Cabut perangkat ini
              </span>
            ) : (
              <span
                data-anchor="m-aktifkan"
                className="px-btn inline-flex min-h-11 items-center justify-center gap-2 px-5 py-2.5 text-xs font-bold"
                style={pressAktifkan ? ({ ["--px-off" as string]: "1px", transform: "translate(2px, 2px)" } as React.CSSProperties) : undefined}
              >
                <Smartphone className="h-4 w-4" />
                Aktifkan di Perangkat Ini
              </span>
            )}
            <span className="px-btn-ghost inline-flex min-h-11 items-center justify-center gap-2 px-4 py-2 text-xs font-semibold">
              <Send className="h-4 w-4" />
              Kirim uji coba
            </span>
          </div>
          {enabled && (
            <div className="space-y-3 border-t-2 border-dashed border-px-soft pt-4" style={{ opacity: cats, transform: `translateY(${(1 - cats) * 8}px)` }}>
              <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: "Inter" }}>
                Yang ingin kamu terima
              </h3>
              {[
                ["Kelas Segera Mulai", "15 menit sebelum kelas dan saat kelas dimulai, lengkap dengan jam dan ruang."],
                ["Pengingat Absen", "Saat sesi presensi dibuka, lalu diingatkan lagi tiap 10 menit sampai kamu absen."],
              ].map(([label, desc]) => (
                <div key={label} className="flex min-h-14 items-start gap-3 bg-px-highlight p-3 shadow-[inset_3px_0_0_#0369A1]">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center bg-[#0369A1]">
                    <svg viewBox="0 0 12 12" width="12" height="12">
                      <path d="M2 6.5 4.8 9 10 3" fill="none" stroke="#fff" strokeWidth="2" />
                    </svg>
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold text-foreground">{label}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-secondary">{desc}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
          {!enabled && (
            <span className="px-btn-ghost inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 py-2 text-xs font-semibold">
              <RefreshCw className="h-4 w-4" />
              Segarkan
            </span>
          )}
        </section>
      </div>
    </MobileChrome>
  );
};

/** Prompt izin bawaan browser (UI sistem, digambar netral). */
export const PermissionPrompt: React.FC<{ p: number; pressAllow: boolean }> = ({ p, pressAllow }) => {
  if (p <= 0) return null;
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 40 }}>
      <div style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${0.32 * p})` }} />
      <div
        style={{
          position: "absolute",
          left: 18,
          right: 18,
          top: 250,
          background: "#fff",
          borderRadius: 22,
          padding: "22px 22px 14px",
          boxShadow: "0 18px 40px rgba(0,0,0,.25)",
          opacity: p,
          transform: `translateY(${(1 - p) * 20}px) scale(${0.96 + 0.04 * p})`,
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: 20, background: "#E8F0FE", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BellRing style={{ width: 20, height: 20, color: "#1A73E8" }} />
          </span>
          <div style={{ fontSize: 16, color: "#202124", lineHeight: 1.35 }}>
            <b>mira.muaraai.com</b> ingin mengirim notifikasi
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
          <span style={{ padding: "10px 18px", borderRadius: 20, color: "#1A73E8", fontWeight: 600, fontSize: 15 }}>Blokir</span>
          <span
            data-anchor="m-izinkan"
            style={{ padding: "10px 18px", borderRadius: 20, background: pressAllow ? "#1557B0" : "#1A73E8", color: "#fff", fontWeight: 600, fontSize: 15 }}
          >
            Izinkan
          </span>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ halaman Presensi + dialog konfirmasi */

export type PresensiPhase = "open" | "submitting" | "present";

export const MobilePresensi: React.FC<{ t: number; load: number; phase: PresensiPhase; press: boolean; confirm: number; pressKirim: boolean; success: number }> = ({
  t,
  load,
  phase,
  press,
  confirm,
  pressKirim,
  success,
}) => {
  const p = prog(t, load, 0.4, EASE_PX);
  const present = phase === "present";
  return (
    <MobileChrome active="presensi">
      <div className="space-y-5 px-4 py-5" style={{ opacity: p, transform: `translateY(${(1 - p) * 10}px)` }}>
        <div className="border-b-2 border-dashed border-px-soft pb-4">
          <h1 className="flex items-center gap-3 text-2xl font-display font-bold tracking-tight text-foreground">
            <span className="h-2.5 w-2.5 shrink-0 bg-[#0369A1] shadow-[3px_3px_0_0_#9CC6E0]" />
            Presensi Perkuliahan
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-secondary">Absen, riwayat kehadiran, dan rangkuman tiap pertemuan.</p>
        </div>
        <div className="px-input flex min-h-14 items-center justify-between gap-3 px-4 py-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">Pemrograman Web</span>
            <span className="block truncate font-mono text-[11px] text-secondary">Senin · 08:00-10:30 · R. 302</span>
          </span>
          <span className="flex items-center gap-2">
            <span className="bg-[#0F766E]/10 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase text-[#0F766E]">Segera</span>
            <ChevronDown className="h-4 w-4 text-secondary" />
          </span>
        </div>
        <section className="glass-card p-4" style={{ ["--px-line" as string]: "#0F766E", ["--px-drop" as string]: "#99D5CC" } as React.CSSProperties}>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-chip bg-px-tint px-2 py-0.5 font-mono text-[11px] font-bold text-[#0369A1]">INF101</span>
              <span className="inline-flex items-center gap-1.5 bg-[#0F766E] px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                {present ? <span className="h-1.5 w-1.5 bg-white" /> : <BlinkBlock t={t} className="h-1.5 w-1.5 bg-white" />}
                {present ? "Sudah Absen" : "Absen Dibuka"}
              </span>
            </div>
            <h2 className="text-lg font-display font-bold leading-snug text-foreground">Pemrograman Web</h2>
            <div className="flex items-center gap-1.5 text-xs text-secondary">
              <User className="h-3.5 w-3.5 shrink-0 text-[#0369A1]" />
              <span className="font-semibold text-foreground underline decoration-px-water decoration-2 underline-offset-4">Andi Pratama (ANP)</span>
            </div>
            <div className="space-y-2 pt-1">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-foreground">
                <CalendarDays className="h-4 w-4 shrink-0 text-[#0369A1]" />
                <span className="font-semibold">Senin, 9 Nov</span>
                <span className="inline-flex items-center gap-1 font-mono text-[13px] text-secondary">
                  <Clock className="h-3.5 w-3.5" />
                  08:00 - 10:30
                </span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 bg-px-tint px-2 py-0.5 text-xs text-secondary">
                  <Building2 className="h-3.5 w-3.5 text-[#0369A1]" />
                  Tatap muka · Lantai 3, Ruang 02
                </span>
                <span className="inline-flex items-center gap-1.5 bg-[#0369A1]/10 px-2 py-0.5 text-xs font-semibold text-[#0369A1]">
                  <BlinkBlock t={t} className="h-1.5 w-1.5 bg-current" />
                  Dimulai 9 menit lagi
                </span>
              </div>
            </div>
          </div>
          <span
            data-anchor="m-absen"
            className="px-btn-success mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 px-6 text-sm font-bold"
            style={press ? ({ ["--off" as string]: "1px", transform: "translate(2px, 2px)" } as React.CSSProperties) : undefined}
          >
            {present ? <CheckCircle2 className="h-4 w-4" /> : phase === "submitting" ? <Spin t={t} className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
            {present ? "Sudah absen hari ini" : phase === "submitting" ? "Mengirim presensi..." : "Absen Sekarang"}
          </span>
          <div className="mt-5 border-t-2 border-dashed border-px-soft pt-4">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-secondary">Kehadiran</span>
              <span className="font-mono text-xs text-secondary">
                <strong className="font-mono text-lg text-[#0369A1]">{present ? "100%" : "100%"}</strong> · {present ? "5/5" : "4/4"} hadir
              </span>
            </div>
            <div className="mt-2 grid gap-[3px]" style={{ gridTemplateColumns: "repeat(16, minmax(0, 1fr))" }}>
              {Array.from({ length: 16 }, (_, i) => (
                <span key={i} className="h-2.5 bg-[#0F766E]" />
              ))}
            </div>
          </div>
        </section>
        {success > 0 && (
          <div
            className="px-frame break-words bg-[#F0FDF4] p-3 text-sm text-[#0F766E]"
            style={{ ["--px-line" as string]: "#99D5CC", opacity: success, transform: `translateY(${(1 - success) * -8}px)` } as React.CSSProperties}
          >
            Presensi Pemrograman Web berhasil dicatat.
          </div>
        )}
      </div>

      {confirm > 0 && (
        <div style={{ position: "absolute", inset: 0, zIndex: 30 }}>
          <div style={{ position: "absolute", inset: 0, background: `rgba(7,32,51,${0.55 * confirm})` }} />
          <div
            className="absolute inset-x-0 bottom-0 bg-white"
            style={{ boxShadow: "0 -2px 0 0 #163A55", transform: `translateY(${(1 - confirm) * 100}%)` }}
          >
            <div className="flex items-start gap-4 p-5">
              <span className="px-icon flex h-11 w-11 shrink-0 items-center justify-center">
                <UserCheck className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <h2 className="font-display text-lg font-bold leading-snug text-foreground">Kirim presensi sekarang?</h2>
                <div className="mt-2 text-sm leading-6 text-secondary">Kehadiranmu untuk Pemrograman Web akan dicatat di MyBest.</div>
              </div>
              <span className="-mr-2 -mt-2 flex h-10 w-10 shrink-0 items-center justify-center text-secondary">
                <X className="h-4 w-4" />
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t-2 border-px-soft bg-surface-alt px-5 py-4">
              <span className="px-btn-ghost inline-flex min-h-11 items-center justify-center px-5 text-sm font-semibold">Batal</span>
              <span
                data-anchor="m-kirim"
                className="px-btn inline-flex min-h-11 items-center justify-center px-5 text-sm font-bold"
                style={pressKirim ? ({ ["--px-off" as string]: "1px", transform: "translate(2px, 2px)" } as React.CSSProperties) : undefined}
              >
                Kirim presensi
              </span>
            </div>
          </div>
        </div>
      )}
    </MobileChrome>
  );
};
