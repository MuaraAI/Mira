import React from "react";
import { Ban, KeyRound, Laptop, Lock, LogOut, ShieldCheck, Smartphone, Tablet } from "lucide-react";
import { spring } from "remotion";
import { FPS, T } from "../timeline";
import { LineRise, MistBackground, PixelCursor } from "../components/motion";
import { EASE_CAM, EASE_GLASS, EASE_PX, clamp, lerp, prog, pxShadow, rand } from "../lib/anim";

/**
 * Keamanan v3: tiga panel yang masing-masing "beraksi", kamera berpindah fokus mengikuti narasi.
 *  1. Password diketik -> berubah jadi sandi acak (AES-256-GCM) -> gembok mengunci.
 *  2. Percobaan login menumpuk sampai batas 10/menit -> percobaan ke-11 DIBLOKIR.
 *  3. Tiga sesi perangkat aktif -> klik "Keluar dari semua perangkat" -> semua sesi berakhir.
 * Fakta dari README Mira & halaman Sesi & Keamanan.
 */

function springAt(t: number, at: number, damping = 15, stiffness = 170) {
  if (t < at) return 0;
  return spring({ frame: Math.round((t - at) * FPS), fps: FPS, config: { damping, stiffness, mass: 1 } });
}

const PANEL_W = 520;
const PANEL_H = 480;
const PANEL_Y = 340;
const PANEL_X = [120, 700, 1280];
const ACTIVE = [T.amanIn, T.panel2, T.panel3];

const HEX = "0123456789abcdef";
const CIPHER = Array.from({ length: 32 }, (_, i) => HEX[Math.floor(rand(i + 7) * 16)]).join("");

