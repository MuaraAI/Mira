import React from "react";
import { BellRing, BookOpen, CalendarDays, CheckSquare, GraduationCap, UserCheck } from "lucide-react";
import { GithubIcon, Monogram, BlinkBlock } from "./ui";
import { LineRise, riseStyle } from "./motion";
import { prog, EASE_GLASS } from "../lib/anim";

/* Disalin dari Hero.tsx Mira (copy, kelas, urutan sama persis). */
const features = [
  { icon: CalendarDays, title: "SIAKAD: Jadwal Kuliah", text: "Jadwal mingguan, ruang, nama dosen pengampu, dan kalender akademik." },
  { icon: CheckSquare, title: "MyBest: Tugas & Kuis", text: "Deadline tugas, kumpulkan lembar tugas, pantau kuis, dan unduh 5 paket bahan ajar resmi: Slide, Modul, Silabus, RPS, RTM." },
  { icon: UserCheck, title: "Presensi Real-time", text: "Presensi kehadiran perkuliahan dengan verifikasi rekap otomatis dari server." },
  { icon: GraduationCap, title: "Ujian Online & Nilai", text: "Jadwal ujian kampus (Latihan, UTS, UAS), kartu ujian, KHS, dan IPK semester." },
  { icon: BookOpen, title: "Perpustakaan & Repository", text: "Pencarian katalog buku fisik OPAC perpustakaan, materi dosen, dan repositori skripsi." },
  { icon: BellRing, title: "Notifikasi Pengingat", text: "Pengingat kelas, presensi, dan deadline tugas langsung ke layar HP, Discord, atau Telegram." },
];

const NAV_LINKS = ["Fitur", "Cara Pakai", "Statistik", "FAQ"];

/**
 * Landing page Mira versi desktop (Navbar + Hero), dianimasikan seperti aslinya:
 * baris judul naik dari masker (.line-mask) dan anak-anak kolom kiri .stagger-rise.
 * `load` = detik saat halaman mulai dirender, `btn` = state tombol Masuk ke Dashboard.
 */
