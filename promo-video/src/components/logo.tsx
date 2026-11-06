import React from "react";
import { Img, spring, staticFile } from "remotion";
import { FPS } from "../timeline";
import { EASE_GLASS, EASE_HAND, clamp, lerp, prog } from "../lib/anim";

/**
 * Karakter logo Mira (v3, lebih dewasa): ombak di dalam lingkaran berputar pelan, lalu dari
 * balik logo keluar lengan berjas dua ruas (lengan atas + lengan bawah, siku digerakkan IK),
 * manset kemeja putih, dan sarung tangan ramping. Geraknya tenang dan terarah, tanpa pantulan
 * karet: menunjuk, mengetuk, merapikan. Asisten yang "ngatur", bukan maskot kartun.
 */

export interface ArmKey {
  /** detik tangan TIBA di posisi ini */
  t: number;
  /** posisi relatif pusat logo (px, sebelum `scale`). Bila `tip` = true, ini posisi ujung telunjuk. */
  x: number;
  y: number;
  tip?: boolean;
  /** arah telunjuk (derajat, 0 = kanan, 180 = kiri) */
  aim: number;
  /** lama perjalanan dari posisi sebelumnya (detik) */
  move?: number;
}

export interface ArmPlan {
  outAt: number;
  retractAt?: number;
  keys: ArmKey[];
  /** waktu mengetuk (telunjuk maju lalu kembali) */
  taps?: number[];
  /** sudut bahu (derajat) di dalam lingkaran logo */
  shoulder?: number;
  /** panjang lengan atas & bawah relatif diameter logo */
  upper?: number;
  fore?: number;
  /** arah tekuk siku */
  bend?: 1 | -1;
}

const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
/** Selisih sudut terpendek a - b dalam derajat (-180..180). */
const angDiff = (a: number, b: number) => ((((a - b) % 360) + 540) % 360) - 180;

function springAt(t: number, at: number, damping: number, stiffness: number, mass = 1) {
  if (t < at) return 0;
  return spring({ frame: Math.round((t - at) * FPS), fps: FPS, config: { damping, stiffness, mass } });
}

/** Panjang tangan (pergelangan ke ujung telunjuk) dalam satuan gambar Glove. */
export const HAND_UNITS = 58;

/** Sarung tangan ramping menunjuk. Lokal: pergelangan di (0,0), telunjuk ke +x, jempol di -y. */
const Glove: React.FC<{ s: number; line: string }> = ({ s, line }) => {
  const sw = 1.7;
  const base = { fill: "#FFFFFF", stroke: line, strokeWidth: sw, strokeLinejoin: "round" as const };
  return (
    <g transform={`scale(${s})`}>
      {/* manset sarung tangan */}
      <rect x={-1} y={-9.5} width={10} height={19} rx={2.5} {...base} />
      {/* jari yang menekuk (tengah, manis, kelingking) */}
      <rect x={21} y={9} width={10} height={5.5} rx={2.75} {...base} fill="#EEF3F7" />
      <rect x={23} y={3.6} width={11.5} height={6.4} rx={3.2} {...base} fill="#F4F7FA" />
      <rect x={24} y={-2} width={12.5} height={6.8} rx={3.4} {...base} />
      {/* punggung tangan */}
      <path d="M7 -10.5 C 15 -12, 24 -11.5, 28 -8 L 29 8 C 26 12.5, 15 13, 7 11 Z" {...base} />
      {/* jempol rebah sejajar telunjuk */}
      <rect x={13} y={-15.5} width={19} height={6.4} rx={3.2} transform="rotate(7 13 -12)" {...base} />
      {/* telunjuk */}
      <rect x={25} y={-10.8} width={33} height={7.6} rx={3.8} {...base} />
      <line x1={53} y1={-9.2} x2={53} y2={-4.8} stroke="#D5E0E8" strokeWidth={1.1} strokeLinecap="round" />
      {/* jahitan punggung sarung tangan */}
      <line x1={10.5} y1={-4.5} x2={20} y2={-5} stroke="#C9D6E0" strokeWidth={1.2} strokeLinecap="round" />
      <line x1={10.5} y1={1} x2={20} y2={1.5} stroke="#C9D6E0" strokeWidth={1.2} strokeLinecap="round" />
      <line x1={10.5} y1={6.5} x2={19} y2={7.5} stroke="#C9D6E0" strokeWidth={1.2} strokeLinecap="round" />
    </g>
  );
};

