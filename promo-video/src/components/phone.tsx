import React from "react";
import { Img, staticFile } from "remotion";
import {
  BellRing,
  Calendar,
  CalendarDays,
  Camera,
  CheckCircle2,
  CheckSquare,
  Clock,
  Ellipsis,
  Image as ImageIcon,
  LayoutDashboard,
  LogIn,
  Map,
  MessageCircle,
  MessagesSquare,
  Music,
  Phone,
  Settings,
  StickyNote,
  UserCheck,
  Lock,
  X,
} from "lucide-react";
import { Monogram, BlinkBlock } from "./ui";
import { LineRise, riseStyle } from "./motion";
import { TodayClassCard, type ClassStatus } from "./dashboard";
import { CLASSES, DEMO } from "../data";
import { EASE_GLASS, EASE_PX, prog } from "../lib/anim";

export const PHONE_W = 430;
export const PHONE_H = 900;
export const SCREEN_W = 390;
export const SCREEN_H = 844;
export const SCREEN_X = 20;
export const SCREEN_Y = 28;

/** Sudut berundak (pixel) untuk bodi HP. */
function steppedCorners(w: number, h: number, s: number) {
  const pts = [
    [s * 2, 0], [w - s * 2, 0], [w - s * 2, s], [w - s, s], [w - s, s * 2], [w, s * 2],
    [w, h - s * 2], [w - s, h - s * 2], [w - s, h - s], [w - s * 2, h - s], [w - s * 2, h],
    [s * 2, h], [s * 2, h - s], [s, h - s], [s, h - s * 2], [0, h - s * 2],
    [0, s * 2], [s, s * 2], [s, s], [s * 2, s],
  ];
  return `polygon(${pts.map(([x, y]) => `${x}px ${y}px`).join(", ")})`;
}

/** HP bergaya pixel (bukan tiruan merek mana pun): bodi tinta, layar 390x844. */
export const PhoneFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ position: "absolute", left: 0, top: 0, width: PHONE_W, height: PHONE_H }}>
    <div style={{ position: "absolute", left: 12, top: 12, width: PHONE_W, height: PHONE_H, background: "#0369A1", clipPath: steppedCorners(PHONE_W, PHONE_H, 8) }} />
    <div style={{ position: "absolute", inset: 0, background: "#163A55", clipPath: steppedCorners(PHONE_W, PHONE_H, 8) }} />
    <div style={{ position: "absolute", inset: 4, background: "#072033", clipPath: steppedCorners(PHONE_W - 8, PHONE_H - 8, 7) }} />
    <div style={{ position: "absolute", left: PHONE_W / 2 - 34, top: 11, width: 68, height: 8, background: "#0B2D46", boxShadow: "inset 0 0 0 2px #163A55" }} />
    <div style={{ position: "absolute", left: SCREEN_X, top: SCREEN_Y, width: SCREEN_W, height: SCREEN_H, overflow: "hidden", background: "#F7FAFC" }}>{children}</div>
  </div>
);

