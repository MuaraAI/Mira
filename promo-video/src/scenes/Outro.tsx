import React from "react";
import { T, bar } from "../timeline";
import { LineRise, MistBackground, Sticker, riseStyle } from "../components/motion";
import { AnimatedLogo } from "../components/logo";
import { BlinkBlock } from "../components/ui";
import { EASE_GLASS, EASE_IN, prog, pulse } from "../lib/anim";

/** Outro: logo Mira menunjuk URL, headline landing 1:1, badge, disclaimer. */
export const Outro: React.FC<{ t: number }> = ({ t }) => {
  const poke = Math.max(pulse(t, T.poke1, 0.35), pulse(t, T.poke2, 0.35));
  const urlOn = t >= T.poke1 - 0.05 && t < T.tagline;
  const settle = prog(t, T.tagline, 1.2, EASE_GLASS);
  const s0 = bar(52);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <MistBackground drift={t * 6} />
      <div style={{ position: "absolute", left: 160, top: 150, width: 1150 }}>
        <div className="section-kicker" style={{ fontSize: 16, ...riseStyle(t, s0 + 0.3) }}>
          Gratis · Open source · Buatan mahasiswa UBSI
        </div>
        <h1 className="font-display" style={{ marginTop: 20, fontSize: 96, fontWeight: 700, lineHeight: 1.04, letterSpacing: "-0.045em", color: "#072033" }}>
          <LineRise t={t} at={s0 + 0.35}>Cek jadwal, tugas, </LineRise>
          <LineRise t={t} at={s0 + 0.47}>absen, dan nilai </LineRise>
          <LineRise t={t} at={s0 + 0.59} style={{ color: "#0369A1" }}>
            di satu tempat.
            <BlinkBlock t={t} style={{ display: "inline-block", width: "0.4em", height: "0.8em", marginLeft: 12, transform: "translateY(0.06em)", background: "#0369A1" }} />
          </LineRise>
        </h1>
      </div>

      {/* Logo + lengan menunjuk URL */}
      <AnimatedLogo
        t={t}
        x={255}
        y={655}
        size={170}
        appearAt={T.outroLogo}
        arm={{
          outAt: T.outroArm,
          shoulder: 0,
          bend: 1,
          upper: 0.62,
          fore: 0.58,
          keys: [
            { t: T.outroArm + 0.5, x: 150, y: 46, aim: -18 },
            { t: T.outroPoint, x: 272, y: 0, tip: true, aim: 0, move: 0.55 },
          ],
          taps: [T.poke1, T.poke2],
        }}
      />
      <div
        className="font-mono"
        style={{
          position: "absolute",
          left: 540,
          top: 655,
          transform: `translateY(calc(-50% + ${(1 - prog(t, T.outroPoint - 0.3, 0.6, EASE_GLASS)) * 12}px)) translateX(${poke * 6}px)`,
          opacity: prog(t, T.outroPoint - 0.3, 0.6, EASE_GLASS),
          fontSize: 44,
          fontWeight: 700,
          padding: "18px 28px",
          color: urlOn ? "#fff" : "#072033",
          background: urlOn ? "#0369A1" : "#fff",
          boxShadow: `0 -2px 0 0 #163A55, 0 2px 0 0 #163A55, -2px 0 0 0 #163A55, 2px 0 0 0 #163A55, ${6 + Math.round(poke * 4)}px ${6 + Math.round(poke * 4)}px 0 0 #FCD34D`,
        }}
      >
        mira.muaraai.com
      </div>

      <div style={{ position: "absolute", left: 160, top: 790, display: "flex", gap: 12, opacity: 1 - prog(t, T.tagline - 0.3, 0.3, EASE_IN) }}>
        {["Gratis", "Open source · MIT", "PWA: Android, iOS, desktop", "6 layanan kampus"].map((b, i) => (
          <span
            key={b}
            className="font-mono"
            style={{ fontSize: 17, fontWeight: 600, color: "#3B5A70", background: "#fff", border: "2px solid #CFE2EE", padding: "7px 14px", ...riseStyle(t, s0 + 1.9 + i * 0.08, 0.5, 10) }}
          >
            {b}
          </span>
        ))}
      </div>
      {/* Slogan penutup, pas dengan narasi "Sisanya, biar aku yang atur." */}
      <div className="font-display" style={{ position: "absolute", left: 160, top: 772, fontSize: 52, fontWeight: 700, letterSpacing: "-0.035em", color: "#072033", whiteSpace: "nowrap" }}>
        {["Sisanya,", "biar", "Mira", "yang", "atur."].map((w, i) => {
          const k = prog(t, T.tagline + [0, 1.0, 1.32, 1.72, 1.9][i], 0.55, EASE_GLASS);
          return (
            <span key={w} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", paddingBottom: "0.08em", marginRight: "0.28em" }}>
              <span style={{ display: "inline-block", transform: `translateY(${(1 - k) * 105}%)`, color: i >= 2 ? "#0369A1" : "#072033" }}>{w}</span>
            </span>
          );
        })}
      </div>

      <Sticker t={t} at={T.outroMura} src="maskot/mura_welcome.png" x={1360} y={230} size={480} rotate={-5} />

      <div style={{ position: "absolute", left: 160, right: 160, top: 52, display: "flex", justifyContent: "flex-end", ...riseStyle(t, s0 + 2.2) }}>
        <span className="font-mono" style={{ fontSize: 14, color: "#3B5A70", opacity: 0.85 + settle * 0.15 }}>
          Mira bukan aplikasi resmi UBSI · Data di video ini adalah data contoh (Dinda)
        </span>
      </div>
    </div>
  );
};