/** Posisi target tangan pada waktu t: diam di tiap kunci, berpindah mulus menjelang kunci berikutnya. */
function armTarget(keys: ArmKey[], t: number, handLen: number) {
  const toWrist = (k: ArmKey) => (k.tip ? { x: k.x - Math.cos(rad(k.aim)) * handLen, y: k.y - Math.sin(rad(k.aim)) * handLen, aim: k.aim } : { x: k.x, y: k.y, aim: k.aim });
  let cur = toWrist(keys[0]);
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    const mv = k.move ?? 0.45;
    if (t <= k.t - mv) break;
    const nx = toWrist(k);
    const p = EASE_HAND(clamp((t - (k.t - mv)) / mv));
    cur = { x: lerp(cur.x, nx.x, p), y: lerp(cur.y, nx.y, p), aim: cur.aim + angDiff(nx.aim, cur.aim) * p };
  }
  return cur;
}

/** IK dua ruas: kembalikan siku dan pergelangan yang bisa dijangkau. */
function ik(sx: number, sy: number, wx: number, wy: number, l1: number, l2: number, bend: number) {
  const dx = wx - sx;
  const dy = wy - sy;
  const d = Math.hypot(dx, dy);
  const a = Math.atan2(dy, dx);
  const dd = clamp(d, Math.abs(l1 - l2) + 0.5, (l1 + l2) * 0.995);
  const cosA = (l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd);
  const A = Math.acos(clamp(cosA, -1, 1));
  const e = { x: sx + Math.cos(a + bend * A) * l1, y: sy + Math.sin(a + bend * A) * l1 };
  const w = { x: sx + Math.cos(a) * dd, y: sy + Math.sin(a) * dd };
  return { e, w };
}

