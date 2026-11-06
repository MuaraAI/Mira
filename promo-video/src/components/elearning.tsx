import React from "react";
import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Hand,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Monitor,
  Moon,
  PencilLine,
  RefreshCw,
  User,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { DEMO } from "../data";
import { blinkOn } from "../lib/anim";

/**
 * Ilustrasi portal elearning kampus untuk perbandingan, digambar ulang dari tangkapan layar
 * yang diberikan. Logo resmi TIDAK disalin (diganti bentuk netral), dan semua data pribadi
 * diganti persona contoh Dinda.
 */

const FONT = "Inter, system-ui, sans-serif";

/** Bingkai browser netral (bukan gaya Mira) untuk adegan portal kampus. */
export const PlainBrowser: React.FC<{ url: string; width: number; height: number; children: React.ReactNode; tab?: string }> = ({ url, width, height, children, tab }) => (
  <div style={{ width, height: height + 44, background: "#fff", borderRadius: 14, overflow: "hidden", boxShadow: "0 30px 80px rgba(7,32,51,.35), 0 0 0 1px rgba(7,32,51,.18)" }}>
    <div style={{ height: 44, background: "#202124", display: "flex", alignItems: "center", gap: 10, padding: "0 16px" }}>
      <span style={{ width: 12, height: 12, borderRadius: 6, background: "#ff5f57" }} />
      <span style={{ width: 12, height: 12, borderRadius: 6, background: "#febc2e" }} />
      <span style={{ width: 12, height: 12, borderRadius: 6, background: "#28c840" }} />
      <div style={{ marginLeft: 18, flex: 1, maxWidth: 560, height: 28, borderRadius: 14, background: "#35363a", display: "flex", alignItems: "center", gap: 8, padding: "0 14px", color: "#e8eaed", fontFamily: FONT, fontSize: 14 }}>
        <Lock style={{ width: 13, height: 13, color: "#9aa0a6" }} />
        {url}
      </div>
      {tab && <span style={{ marginLeft: "auto", color: "#9aa0a6", fontFamily: FONT, fontSize: 13 }}>{tab}</span>}
    </div>
    <div style={{ position: "relative", width, height, overflow: "hidden" }}>{children}</div>
  </div>
);

/** Kotak kode keamanan (captcha) bergaya generik: huruf miring berwarna + garis pengacau. */
export const Captcha: React.FC<{ code: string; t: number; wobble?: number }> = ({ code, t, wobble = 1 }) => {
  const colors = ["#7f1d1d", "#1e1b4b", "#7e22ce", "#0f766e"];
  return (
    <div style={{ position: "relative", width: 224, height: 64, background: "#fff", borderRadius: 10, boxShadow: "0 0 0 1.5px #E4DDF7", display: "flex", alignItems: "center", justifyContent: "center", gap: 26, overflow: "hidden" }}>
      <svg width="224" height="64" style={{ position: "absolute", inset: 0 }}>
        <path d="M20 40 C 70 10, 120 60, 200 24" stroke="#A5B4FC" strokeWidth="1.5" fill="none" strokeDasharray="5 4" />
        <path d="M30 18 C 90 50, 140 6, 210 46" stroke="#C4B5FD" strokeWidth="1.2" fill="none" strokeDasharray="3 5" />
      </svg>
      {code.split("").map((ch, i) => (
        <span
          key={i}
          style={{
            fontFamily: "Georgia, serif",
            fontSize: 38,
            fontWeight: 700,
            color: colors[i % colors.length],
            transform: `rotate(${(i % 2 ? 12 : -10) + Math.sin(t * 6 + i) * 4 * wobble}deg) translateY(${(i - 1) * 4}px)`,
            display: "inline-block",
          }}
        >
          {ch}
        </span>
      ))}
    </div>
  );
};

const Field: React.FC<{ label: string; value: string; placeholder: string; focus?: boolean; t: number; right?: React.ReactNode; mono?: boolean }> = ({ label, value, placeholder, focus, t, right, mono }) => (
  <div style={{ marginTop: 26 }}>
    {label && <div style={{ fontFamily: FONT, fontSize: 17, fontWeight: 600, letterSpacing: "0.04em", color: "#374151" }}>{label}</div>}
    <div
      style={{
        marginTop: label ? 10 : 0,
        height: 64,
        borderRadius: 12,
        background: "#F7F5FD",
        boxShadow: focus ? "0 0 0 2.5px #7C3AED" : "0 0 0 1.5px #D9CFF5",
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        fontFamily: mono ? "JetBrains Mono, monospace" : FONT,
        fontSize: 20,
        color: value ? "#1F2937" : "#9CA3AF",
        justifyContent: right ? "space-between" : "flex-start",
      }}
    >
      <span style={{ display: "flex", alignItems: "center" }}>
        {value || placeholder}
        {focus && <span style={{ width: 2, height: 24, background: "#4C1D95", marginLeft: 3, opacity: blinkOn(t) ? 1 : 0 }} />}
      </span>
      {right}
    </div>
  </div>
);

