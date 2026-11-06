import React from "react";
import { BookOpen, ClipboardCheck, GraduationCap, Library, Newspaper, UserCheck } from "lucide-react";
import { spring } from "remotion";
import { FPS, T } from "../timeline";
import { EASE_CAM, EASE_GLASS, EASE_IN, EASE_PX, clamp, lerp, prog, pulse } from "../lib/anim";
import { InkBackground } from "../components/motion";
import { AnimatedLogo, Wordmark } from "../components/logo";

/**
 * Reveal v3 ("Biar aku yang atur"): enam layanan kampus muncul berserakan di sekitar logo.
 * Tangan Mira mengetuk satu per satu (sinkron dengan narasi SIAKAD, MyBest, presensi) dan
 * kartu itu meluncur rapi ke satu kolom. Setelah tertata, garis halus menghubungkan tiap
 * kartu ke logo (muara), kartu mengalir masuk, lalu lockup Mira + satu baris slogan.
 */

const C0 = { x: 1230, y: 500 };
const SIZE = 250;
const CHIP_W = 300;
const CHIP_H = 66;
const COL_X = 540; // pusat kolom
const slotY = (i: number) => 255 + i * 95;

const CHIPS = [
  { name: "SIAKAD", Icon: GraduationCap, sx: 915, sy: 300, rot: -8 },
  { name: "MyBest LMS", Icon: BookOpen, sx: 830, sy: 392, rot: 10 },
  { name: "Presensi", Icon: UserCheck, sx: 940, sy: 480, rot: -5 },
  { name: "Ujian Online", Icon: ClipboardCheck, sx: 845, sy: 575, rot: 12 },
  { name: "Perpustakaan", Icon: Library, sx: 925, sy: 660, rot: -10 },
  { name: "Berita Kampus", Icon: Newspaper, sx: 835, sy: 742, rot: 7 },
];

/** Kapan tiap kartu dirapikan (ketukan tangan, lalu sapuan untuk tiga sisanya). */
const SNAP = [T.tap1, T.tap2, T.tap3, T.sweep + 0.18, T.sweep + 0.33, T.sweep + 0.48];
const ABSORB = (i: number) => T.absorb + i * 0.05;

function springAt(t: number, at: number, damping = 18, stiffness = 150) {
  if (t < at) return 0;
  return spring({ frame: Math.round((t - at) * FPS), fps: FPS, config: { damping, stiffness, mass: 1 } });
}

function bez(p0: number[], p1: number[], p2: number[], p3: number[], u: number) {
  const a = (1 - u) ** 3;
  const b = 3 * (1 - u) ** 2 * u;
  const c = 3 * (1 - u) * u ** 2;
  const d = u ** 3;
  return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
}

const inlet = (i: number) => [C0.x - SIZE * 0.46, C0.y + (i - 2.5) * 13];
/** Jalur dari tepi kanan kartu (kolom) ke logo. */
const route = (i: number, fromCenter = false) => {
  const y = slotY(i);
  const p0 = [fromCenter ? COL_X : COL_X + CHIP_W / 2, y];
  const p3 = inlet(i);
  return [p0, [COL_X + CHIP_W / 2 + 160, y], [p3[0] - 170, p3[1]], p3];
};

// Ujung telunjuk mengetuk sisi kanan kartu yang berserakan; arah telunjuk dari sisi logo.
const ANCHOR = { x: C0.x - 40, y: C0.y + 70 };
const tipKey = (x: number, y: number, at: number, move?: number) => {
  const aim = (Math.atan2(y - ANCHOR.y, x - ANCHOR.x) * 180) / Math.PI;
  return { t: at, x: x - C0.x, y: y - C0.y, tip: true, aim, move };
};