export const LandingDesktop: React.FC<{ t: number; load: number; btn: "idle" | "hover" | "press" }> = ({ t, load, btn }) => {
  const shell = prog(t, load, 0.35, EASE_GLASS);
  const btnStyle: React.CSSProperties =
    btn === "hover"
      ? ({ ["--px-off" as string]: "6px", transform: "translate(-2px, -2px)" } as React.CSSProperties)
      : btn === "press"
        ? ({ ["--px-off" as string]: "1px", transform: "translate(2px, 2px)" } as React.CSSProperties)
        : {};
  return (
    <div className="flex min-h-full flex-col bg-background text-foreground" style={{ width: 1440 }}>
      <header className="w-full px-6 py-3" style={{ opacity: shell }}>
        <div className="px-nav mx-auto flex h-14 max-w-7xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <span className="px-frame flex h-9 w-9 items-center justify-center overflow-hidden bg-white" style={{ ["--px-line" as string]: "#CFE2EE" }}>
              <Monogram size={28} />
            </span>
            <span className="flex flex-col">
              <span className="font-display text-base font-bold tracking-tight text-foreground">Mira</span>
              <span className="-mt-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-[#0369A1]">Muara AI</span>
            </span>
          </div>
          <nav className="flex items-center gap-1 text-sm font-medium text-secondary">
            {NAV_LINKS.map((l) => (
              <span key={l} className="px-3 py-1.5">
                {l}
              </span>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="px-btn-ghost inline-flex min-h-9 items-center gap-2 px-3 py-1.5 font-mono text-xs font-semibold" style={{ ["--px-off" as string]: "3px" }}>
              <GithubIcon />
              GitHub · 8 stars
            </span>
            <span className="px-btn inline-flex min-h-9 items-center justify-center px-4 py-1.5 text-xs font-bold" style={{ ["--px-off" as string]: "3px" }}>
              Masuk
            </span>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b-2 border-px-soft">
        <div className="relative mx-auto grid max-w-7xl items-center gap-16 px-8 pb-24 pt-16" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(380px,0.9fr)" }}>
          <div className="min-w-0">
            <h1 className="max-w-3xl font-display text-6xl font-bold leading-[1.06] tracking-[-0.04em] text-foreground">
              <LineRise t={t} at={load + 0.1}>Cek jadwal, tugas, </LineRise>
              <LineRise t={t} at={load + 0.22}>absen, dan nilai </LineRise>
              <LineRise t={t} at={load + 0.34} className="text-[#0369A1]">
                di satu tempat.
                <BlinkBlock t={t} className="ml-1 inline-block h-[0.8em] w-[0.4em] translate-y-[0.06em] bg-[#0369A1]" />
              </LineRise>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-secondary" style={riseStyle(t, load + 0.08)}>
              Satu akses langsung untuk 6 layanan kampus: SIAKAD, MyBest, Ujian Online, Perpustakaan, Berita Resmi, dan Repository Riset. Nggak perlu lagi buka banyak website terpisah.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 font-mono text-xs font-semibold text-secondary" style={riseStyle(t, load + 0.16)}>
              {["SIAKAD", "MyBest LMS", "Ujian Online", "Perpustakaan", "Berita Kampus", "Repository Riset"].map((s) => (
                <span key={s} className="border border-px-soft bg-white px-2.5 py-1">
                  {s}
                </span>
              ))}
            </div>
            <div className="mt-8 flex flex-wrap gap-4" style={riseStyle(t, load + 0.24)}>
              <span data-anchor="hero-masuk" className="px-btn inline-flex min-h-11 items-center justify-center gap-2 px-5 py-3 text-sm font-bold" style={btnStyle}>
                Masuk ke Dashboard
                <span aria-hidden="true">→</span>
              </span>
              <span className="px-btn-ghost inline-flex min-h-11 items-center justify-center px-5 py-3 text-sm font-semibold">Pasang Aplikasi (PWA)</span>
            </div>
            <div className="mt-3 flex items-center gap-2 text-xs text-secondary" style={riseStyle(t, load + 0.32)}>
              <span>Mau coba tanpa login?</span>
              <span className="font-semibold text-[#0369A1] underline">Buka Demo Dashboard →</span>
            </div>
            <p className="mt-6 max-w-md text-sm leading-6 text-secondary" style={riseStyle(t, load + 0.4)}>
              Gratis dan open source. Proyek independen dari Muara AI, bukan aplikasi resmi UBSI.
            </p>
          </div>

          <section className="current-surface min-w-0" style={{ opacity: prog(t, load + 0.15, 0.5, EASE_GLASS) }}>
            <div className="flex items-center gap-1.5 border-b-2 border-px-soft bg-px-tint px-4 py-2.5">
              <span className="h-2.5 w-2.5 bg-[#BE123C]" />
              <span className="h-2.5 w-2.5 bg-px-sun" />
              <span className="h-2.5 w-2.5 bg-[#0F766E]" />
            </div>
            <div className="p-7">
              <h2 className="font-display text-xl font-semibold text-foreground">Yang bisa kamu lakukan</h2>
              <ul className="mt-5">
                {features.map(({ icon: Icon, title, text }, i) => (
                  <li
                    key={title}
                    className="flex items-start gap-3.5 py-3.5"
                    style={{
                      borderTop: i === 0 ? "none" : "2px dashed #CFE2EE",
                      paddingTop: i === 0 ? 0 : undefined,
                      ...riseStyle(t, load + 0.25 + i * 0.06, 0.5, 10),
                    }}
                  >
                    <span className="px-icon mt-0.5 h-9 w-9 shrink-0">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">{title}</p>
                      <p className="mt-0.5 text-sm leading-6 text-secondary">{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
};