const Panel: React.FC<{ i: number; t: number; icon: React.ElementType; title: string; sub: string; children: React.ReactNode; done: boolean }> = ({ i, t, icon: Icon, title, sub, children, done }) => {
  const appear = prog(t, T.amanIn + 0.25 + i * 0.1, 0.6, EASE_GLASS);
  const isActive = t >= ACTIVE[i] && (i === 2 || t < ACTIVE[i + 1]) && t < T.overview;
  const focus = prog(t, ACTIVE[i] - 0.1, 0.45, EASE_GLASS) * (1 - (i < 2 ? prog(t, ACTIVE[i + 1] - 0.1, 0.45, EASE_GLASS) : prog(t, T.overview, 0.4, EASE_GLASS)));
  const upcoming = t < ACTIVE[i] - 0.1;
  const overview = prog(t, T.overview, 0.5, EASE_GLASS);
  const opacity = appear * (upcoming ? lerp(0.45, 1, overview) : lerp(lerp(0.78, 1, focus), 1, overview));
  return (
    <div
      style={{
        position: "absolute",
        left: PANEL_X[i],
        top: PANEL_Y,
        width: PANEL_W,
        height: PANEL_H,
        background: "#FFFFFF",
        boxShadow: pxShadow("#163A55", isActive || overview > 0.5 ? "#0369A1" : "#CFE2EE", Math.round(lerp(5, 10, focus))),
        opacity,
        transform: `translateY(${(1 - appear) * 40 - focus * 10}px)`,
        padding: "28px 30px",
        overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <span style={{ width: 52, height: 52, display: "grid", placeItems: "center", background: done ? "#0F766E" : "#F0F7FB", boxShadow: `0 0 0 2px ${done ? "#0F766E" : "#CFE2EE"}` }}>
          <Icon style={{ width: 26, height: 26, color: done ? "#FFFFFF" : "#0369A1" }} />
        </span>
        <div>
          <div className="font-display" style={{ fontSize: 29, fontWeight: 700, color: "#072033", letterSpacing: "-0.02em" }}>
            {title}
          </div>
          <div className="font-mono" style={{ fontSize: 15, color: "#3B5A70", marginTop: 3 }}>
            {sub}
          </div>
        </div>
      </div>
      <div style={{ position: "relative", marginTop: 28 }}>{children}</div>
    </div>
  );
};

/* -------------------------------------------------- panel 1: enkripsi */
const Enkripsi: React.FC<{ t: number }> = ({ t }) => {
  const dots = clamp(Math.floor((t - T.pwType) / 0.07) + 1, 0, 9);
  const scr = prog(t, T.encrypt, 0.85, (v) => v);
  const locked = springAt(t, T.lockShut, 13, 190);
  const arrow = prog(t, T.encrypt - 0.25, 0.35, EASE_GLASS);
  const text = CIPHER.split("")
    .map((c, i) => {
      const settle = i / CIPHER.length;
      if (t < T.encrypt) return "·";
      if (scr > settle * 0.8 + 0.2) return c;
      return HEX[Math.floor(rand(i * 31 + Math.floor(t * 30)) * 16)];
    })
    .join("");
  const groups = text.match(/.{1,4}/g) ?? [];
  return (
    <div>
      <div className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: "#3B5A70", letterSpacing: "0.12em" }}>
        PASSWORD SIAKAD
      </div>
      <div className="px-input" data-focus={t >= T.pwType - 0.2 && t < T.encrypt ? "" : undefined} style={{ marginTop: 10, height: 58, display: "flex", alignItems: "center", padding: "0 18px", fontSize: 30, letterSpacing: "0.22em", color: "#072033", background: "#fff" }}>
        {"•".repeat(Math.max(0, dots))}
      </div>
      <div style={{ height: 70, display: "flex", alignItems: "center", justifyContent: "center", opacity: arrow }}>
        <div style={{ width: 4, height: 34 * arrow, background: "#0369A1" }} />
        <span className="font-mono" style={{ marginLeft: 14, fontSize: 15, fontWeight: 700, color: "#0369A1", letterSpacing: "0.1em" }}>
          DIENKRIPSI
        </span>
      </div>
      <div style={{ position: "relative", padding: "18px 20px", background: "#131B26", minHeight: 118, opacity: prog(t, T.encrypt - 0.1, 0.3, EASE_GLASS) }}>
        <div className="font-mono tabular" style={{ fontSize: 22, lineHeight: 1.55, color: "#CDD6F4", letterSpacing: "0.04em", wordSpacing: "0.3em" }}>
          {groups.slice(0, 4).join(" ")}
          <br />
          {groups.slice(4).join(" ")}
        </div>
        <span className="font-mono" style={{ position: "absolute", right: 14, top: 10, fontSize: 13, fontWeight: 700, color: "#7DD3FC" }}>
          AES-256-GCM
        </span>
      </div>
      {/* gembok menutup di atas sandi */}
      <div
        style={{
          position: "absolute",
          right: 18,
          top: 208,
          width: 84,
          height: 84,
          display: "grid",
          placeItems: "center",
          background: "#0F766E",
          boxShadow: "5px 5px 0 0 #072033",
          opacity: clamp(locked * 1.5),
          transform: `scale(${lerp(1.5, 1, locked)}) rotate(${lerp(-12, 0, locked)}deg)`,
        }}
      >
        <Lock style={{ width: 44, height: 44, color: "#FFFFFF" }} />
      </div>
    </div>
  );
};