export const Reveal: React.FC<{ t: number }> = ({ t }) => {
  const up = prog(t, T.lockup, 0.6, EASE_CAM);
  const logoX = lerp(C0.x, 768, up);
  const logoY = lerp(C0.y, 452, up);
  const logoS = lerp(1, 0.8, up);
  const arrive = CHIPS.reduce((acc, _, i) => Math.max(acc, pulse(t, ABSORB(i) + 0.4, 0.22)), 0);

  const keys = [
    tipKey(CHIPS[0].sx + 70, CHIPS[0].sy, T.tap1 - 0.25),
    tipKey(CHIPS[1].sx + 70, CHIPS[1].sy, T.tap2, 0.5),
    tipKey(CHIPS[2].sx + 70, CHIPS[2].sy, T.tap3, 0.5),
    tipKey(CHIPS[5].sx + 70, CHIPS[5].sy, T.sweep + 0.5, 0.4),
    { t: T.connect + 0.25, x: COL_X + CHIP_W / 2 + 40 - C0.x, y: slotY(2.5) - C0.y, tip: true, aim: 180, move: 0.35 },
  ];

  const lineFade = 1 - prog(t, T.absorb + 0.55, 0.3, EASE_IN);

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <InkBackground stripesShift={t * 8} />

      {/* Garis muara: dari kolom yang sudah rapi ke logo */}
      {t >= T.connect && lineFade > 0 && (
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          {CHIPS.map((_, i) => {
            const [p0, p1, p2, p3] = route(i);
            const d = `M ${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}`;
            const draw = prog(t, T.connect + i * 0.04, 0.42, EASE_PX);
            const gone = prog(t, ABSORB(i), 0.4, EASE_IN);
            const L = 900;
            return (
              <g key={i} opacity={lineFade}>
                <path d={d} fill="none" stroke="#5FA3CC" strokeOpacity={0.7} strokeWidth={3} strokeLinecap="round" strokeDasharray={`${L * draw} ${L}`} strokeDashoffset={-L * gone} />
                {[0, 0.5].map((ph) => {
                  const u = ((t - T.connect - 0.15 + ph * 0.55) / 0.55) % 1;
                  if (t < T.connect + 0.15 || u > draw || u < gone) return null;
                  const [x, y] = bez(p0, p1, p2, p3, u);
                  return <rect key={ph} x={Math.round(x) - 4} y={Math.round(y) - 4} width={8} height={8} fill="#CFE2EE" />;
                })}
              </g>
            );
          })}
        </svg>
      )}

      {/* Kartu layanan */}
      {CHIPS.map(({ name, Icon, sx, sy, rot }, i) => {
        const appear = prog(t, T.chipsIn + i * 0.07, 0.5, EASE_GLASS);
        if (appear <= 0) return null;
        const s = springAt(t, SNAP[i]);
        const travel = prog(t, ABSORB(i), 0.4, EASE_IN);
        if (travel >= 1) return null;
        let x = lerp(sx, COL_X, s);
        let y = lerp(sy, slotY(i), s);
        let sc = lerp(0.88, 1, appear);
        if (travel > 0) {
          const [p0, p1, p2, p3] = route(i, true);
          [x, y] = bez(p0, p1, p2, p3, travel);
          sc *= lerp(1, 0.28, travel);
        }
        const r = lerp(rot, 0, s);
        const tidy = clamp(s);
        return (
          <div
            key={name}
            style={{
              position: "absolute",
              left: x,
              top: y + (1 - appear) * 16,
              width: CHIP_W,
              height: CHIP_H,
              transform: `translate(-50%, -50%) rotate(${r}deg) scale(${sc})`,
              opacity: appear * (1 - clamp((travel - 0.72) / 0.28)),
              background: "#FFFFFF",
              boxShadow: `0 0 0 2px ${tidy > 0.5 ? "#9CC6E0" : "#CFE2EE"}, ${Math.round(5 * tidy)}px ${Math.round(5 * tidy)}px 0 2px #0369A1`,
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "0 18px",
            }}
          >
            <span style={{ width: 40, height: 40, display: "grid", placeItems: "center", background: "#F0F7FB", boxShadow: "0 0 0 2px #CFE2EE" }}>
              <Icon size={22} color="#0369A1" strokeWidth={2.2} />
            </span>
            <span className="font-mono" style={{ fontSize: 23, fontWeight: 700, color: "#072033", whiteSpace: "nowrap" }}>
              {name}
            </span>
            <span style={{ marginLeft: "auto", width: 8, height: 8, background: "#0F766E", opacity: tidy }} />
          </div>
        );
      })}

      {/* Riak kecil di titik ketukan */}
      {[T.tap1, T.tap2, T.tap3].map((at, i) => {
        const p = prog(t, at, 0.45, EASE_GLASS);
        if (t < at || p >= 1) return null;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: CHIPS[i].sx + 70,
              top: CHIPS[i].sy,
              width: 70,
              height: 70,
              transform: `translate(-50%, -50%) scale(${lerp(0.3, 1.2, p)})`,
              border: "2px solid #9CC6E0",
              opacity: 1 - p,
            }}
          />
        );
      })}

      {/* Gelombang saat semua layanan masuk ke logo */}
      {(() => {
        const p = prog(t, ABSORB(5) + 0.38, 0.7, EASE_GLASS);
        if (p <= 0 || p >= 1) return null;
        const rr = SIZE / 2 + 20 + p * 120;
        return <div style={{ position: "absolute", left: C0.x - rr, top: C0.y - rr, width: rr * 2, height: rr * 2, borderRadius: "50%", border: "3px solid #9CC6E0", opacity: 1 - p }} />;
      })()}

      <AnimatedLogo
        t={t}
        x={logoX}
        y={logoY}
        size={SIZE}
        scale={logoS}
        appearAt={T.logoIn}
        dark
        pulse={arrive}
        arm={{ outAt: T.armOut, retractAt: T.connect + 0.45, keys, taps: [T.tap1, T.tap2, T.tap3], shoulder: 172, upper: 0.62, fore: 0.58, bend: -1 }}
      />

      <Wordmark t={t} at={T.lockup + 0.3} size={150} x={768 + 100 + 40} y={452 - 90} />

      {/* Slogan login Mira, satu baris */}
      <div
        className="font-display"
        style={{ position: "absolute", left: 0, right: 0, top: 640, textAlign: "center", fontSize: 72, fontWeight: 700, letterSpacing: "-0.035em", color: "#FFFFFF", whiteSpace: "nowrap" }}
      >
        {["Jadwal.", "Tugas.", "Satu pintu."].map((w, i) => {
          const p = prog(t, T.slogan + i * 0.1, 0.45, EASE_GLASS);
          return (
            <span key={w} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "bottom", paddingBottom: "0.06em", marginRight: i < 2 ? "0.32em" : 0 }}>
              <span style={{ display: "inline-block", transform: `translateY(${(1 - p) * 105}%)`, color: i === 2 ? "#FCD34D" : "#FFFFFF" }}>{w}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
};