export const AnimatedLogo: React.FC<{
  t: number;
  x: number;
  y: number;
  size: number;
  appearAt: number;
  arm?: ArmPlan;
  /** skala tambahan (mis. saat mengecil ke posisi lain) */
  scale?: number;
  ring?: boolean;
  /** latar gelap: lengan biru dengan garis tepi terang supaya tetap terlihat */
  dark?: boolean;
  /** 0..1 denyut saat sesuatu "masuk" ke logo */
  pulse?: number;
}> = ({ t, x, y, size, appearAt, arm, scale = 1, ring = true, dark = false, pulse = 0 }) => {
  if (t < appearAt) return null;
  const pop = springAt(t, appearAt, 15, 170, 0.9);
  const r = size / 2;
  const swirl = (t - appearAt) * 14;
  const breath = 1 + Math.sin((t - appearAt) * 2.0) * 0.008;
  const k = size / 150;

  let armEl: React.ReactNode = null;
  if (arm && t >= arm.outAt) {
    const out = springAt(t, arm.outAt, 22, 120, 1); // kritis teredam: keluar mantap, tanpa memantul
    const back = arm.retractAt !== undefined ? springAt(t, arm.retractAt, 24, 150, 1) : 0;
    const ext = clamp(out * (1 - back));
    if (ext > 0.01) {
      const gs = k * 1.05; // skala sarung tangan
      const handLen = HAND_UNITS * gs;
      const sh = rad(arm.shoulder ?? 180);
      const sx = Math.cos(sh) * r * 0.5;
      const sy = Math.sin(sh) * r * 0.5;
      const tgt = armTarget(arm.keys, t, handLen);
      // ketukan: tangan maju sedikit searah telunjuk lalu kembali
      const tap = (arm.taps ?? []).reduce((acc, at) => {
        if (t < at - 0.12 || t > at + 0.22) return acc;
        const u = (t - (at - 0.12)) / 0.34;
        return Math.max(acc, Math.sin(Math.PI * u) * (u < 0.35 ? 1 : 0.85));
      }, 0);
      const tx = tgt.x + Math.cos(rad(tgt.aim)) * tap * 12 * k;
      const ty = tgt.y + Math.sin(rad(tgt.aim)) * tap * 12 * k;
      const l1 = (arm.upper ?? 0.62) * size * ext;
      const l2 = (arm.fore ?? 0.58) * size * ext;
      const wx = lerp(sx, tx, ext);
      const wy = lerp(sy, ty, ext);
      const { e, w } = ik(sx, sy, wx, wy, l1, l2, arm.bend ?? -1);
      const fore = deg(Math.atan2(w.y - e.y, w.x - e.x));
      const hand = fore + clamp(angDiff(tgt.aim, fore), -42, 42);
      const flip = Math.cos(rad(hand)) < 0 ? -1 : 1;
      const sleeve = dark ? "#0B5B8C" : "#0B2D46";
      const edge = dark ? "#BFDCEE" : "#072033";
      const hi = dark ? "#2A86BE" : "#24506F";
      const wSleeve = 19 * k;
      const path = `M ${sx} ${sy} L ${e.x} ${e.y} L ${w.x} ${w.y}`;
      armEl = (
        <svg style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }} width={1} height={1}>
          <path d={path} fill="none" stroke={edge} strokeWidth={wSleeve + 4.4 * k} strokeLinecap="round" strokeLinejoin="round" />
          <path d={path} fill="none" stroke={sleeve} strokeWidth={wSleeve} strokeLinecap="round" strokeLinejoin="round" />
          <path d={path} fill="none" stroke={hi} strokeWidth={3.2 * k} strokeLinecap="round" strokeLinejoin="round" transform={`translate(${-2.6 * k} ${-4.2 * k})`} opacity={0.9} />
          {/* manset kemeja */}
          <g transform={`translate(${w.x} ${w.y}) rotate(${fore})`}>
            <rect x={-7.5 * k} y={-13.2 * k} width={9.5 * k} height={26.4 * k} rx={2.2 * k} fill="#FFFFFF" stroke={edge === "#BFDCEE" ? "#072033" : edge} strokeWidth={1.8 * k} />
            <rect x={-4.6 * k} y={6.5 * k} width={3.2 * k} height={3.2 * k} fill="#0369A1" />
          </g>
          <g transform={`translate(${w.x} ${w.y}) rotate(${hand}) scale(1 ${flip})`}>
            <Glove s={gs} line="#072033" />
          </g>
        </svg>
      );
    }
  }

  const beat = 1 + pulse * 0.045;
  return (
    <div style={{ position: "absolute", left: x, top: y, width: 0, height: 0, transform: `scale(${scale})` }}>
      {/* lengan di belakang lingkaran, seolah keluar dari balik logo */}
      {armEl}
      <div
        style={{
          position: "absolute",
          left: -r,
          top: -r,
          width: size,
          height: size,
          transform: `scale(${pop * breath * beat})`,
        }}
      >
        {ring && (
          <div
            style={{
              position: "absolute",
              inset: -7 * k,
              borderRadius: "50%",
              background: "#FFFFFF",
              boxShadow: `0 0 0 ${3 * k}px #072033, ${9 * k}px ${9 * k}px 0 ${3 * k}px #0369A1`,
            }}
          />
        )}
        <Img
          src={staticFile("logo/logo.png")}
          style={{ position: "absolute", inset: 0, width: size, height: size, objectFit: "contain", transform: `rotate(${swirl}deg)`, borderRadius: "50%" }}
        />
      </div>
    </div>
  );
};

/** Wordmark "Mira" + kicker MUARA AI yang ditulis dari kiri (clip bertingkat). */
export const Wordmark: React.FC<{ t: number; at: number; size: number; dark?: boolean; x: number; y: number }> = ({ t, at, size, dark, x, y }) => {
  const p = prog(t, at, 0.55, EASE_GLASS);
  const k = prog(t, at + 0.3, 0.45, EASE_GLASS);
  if (t < at) return null;
  return (
    <div style={{ position: "absolute", left: x, top: y, whiteSpace: "nowrap" }}>
      <div
        className="font-display"
        style={{
          fontSize: size,
          fontWeight: 700,
          lineHeight: 0.9,
          letterSpacing: "-0.045em",
          color: dark ? "#072033" : "#FFFFFF",
          clipPath: `inset(-12% ${100 - p * 100}% -12% 0)`,
          transform: `translateX(${(1 - p) * -18}px)`,
        }}
      >
        Mira
      </div>
      <div
        className="font-mono"
        style={{
          marginTop: size * 0.1,
          fontSize: size * 0.16,
          fontWeight: 700,
          letterSpacing: "0.3em",
          textTransform: "uppercase",
          color: dark ? "#0369A1" : "#9CC6E0",
          opacity: k,
          transform: `translateY(${(1 - k) * 8}px)`,
        }}
      >
        Muara AI
      </div>
    </div>
  );
};