/* -------------------------------------------------- panel 2: batas login */
const Batas: React.FC<{ t: number }> = ({ t }) => {
  const n = clamp(Math.floor((t - T.attempts) / 0.1) + 1, 0, 10);
  const blocked = springAt(t, T.blocked, 12, 200);
  const shake = t >= T.blocked && t < T.blocked + 0.35 ? Math.sin((t - T.blocked) * 70) * 6 * (1 - (t - T.blocked) / 0.35) : 0;
  const rows = Array.from({ length: Math.max(0, n) }, (_, i) => i);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span className="font-mono" style={{ fontSize: 15, fontWeight: 700, color: "#3B5A70", letterSpacing: "0.12em" }}>
          IP 203.0.113.24
        </span>
        <span className="font-mono tabular" style={{ fontSize: 22, fontWeight: 700, color: n >= 10 ? "#BE123C" : "#072033" }}>
          {Math.max(0, n)} / 10 per menit
        </span>
      </div>
      <div style={{ marginTop: 10, height: 14, background: "#EAF3F9", boxShadow: "0 0 0 2px #CFE2EE" }}>
        <div style={{ height: "100%", width: `${Math.max(0, n) * 10}%`, background: n >= 10 ? "#BE123C" : "#0369A1" }} />
      </div>
      <div style={{ position: "relative", marginTop: 18, height: 236, overflow: "hidden" }}>
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", gap: 6 }}>
          {rows.map((i) => (
            <div key={i} className="font-mono" style={{ display: "flex", justifyContent: "space-between", padding: "5px 12px", background: "#F7FAFC", boxShadow: "0 0 0 1px #D9E5ED", fontSize: 15, color: "#3B5A70" }}>
              <span>Percobaan login #{i + 1}</span>
              <span style={{ color: "#9A3412" }}>ditolak</span>
            </div>
          ))}
        </div>
      </div>
      {t >= T.blocked && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: 150,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 22px",
            background: "#BE123C",
            color: "#fff",
            boxShadow: "6px 6px 0 0 #072033",
            transform: `translate(calc(-50% + ${shake}px), 0) scale(${lerp(1.6, 1, blocked)}) rotate(-4deg)`,
            opacity: clamp(blocked * 1.6),
          }}
        >
          <Ban style={{ width: 30, height: 30 }} />
          <span className="font-mono" style={{ fontSize: 30, fontWeight: 700, letterSpacing: "0.14em" }}>
            DIBLOKIR
          </span>
        </div>
      )}
    </div>
  );
};

/* -------------------------------------------------- panel 3: sesi perangkat */
const SESI = [
  { Icon: Laptop, name: "Laptop · Chrome", place: "Pontianak · sekarang" },
  { Icon: Smartphone, name: "HP · Android", place: "Pontianak · 2 jam lalu" },
  { Icon: Tablet, name: "Tablet · Safari", place: "Pontianak · kemarin" },
];
const Sesi: React.FC<{ t: number }> = ({ t }) => {
  const pressed = t >= T.logoutClick && t < T.logoutClick + 0.14;
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {SESI.map(({ Icon, name, place }, i) => {
          const off = prog(t, T.loggedOut + i * 0.13, 0.3, EASE_PX);
          return (
            <div key={name} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: off > 0.5 ? "#F7FAFC" : "#FFFFFF", boxShadow: "0 0 0 2px #D9E5ED" }}>
              <Icon style={{ width: 26, height: 26, color: off > 0.5 ? "#9CB3C4" : "#0369A1" }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 19, fontWeight: 700, color: off > 0.5 ? "#7A93A6" : "#072033", textDecoration: off > 0.5 ? "line-through" : "none" }}>{name}</div>
                <div className="font-mono" style={{ fontSize: 13, color: "#3B5A70" }}>
                  {place}
                </div>
              </div>
              <span className="font-mono" style={{ fontSize: 13, fontWeight: 700, padding: "3px 8px", color: "#fff", background: off > 0.5 ? "#7A93A6" : "#0F766E", transform: `scale(${1 + Math.sin(off * Math.PI) * 0.18})` }}>
                {off > 0.5 ? "KELUAR" : "AKTIF"}
              </span>
            </div>
          );
        })}
      </div>
      <div
        data-anchor="logout-all"
        style={{
          marginTop: 22,
          height: 56,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          fontSize: 20,
          fontWeight: 700,
          color: pressed ? "#fff" : "#BE123C",
          background: pressed ? "#BE123C" : "#FFF1F2",
          boxShadow: `0 0 0 2px #BE123C, ${pressed ? 1 : 4}px ${pressed ? 1 : 4}px 0 2px #072033`,
          transform: pressed ? "translate(3px, 3px)" : undefined,
        }}
      >
        <LogOut style={{ width: 22, height: 22 }} />
        Keluar dari semua perangkat
      </div>
      <div
        className="font-mono"
        style={{ marginTop: 14, textAlign: "center", fontSize: 15, fontWeight: 700, color: "#0F766E", opacity: prog(t, T.loggedOut + 0.45, 0.35, EASE_GLASS) }}
      >
        Semua sesi diakhiri.
      </div>
    </div>
  );
};