export const StatusBar: React.FC<{ dark?: boolean; time?: string }> = ({ dark, time = "07:52" }) => {
  const c = dark ? "#FFFFFF" : "#072033";
  return (
    <div style={{ height: 30, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", color: c, position: "relative", zIndex: 5 }}>
      <span className="font-mono" style={{ fontSize: 13, fontWeight: 700 }}>
        {time}
      </span>
      <span style={{ display: "flex", alignItems: "flex-end", gap: 3 }}>
        {[5, 8, 11, 14].map((h) => (
          <span key={h} style={{ width: 4, height: h, background: c }} />
        ))}
        <span style={{ marginLeft: 6, width: 24, height: 12, boxShadow: `inset 0 0 0 2px ${c}`, padding: 3, display: "flex" }}>
          <span style={{ width: "75%", background: c }} />
        </span>
      </span>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Browser HP: landing Mira versi mobile + lembar "Pasang aplikasi"    */
/* ------------------------------------------------------------------ */

export const MobileLanding: React.FC<{ t: number; load: number; pwaPress: boolean; sheet: number; installPress: boolean }> = ({ t, load, pwaPress, sheet, installPress }) => (
  <div style={{ position: "absolute", inset: 0, background: "#F7FAFC" }}>
    <StatusBar />
    <div style={{ height: 40, margin: "0 12px", display: "flex", alignItems: "center", gap: 8, padding: "0 12px", background: "#EAF3F9", boxShadow: "0 -2px 0 0 #CFE2EE, 0 2px 0 0 #CFE2EE, -2px 0 0 0 #CFE2EE, 2px 0 0 0 #CFE2EE" }}>
      <Lock className="h-3.5 w-3.5" style={{ color: "#0F766E" }} />
      <span className="font-mono" style={{ fontSize: 13, color: "#072033" }}>
        mira.muaraai.com
      </span>
    </div>
    <div className="px-4 pt-3">
      <div className="px-nav flex h-14 items-center justify-between px-3">
        <div className="flex items-center gap-3">
          <span className="px-frame flex h-9 w-9 items-center justify-center overflow-hidden bg-white" style={{ ["--px-line" as string]: "#CFE2EE" }}>
            <Monogram size={28} />
          </span>
          <span className="flex flex-col">
            <span className="font-display text-base font-bold tracking-tight text-foreground">Mira</span>
            <span className="-mt-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#0369A1]">Muara AI</span>
          </span>
        </div>
        <span className="px-frame flex h-11 w-11 flex-col items-center justify-center gap-[3px] bg-white" style={{ ["--px-line" as string]: "#CFE2EE" }}>
          <span className="block h-[2px] w-4 bg-[#072033]" />
          <span className="block h-[2px] w-4 bg-[#072033]" />
          <span className="block h-[2px] w-4 bg-[#072033]" />
        </span>
      </div>
      <h1 className="mt-8 font-display text-[2.3rem] font-bold leading-[1.06] tracking-[-0.04em] text-foreground">
        <LineRise t={t} at={load + 0.1}>Cek jadwal, tugas, </LineRise>
        <LineRise t={t} at={load + 0.22}>absen, dan nilai </LineRise>
        <LineRise t={t} at={load + 0.34} className="text-[#0369A1]">
          di satu tempat.
          <BlinkBlock t={t} className="ml-1 inline-block h-[0.8em] w-[0.4em] translate-y-[0.06em] bg-[#0369A1]" />
        </LineRise>
      </h1>
      <p className="mt-5 text-base leading-7 text-secondary" style={riseStyle(t, load + 0.08)}>
        Satu akses langsung untuk 6 layanan kampus: SIAKAD, MyBest, Ujian Online, Perpustakaan, Berita Resmi, dan Repository Riset.
      </p>
      <div className="mt-7 grid grid-cols-1 gap-4" style={riseStyle(t, load + 0.2)}>
        <span className="px-btn inline-flex min-h-11 items-center justify-center gap-2 px-5 py-3 text-sm font-bold">
          Masuk ke Dashboard <span aria-hidden="true">→</span>
        </span>
        <span
          data-anchor="m-pwa"
          className="px-btn-ghost inline-flex min-h-11 items-center justify-center px-5 py-3 text-sm font-semibold"
          style={pwaPress ? ({ ["--px-off" as string]: "1px", transform: "translate(2px, 2px)" } as React.CSSProperties) : undefined}
        >
          Pasang Aplikasi (PWA)
        </span>
      </div>
    </div>
    {sheet > 0 && (
      <>
        <div style={{ position: "absolute", inset: 0, background: `rgba(7,32,51,${0.5 * sheet})` }} />
        <div
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            background: "#fff",
            boxShadow: "0 -2px 0 0 #163A55, 0 -6px 0 0 #0369A1",
            padding: "22px 20px 34px",
            transform: `translateY(${(1 - sheet) * 100}%)`,
          }}
        >
          <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-[#0369A1]">Pasang aplikasi</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="px-frame flex h-14 w-14 items-center justify-center bg-white" style={{ ["--px-line" as string]: "#CFE2EE" }}>
              <Monogram size={44} />
            </span>
            <div>
              <p className="font-display text-lg font-bold text-foreground">Mira</p>
              <p className="font-mono text-xs text-secondary">mira.muaraai.com</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <span className="px-btn-ghost inline-flex min-h-11 items-center justify-center text-sm font-semibold">Batal</span>
            <span
              data-anchor="m-install"
              className="px-btn inline-flex min-h-11 items-center justify-center text-sm font-bold"
              style={installPress ? ({ ["--px-off" as string]: "1px", transform: "translate(2px, 2px)" } as React.CSSProperties) : undefined}
            >
              Pasang
            </span>
          </div>
        </div>
      </>
    )}
  </div>
);

/* ------------------------------------------------------------------ */
/* Layar utama HP: ikon generik + ikon Mira yang baru terpasang        */
/* ------------------------------------------------------------------ */

const APPS = [
  { label: "Telepon", icon: Phone, bg: "#0F766E" },
  { label: "Pesan", icon: MessageCircle, bg: "#0369A1" },
  { label: "Kamera", icon: Camera, bg: "#3B5A70" },
  { label: "Galeri", icon: ImageIcon, bg: "#9A3412" },
  { label: "Kalender", icon: Calendar, bg: "#BE123C" },
  { label: "Jam", icon: Clock, bg: "#163A55" },
  { label: "Catatan", icon: StickyNote, bg: "#B45309" },
  { label: "Musik", icon: Music, bg: "#6D28D9" },
  { label: "Peta", icon: Map, bg: "#0F766E" },
  { label: "Setelan", icon: Settings, bg: "#3B5A70" },
];

export const Wallpaper: React.FC = () => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundColor: "#072033",
      backgroundImage:
        "repeating-linear-gradient(135deg, rgba(156,198,224,.08) 0 2px, transparent 2px 22px), linear-gradient(170deg, #0B2D46 0%, #072033 55%, #04263b 100%)",
    }}
  >
    {/* Strip air bertingkat di bawah, motif "muara" Mira. */}
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 120, backgroundImage: "linear-gradient(to bottom, transparent 0 20px, rgba(95,163,204,.18) 20px 40px, rgba(95,163,204,.28) 40px 60px, rgba(156,198,224,.32) 60px 120px)" }} />
  </div>
);