export interface ElearningLoginState {
  nim: string;
  pw: number;
  captchaCode: string;
  captchaTyped: string;
  focus: "nim" | "pw" | "captcha" | null;
  press?: boolean;
}

/** Halaman login elearning (1920 x 1036 di dalam browser). */
export const ElearningLogin: React.FC<{ t: number; s: ElearningLoginState }> = ({ t, s }) => (
  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(120deg, #3B0A6B 0%, #4A1A8C 45%, #2C3FCB 100%)", overflow: "hidden", fontFamily: FONT }}>
    <div style={{ position: "absolute", left: -110, top: -120, width: 440, height: 440, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
    <div style={{ position: "absolute", left: 230, top: 540, width: 230, height: 230, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />
    <div style={{ position: "absolute", right: -140, top: 720, width: 420, height: 420, borderRadius: "50%", background: "rgba(255,255,255,.08)" }} />

    {/* Kiri: identitas portal (logo resmi diganti bentuk netral) */}
    <div style={{ position: "absolute", left: 430, top: 330 }}>
      <div style={{ display: "flex", gap: 14 }}>
        <div style={{ width: 146, height: 146, borderRadius: 14, background: "rgba(255,255,255,.14)", boxShadow: "inset 0 0 0 2px rgba(255,255,255,.25)" }} />
        <div style={{ width: 146, height: 146, borderRadius: "50%", background: "rgba(252,211,77,.35)", boxShadow: "inset 0 0 0 6px rgba(252,211,77,.45)" }} />
      </div>
      <div style={{ marginTop: 40, fontSize: 72, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>MyBest</div>
      <div style={{ marginTop: 6, fontSize: 30, fontWeight: 600, color: "rgba(255,255,255,.9)", lineHeight: 1.35 }}>
        Elearning Universitas
        <br />
        Bina Sarana Informatika
      </div>
      <div style={{ marginTop: 22, fontSize: 22, color: "rgba(255,255,255,.7)", lineHeight: 1.7 }}>
        09 November 2026
        <br />
        IP: 203.0.113.24
      </div>
      <div style={{ marginTop: 26, display: "flex", gap: 12 }}>
        {[
          ["E-Learning", "#60A5FA"],
          ["Absensi Online", "#34D399"],
          ["Ujian Online", "#FBBF24"],
        ].map(([label, c]) => (
          <span key={label} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 20px", borderRadius: 999, background: "rgba(255,255,255,.12)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,.25)", color: "#fff", fontSize: 19, fontWeight: 600 }}>
            <span style={{ width: 16, height: 16, borderRadius: 3, background: c }} />
            {label}
          </span>
        ))}
      </div>
    </div>

    {/* Kanan: kartu login */}
    <div style={{ position: "absolute", left: 1110, top: 150, width: 660, padding: "54px 56px 46px", borderRadius: 34, background: "#F9F8FD", boxShadow: "0 30px 60px rgba(0,0,0,.25)" }}>
      <div style={{ textAlign: "center", fontSize: 54, fontWeight: 800, letterSpacing: "-0.02em", background: "linear-gradient(90deg,#A21CAF,#7C3AED)", WebkitBackgroundClip: "text", color: "transparent" }}>MyBest</div>
      <Field t={t} label="NIP / NIM" value={s.nim} placeholder="Masukkan NIP Dosen / NIM Mahasiswa" focus={s.focus === "nim"} mono={Boolean(s.nim)} />
      <Field
        t={t}
        label="PASSWORD"
        value={"•".repeat(s.pw)}
        placeholder="Masukkan password"
        focus={s.focus === "pw"}
        right={<span style={{ color: "#7C3AED", fontWeight: 600, fontSize: 18 }}>Tampilkan</span>}
      />
      <div style={{ marginTop: 26, fontSize: 17, fontWeight: 600, letterSpacing: "0.04em", color: "#374151" }}>KODE KEAMANAN</div>
      <div style={{ marginTop: 10, display: "flex", gap: 14 }}>
        <div data-anchor="el-captcha" style={{ flex: 1, height: 92, borderRadius: 12, background: "#fff", boxShadow: "0 0 0 1.5px #E4DDF7", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Captcha code={s.captchaCode} t={t} />
        </div>
        <div style={{ width: 70, height: 70, alignSelf: "center", borderRadius: 12, background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <RefreshCw style={{ width: 26, height: 26, color: "#7C3AED" }} />
        </div>
      </div>
      <div data-anchor="el-captcha-input">
        <Field t={t} label="" value={s.captchaTyped} placeholder="Masukkan 3 karakter di atas" focus={s.focus === "captcha"} mono={Boolean(s.captchaTyped)} />
      </div>
      <div style={{ marginTop: 18, textAlign: "right", color: "#6D28D9", fontWeight: 600, fontSize: 18 }}>Lupa Password?</div>
      <div
        data-anchor="el-masuk"
        style={{
          marginTop: 24,
          height: 72,
          borderRadius: 14,
          background: "linear-gradient(90deg,#4C1D95,#2563EB)",
          color: "#fff",
          fontSize: 24,
          fontWeight: 700,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transform: s.press ? "scale(0.98)" : undefined,
        }}
      >
        Masuk
      </div>
    </div>
  </div>
);

/** Dashboard elearning: hanya pusat tautan ke portal lain. */
export const ElearningDashboard: React.FC<{ hoverStudent?: boolean }> = ({ hoverStudent }) => (
  <div style={{ position: "absolute", inset: 0, background: "#F5F7FB", fontFamily: FONT, display: "flex" }}>
    <aside style={{ width: 390, background: "#fff", borderRight: "1px solid #E5E7EB", padding: "26px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 58, height: 58, borderRadius: 12, background: "#E0E7FF" }} />
        <div>
          <div style={{ fontSize: 30, fontWeight: 800, color: "#1E3A8A" }}>MyBest</div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: "0.08em", color: "#6B7280" }}>PORTAL MAHASISWA</div>
        </div>
      </div>
      <div style={{ marginTop: 42, fontSize: 15, fontWeight: 700, letterSpacing: "0.12em", color: "#9CA3AF" }}>MENU UTAMA</div>
      {[
        [LayoutDashboard, "Dashboard", true],
        [Monitor, "Student V2"],
        [User, "Profil"],
        [PencilLine, "Ujian"],
        [BookOpen, "TOEFL"],
        [CalendarDays, "Jadwal Kuliah"],
      ].map(([Icon, label, on]) => {
        const I = Icon as typeof User;
        return (
          <div key={label as string} style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 18, padding: "10px 12px", borderRadius: 16, background: on ? "#EEF2FF" : "transparent" }}>
            <span style={{ width: 52, height: 52, borderRadius: 14, background: on ? "#1E40AF" : "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <I style={{ width: 24, height: 24, color: on ? "#fff" : "#4B5563" }} />
            </span>
            <span style={{ fontSize: 22, fontWeight: 600, color: on ? "#1E3A8A" : "#374151" }}>{label as string}</span>
            {label === "Jadwal Kuliah" && <ChevronDown style={{ marginLeft: "auto", width: 20, color: "#9CA3AF" }} />}
          </div>
        );
      })}
      <div style={{ marginTop: 24, borderTop: "1px solid #E5E7EB", paddingTop: 20, display: "flex", alignItems: "center", gap: 18, padding: "20px 12px 0" }}>
        <span style={{ width: 52, height: 52, borderRadius: 14, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <LogOut style={{ width: 24, height: 24, color: "#DC2626" }} />
        </span>
        <span style={{ fontSize: 22, fontWeight: 600, color: "#DC2626" }}>Keluar</span>
      </div>
    </aside>
    <main style={{ flex: 1, position: "relative" }}>
      <div style={{ height: 106, background: "#fff", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", gap: 22, padding: "0 40px" }}>
        <span style={{ width: 58, height: 58, borderRadius: 14, boxShadow: "inset 0 0 0 1px #E5E7EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Menu style={{ width: 24, color: "#374151" }} />
        </span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: "0.1em", color: "#6B7280" }}>PORTAL AKADEMIK MAHASISWA</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#1E3A8A" }}>Elearning Kampus</div>
        </div>
        <span style={{ marginLeft: "auto", width: 58, height: 58, borderRadius: 14, boxShadow: "inset 0 0 0 1px #E5E7EB", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Moon style={{ width: 24, color: "#374151" }} />
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "10px 16px", borderRadius: 18, boxShadow: "inset 0 0 0 1px #E5E7EB" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>{DEMO.namaKapital}</div>
            <div style={{ fontSize: 15, color: "#6B7280" }}>NIM {DEMO.nim}</div>
          </div>
          <span style={{ width: 54, height: 54, borderRadius: 14, background: "#1E40AF", color: "#fff", fontWeight: 800, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>DI</span>
        </div>
      </div>
      <div style={{ padding: "40px 44px" }}>
        <div style={{ height: 120, borderRadius: 24, background: "#1E3A8A", display: "flex", alignItems: "center", gap: 22, padding: "0 34px" }}>
          <span style={{ width: 66, height: 66, borderRadius: 33, background: "rgba(255,255,255,.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Hand style={{ width: 30, color: "#FCD34D" }} />
          </span>
          <div>
            <div style={{ fontSize: 30, fontWeight: 700, color: "#fff" }}>Selamat Datang, {DEMO.namaKapital}</div>
            <div style={{ marginTop: 4, fontSize: 19, color: "rgba(255,255,255,.8)" }}>
              Email: {DEMO.email} · NIM: {DEMO.nim}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 40, display: "flex", gap: 24 }}>
          {[
            { title: "Student V2", sub: "Portal Mahasiswa", desc: "Layanan sistem akademik mahasiswa & perkuliahan V2.", btn: "Buka Student V2", color: "#4F46E5", bg: "#EEF2FF", icon: Monitor, anchor: "el-student" },
            { title: "Halaman Ujian", sub: "Portal Ujian Online", desc: "Akses pelaksanaan ujian UTS/UAS/HER & pengerjaan soal.", btn: "Buka Ujian", color: "#B45309", bg: "#FFFBEB", icon: ClipboardList },
            { title: "TOEFL Online", sub: "Sertifikasi Bahasa", desc: "Layanan informasi & pelaksanaan tes TOEFL mahasiswa.", btn: "Buka TOEFL", color: "#047857", bg: "#ECFDF5", icon: BookOpen, ext: true },
          ].map((c) => (
            <div key={c.title} style={{ flex: 1, background: "#fff", borderRadius: 22, borderTop: `5px solid ${c.color}`, boxShadow: "0 1px 0 #E5E7EB, 0 0 0 1px #E5E7EB", padding: "26px 26px 24px" }}>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <span style={{ width: 62, height: 62, borderRadius: 14, background: c.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <c.icon style={{ width: 28, color: c.color }} />
                </span>
                <div>
                  <div style={{ fontSize: 25, fontWeight: 700, color: "#111827" }}>{c.title}</div>
                  <div style={{ fontSize: 17, color: "#6B7280" }}>{c.sub}</div>
                </div>
              </div>
              <div style={{ marginTop: 18, fontSize: 18, lineHeight: 1.5, color: "#6B7280", minHeight: 82 }}>{c.desc}</div>
              <div
                data-anchor={c.anchor}
                style={{
                  marginTop: 16,
                  height: 50,
                  borderRadius: 12,
                  background: c.anchor && hoverStudent ? c.color : c.bg,
                  color: c.anchor && hoverStudent ? "#fff" : c.color,
                  fontSize: 19,
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  boxShadow: `inset 0 0 0 1.5px ${c.color}40`,
                }}
              >
                {c.btn}
                {c.ext ? <ExternalLink style={{ width: 18 }} /> : <ArrowRight style={{ width: 18 }} />}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  </div>
);

/** Portal kedua (generik): login lagi dengan akun lain. */
export const SecondPortalLogin: React.FC = () => (
  <div style={{ position: "absolute", inset: 0, background: "#EEF1F5", fontFamily: FONT, display: "flex", alignItems: "center", justifyContent: "center" }}>
    <div style={{ width: 560, background: "#fff", borderRadius: 18, padding: "44px 48px", boxShadow: "0 10px 30px rgba(15,23,42,.12)" }}>
      <div style={{ fontSize: 30, fontWeight: 800, color: "#1F2937" }}>Student V2</div>
      <div style={{ marginTop: 4, fontSize: 18, color: "#6B7280" }}>Silakan login untuk melanjutkan</div>
      {["NIM", "Password"].map((p) => (
        <div key={p} style={{ marginTop: 22, height: 58, borderRadius: 10, boxShadow: "0 0 0 1.5px #D1D5DB", display: "flex", alignItems: "center", padding: "0 18px", color: "#9CA3AF", fontSize: 19 }}>
          {p}
        </div>
      ))}
      <div style={{ marginTop: 26, height: 60, borderRadius: 10, background: "#334155", color: "#fff", fontWeight: 700, fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center" }}>Login</div>
    </div>
  </div>
);