export const Aman: React.FC<{ t: number }> = ({ t }) => {
  // Kamera: dorong pelan ke panel yang sedang dibahas, lalu mundur ke tampilan utuh.
  const f2 = prog(t, T.panel2 - 0.15, 0.75, EASE_CAM);
  const f3 = prog(t, T.panel3 - 0.15, 0.75, EASE_CAM);
  const ov = prog(t, T.overview, 0.7, EASE_CAM);
  const camX = lerp(lerp(lerp(150, 0, f2), -150, f3), 0, ov);
  const camS = lerp(1.07, 1, ov) + prog(t, T.amanIn, 3, EASE_GLASS) * 0.01;
  const BTN = { x: PANEL_X[2] + 30 + (PANEL_W - 60) / 2, y: PANEL_Y + 28 + 52 + 28 + 3 * 70 + 22 + 28 };
  const btnScreen = { x: 960 + (BTN.x - 960) * camS + camX, y: 540 + (BTN.y - 540) * camS };

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <MistBackground drift={t * 6} />
      {/* Judul tetap di tempat; panel bergerak bersama kamera */}
      <div style={{ position: "absolute", left: 120, top: 120 }}>
        <div className="section-kicker" style={{ fontSize: 16 }}>
          <LineRise t={t} at={T.amanIn + 0.15} dur={0.6}>
            Keamanan
          </LineRise>
        </div>
        <h2 className="font-display" style={{ marginTop: 10, fontSize: 88, fontWeight: 700, lineHeight: 1.0, letterSpacing: "-0.045em", color: "#072033" }}>
          <LineRise t={t} at={T.amanIn + 0.25}>
            Akunmu tetap aman.
          </LineRise>
        </h2>
      </div>
      <div style={{ position: "absolute", left: 1500, top: 150, display: "flex", alignItems: "center", gap: 12, opacity: prog(t, T.overview + 0.2, 0.45, EASE_GLASS), transform: `translateY(${(1 - prog(t, T.overview + 0.2, 0.45, EASE_GLASS)) * 14}px)` }}>
        <ShieldCheck style={{ width: 40, height: 40, color: "#0F766E" }} />
        <span className="font-mono" style={{ fontSize: 18, fontWeight: 700, color: "#0F766E", letterSpacing: "0.12em" }}>
          3 LAPIS PERLINDUNGAN
        </span>
      </div>

      <div style={{ position: "absolute", inset: 0, transformOrigin: "960px 540px", transform: `translateX(${camX}px) scale(${camS})` }}>
        <Panel i={0} t={t} icon={KeyRound} title="Password terenkripsi" sub="tidak pernah disimpan polos" done={t >= T.lockShut + 0.2}>
          <Enkripsi t={t} />
        </Panel>
        <Panel i={1} t={t} icon={Ban} title="Login dibatasi" sub="maks 10 kali per menit per IP" done={t >= T.blocked + 0.3}>
          <Batas t={t} />
        </Panel>
        <Panel i={2} t={t} icon={LogOut} title="Logout semua perangkat" sub="dari halaman Sesi & Keamanan" done={t >= T.loggedOut + 0.4}>
          <Sesi t={t} />
        </Panel>
      </div>

      <PixelCursor
        t={t}
        init={{ x: btnScreen.x + 160, y: btnScreen.y + 150 }}
        keys={[{ t: T.logoutClick - 0.8, dur: 0.72, x: btnScreen.x + 40, y: btnScreen.y + 8 }]}
        clicks={[T.logoutClick]}
        show={[T.logoutClick - 1.0, T.overview + 0.1]}
      />
    </div>
  );
};