export const HomeScreen: React.FC<{ t: number; miraAt: number; tapIcon: boolean }> = ({ t, miraAt, tapIcon }) => {
  const pop = prog(t, miraAt, 0.5, EASE_GLASS);
  const drop = Math.round((1 - prog(t, miraAt, 0.3, EASE_PX)) * 3) / 3;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <Wallpaper />
      <StatusBar dark />
      <div style={{ position: "absolute", left: 22, right: 22, top: 70, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", rowGap: 26 }}>
        {APPS.map(({ label, icon: Icon, bg }) => (
          <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
            <span style={{ width: 62, height: 62, background: bg, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "3px 3px 0 0 rgba(0,0,0,.25)" }}>
              <Icon className="h-7 w-7" style={{ color: "#fff" }} />
            </span>
            <span style={{ fontSize: 12, color: "#E5EEF5", fontWeight: 500 }}>{label}</span>
          </div>
        ))}
        <div data-anchor="home-mira" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, opacity: t >= miraAt ? 1 : 0 }}>
          <span
            style={{
              width: 62,
              height: 62,
              background: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 -2px 0 0 #9CC6E0, 0 2px 0 0 #9CC6E0, -2px 0 0 0 #9CC6E0, 2px 0 0 0 #9CC6E0, 4px 4px 0 0 #0369A1",
              transform: `translateY(${-drop * 40}px) scale(${(0.6 + pop * 0.4) * (tapIcon ? 0.9 : 1)})`,
            }}
          >
            <Monogram size={52} />
          </span>
          <span style={{ fontSize: 12, color: "#fff", fontWeight: 700 }}>Mira</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: 30, right: 30, bottom: 26, height: 84, background: "rgba(255,255,255,.12)", display: "flex", alignItems: "center", justifyContent: "space-around" }}>
        {[Phone, MessageCircle, Camera, ImageIcon].map((Icon, i) => (
          <span key={i} style={{ width: 56, height: 56, background: ["#0F766E", "#0369A1", "#3B5A70", "#9A3412"][i], display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon className="h-6 w-6" style={{ color: "#fff" }} />
          </span>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Layar kunci + notifikasi push Mira (teks persis notifier.py/news.py) */
/* ------------------------------------------------------------------ */

export const PushCard: React.FC<{ p: { title: string; body: string; time: string }; anchor?: string; style?: React.CSSProperties }> = ({ p, anchor, style }) => (
  <div
    data-anchor={anchor}
    style={{
      background: "rgba(255,255,255,0.96)",
      padding: "12px 14px",
      boxShadow: "0 -2px 0 0 #9CC6E0, 0 2px 0 0 #9CC6E0, -2px 0 0 0 #9CC6E0, 2px 0 0 0 #9CC6E0, 4px 4px 0 0 rgba(3,105,161,.65)",
      ...style,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ width: 22, height: 22, background: "#fff", boxShadow: "inset 0 0 0 2px #CFE2EE", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Monogram size={18} />
      </span>
      <span className="font-mono" style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#0369A1", textTransform: "uppercase" }}>
        Mira
      </span>
      <span className="font-mono" style={{ marginLeft: "auto", fontSize: 11, color: "#3B5A70" }}>
        {p.time}
      </span>
    </div>
    <p style={{ marginTop: 6, fontSize: 14, fontWeight: 700, color: "#072033", lineHeight: 1.3 }}>{p.title}</p>
    <p style={{ marginTop: 2, fontSize: 13, color: "#3B5A70", lineHeight: 1.35 }}>{p.body}</p>
  </div>
);

export const LockScreen: React.FC<{ t: number; arrivals: number[]; pushes: { title: string; body: string; time: string }[]; unlock: number; time?: string }> = ({ t, arrivals, pushes, unlock, time = "07:52" }) => {
  // Notifikasi terbaru di atas; yang lama turun mengikuti tinggi kartu.
  const H = 102;
  return (
    <div style={{ position: "absolute", inset: 0, transform: `translateY(${-unlock * 100}%)` }}>
      <Wallpaper />
      <StatusBar dark />
      <div style={{ position: "relative", textAlign: "center", marginTop: 30, color: "#fff" }}>
        <Lock className="mx-auto h-4 w-4" style={{ color: "#9CC6E0" }} />
        <p className="font-display" style={{ fontSize: 86, fontWeight: 700, letterSpacing: "-0.04em", lineHeight: 1, marginTop: 10 }}>
          {time}
        </p>
        <p className="font-mono" style={{ fontSize: 14, fontWeight: 700, letterSpacing: "0.14em", color: "#9CC6E0", marginTop: 8, textTransform: "uppercase" }}>
          Senin, 9 November
        </p>
      </div>
      <div style={{ position: "absolute", left: 16, right: 16, top: 250 }}>
        {arrivals.map((at, i) => {
          if (t < at) return null;
          const p = prog(t, at, 0.45, EASE_GLASS);
          // jumlah notifikasi yang datang setelah ini = posisi turun
          const above = arrivals.filter((b, j) => j > i && t >= b).reduce((acc, b) => acc + prog(t, b, 0.4, EASE_GLASS), 0);
          return (
            <div key={i} style={{ position: "absolute", left: 0, right: 0, top: above * H, opacity: p, transform: `translateY(${(1 - p) * -40}px) scale(${0.96 + p * 0.04})` }}>
              <PushCard p={pushes[i]} anchor={`push-${i}`} />
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 26, textAlign: "center" }}>
        <span className="font-mono" style={{ fontSize: 11, letterSpacing: "0.18em", color: "#9CC6E0", textTransform: "uppercase" }}>
          Geser ke atas untuk membuka
        </span>
        <div style={{ width: 120, height: 5, background: "#9CC6E0", margin: "10px auto 0" }} />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Dashboard Mira versi HP (topbar + Ringkasan + bottom nav + toast)    */
/* ------------------------------------------------------------------ */

export const MobileRingkasan: React.FC<{
  t: number;
  scroll: number;
  status: ClassStatus;
  press: boolean;
  toast: number;
  bellOn?: boolean;
}> = ({ t, scroll, status, press, toast, bellOn }) => (
  <div className="portal-type" style={{ position: "absolute", inset: 0, background: "#F7FAFC" }}>
    <div style={{ position: "absolute", left: 0, right: 0, top: 0, zIndex: 10, background: "rgba(255,255,255,.96)" }}>
      <StatusBar />
      <header className="flex h-14 items-center justify-between border-b-2 border-px-soft bg-white/90 px-4">
        <div className="flex items-center gap-2.5">
          <span className="px-frame flex h-8 w-8 items-center justify-center overflow-hidden bg-white" style={{ ["--px-line" as string]: "#CFE2EE" }}>
            <Monogram size={24} />
          </span>
          <span className="font-display text-sm font-bold tracking-tight text-foreground">Mira</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="px-chip flex min-h-[40px] shrink-0 items-center gap-1.5 bg-[#F0F7FB] px-2.5 font-mono text-[11px] font-semibold text-[#0369A1]">
            <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="tabular">1x</span>
            <span>login</span>
          </span>
          <span data-anchor="m-bell" className="px-frame flex min-h-[40px] min-w-[40px] items-center justify-center bg-white text-foreground" style={{ ["--px-line" as string]: bellOn ? "#0369A1" : "#CFE2EE", background: bellOn ? "#EAF3F9" : undefined }}>
            <BellRing className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>
      </header>
    </div>

    <div style={{ position: "absolute", left: 0, right: 0, top: 86, bottom: 66, overflow: "hidden" }}>
      <div className="space-y-6 px-4 py-5" style={{ transform: `translateY(${-scroll}px)` }}>
        <section className="overflow-hidden bg-white shadow-[0_0_0_2px_#163A55,6px_6px_0_0_#9CC6E0]">
          <div
            className="relative px-4 pb-5 pt-4 text-white"
            style={{
              backgroundColor: "#0369A1",
              backgroundImage: "radial-gradient(rgba(255,255,255,.14) 1.5px, transparent 1.5px), linear-gradient(135deg, #0369A1 0%, #075985 60%, #0B2D46 100%)",
              backgroundSize: "14px 14px, 100% 100%",
            }}
          >
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">{DEMO.tanggal}</p>
            <h1 className="mt-1.5 text-[1.6rem] font-display font-bold leading-tight tracking-tight">Selamat pagi, {DEMO.nama}</h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-white/85">
              <span className="font-mono font-semibold text-white">{DEMO.nim}</span>
              <span>·</span>
              <span>
                {DEMO.prodi} {DEMO.kelas}
              </span>
              <span>·</span>
              <span>Semester {DEMO.semester}</span>
            </p>
          </div>
          <div className="flex items-center gap-3 border-b-2 border-[#EAF3F9] px-4 py-3.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#0369A1]/10 text-[#0369A1]">
              <Clock className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-[#0369A1]">Kelas berikutnya</span>
              <span className="block truncate text-[15px] font-bold text-foreground">{CLASSES[0].nama}</span>
              <span className="block truncate text-xs text-secondary">Dimulai 8 menit lagi · {CLASSES[0].roomLabel}</span>
            </span>
          </div>
          <nav className="grid grid-cols-4 gap-1 px-2 py-2.5">
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

        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-2">
              <Clock className="h-5 w-5 shrink-0 text-[#0369A1]" aria-hidden="true" />
              <h2 data-anchor="m-heading" className="text-lg font-display font-bold tracking-tight text-foreground">Kelas Hari Senin</h2>
            </div>
            <span className="text-xs font-semibold text-[#0369A1]">Lihat semua jadwal</span>
          </div>
          <TodayClassCard t={t} item={CLASSES[0]} timingLabel="Dimulai 8 menit lagi" status={status} openAt="08.00" anchor="m-class" press={press} compact />
        </section>
      </div>
    </div>

    {toast > 0 && (
      <div
        style={{ position: "absolute", left: 16, right: 16, bottom: 86, zIndex: 20, opacity: toast, transform: `translateY(${(1 - toast) * -8}px)` }}
        className="flex items-start gap-3 bg-white p-4 text-sm text-foreground shadow-[0_-2px_0_0_#163A55,0_2px_0_0_#163A55,-2px_0_0_0_#163A55,2px_0_0_0_#163A55,6px_6px_0_0_#0F766E]"
      >
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#0F766E]" aria-hidden="true" />
        <p className="flex-1 leading-5">Presensi {CLASSES[0].nama} berhasil dicatat.</p>
        <X className="h-3.5 w-3.5 text-secondary" aria-hidden="true" />
      </div>
    )}

    <nav className="dashboard-bottom-nav" style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 10, padding: 6 }}>
      <div className="grid grid-cols-5">
        {[
          { label: "Ringkasan", icon: LayoutDashboard, on: true },
          { label: "Jadwal", icon: CalendarDays },
          { label: "Tugas", icon: CheckSquare },
          { label: "Presensi", icon: UserCheck },
          { label: "Lainnya", icon: Ellipsis },
        ].map(({ label, icon: Icon, on }) => (
          <span key={label} className="bottom-nav-item" data-active={on ? "true" : "false"}>
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

export { Img, staticFile };
