import React from "react";
import { Img, spring, staticFile, useCurrentFrame } from "remotion";
import { FPS, HEIGHT, WIDTH, type Sweep } from "../timeline";
import { EASE_CAM, EASE_GLASS, EASE_HAND, EASE_IN, EASE_PX, clamp, lerp, prog, steps, type EaseFn } from "../lib/anim";

/* ------------------------------------------------------------------ */
/* Kamera virtual: fokus (x, y) di tengah layar dengan skala s.        */
/* ------------------------------------------------------------------ */

export interface CamState {
  x: number;
  y: number;
  s: number;
}
export interface CamKey extends CamState {
  t: number;
  dur: number;
  ease?: EaseFn;
}

export function camAt(t: number, init: CamState, keys: CamKey[]): CamState {
  let cur = init;
  for (const k of keys) {
    if (t <= k.t) break;
    const p = prog(t, k.t, k.dur, k.ease ?? EASE_CAM);
    cur = {
      x: lerp(cur.x, k.x, p),
      y: lerp(cur.y, k.y, p),
      // Skala diinterpolasi secara geometris supaya zoom terasa rata (tidak "ngebut" di awal).
      s: Math.exp(lerp(Math.log(cur.s), Math.log(k.s), p)),
    };
  }
  return cur;
}

/**
 * Jaga target kamera tetap di dalam konten (w x h) saat zoom cukup dekat, supaya frame
 * tidak memperlihatkan area kosong di luar jendela browser.
 */
export function fitKeys(keys: CamKey[], w: number, h: number): CamKey[] {
  return keys.map((k) => {
    const hw = WIDTH / 2 / k.s;
    const hh = HEIGHT / 2 / k.s;
    const x = hw * 2 <= w ? Math.min(Math.max(k.x, hw), w - hw) : k.x;
    const y = hh * 2 <= h ? Math.min(Math.max(k.y, hh), h - hh) : k.y;
    return { ...k, x, y };
  });
}

export const Camera: React.FC<{ cam: CamState; children: React.ReactNode }> = ({ cam, children }) => (
  <div
    style={{
      position: "absolute",
      left: 0,
      top: 0,
      transformOrigin: "0 0",
      transform: `translate(${WIDTH / 2}px, ${HEIGHT / 2}px) scale(${cam.s}) translate(${-cam.x}px, ${-cam.y}px)`,
    }}
  >
    {children}
  </div>
);

/* ------------------------------------------------------------------ */
/* Kursor pixel (panah klasik digambar per pixel, gaya PixelIcons Mira) */
/* ------------------------------------------------------------------ */

const CURSOR_MAP = [
  "X...........",
  "XX..........",
  "XoX.........",
  "XooX........",
  "XoooX.......",
  "XooooX......",
  "XoooooX.....",
  "XooooooX....",
  "XoooooooX...",
  "XooooooooX..",
  "XoooooooooX.",
  "XooooooXXXXX",
  "XoooXooX....",
  "XooXXooX....",
  "XoX..XooX...",
  "XX...XooX...",
  "X.....XooX..",
  "......XooX..",
  ".......XX...",
];

function cursorRects(ch: string) {
  const rects: { x: number; y: number; w: number }[] = [];
  CURSOR_MAP.forEach((row, y) => {
    let start = -1;
    for (let x = 0; x <= row.length; x++) {
      const on = row[x] === ch;
      if (on && start < 0) start = x;
      if (!on && start >= 0) {
        rects.push({ x: start, y, w: x - start });
        start = -1;
      }
    }
  });
  return rects;
}
const OUTLINE = cursorRects("X");
const FILL = cursorRects("o");
const SHAPE = [...OUTLINE, ...FILL];

export interface CursorKey {
  t: number;
  dur: number;
  x: number;
  y: number;
  arc?: number;
}

export function cursorAt(t: number, init: { x: number; y: number }, keys: CursorKey[]) {
  let cur = init;
  for (const k of keys) {
    if (t <= k.t) break;
    const p = prog(t, k.t, k.dur, EASE_HAND);
    const dx = k.x - cur.x;
    const dy = k.y - cur.y;
    const dist = Math.hypot(dx, dy) || 1;
    const arc = (k.arc ?? 0.09) * Math.min(dist, 800) * Math.sin(Math.PI * p);
    cur = { x: cur.x + dx * p + (-dy / dist) * arc, y: cur.y + dy * p + (dx / dist) * arc };
  }
  return cur;
}

/**
 * Kursor + efek klik (ring pixel bertingkat). Berada di dalam layer kamera, jadi ikut
 * membesar saat kamera zoom, seperti rekaman layar yang di-zoom.
 */
export const PixelCursor: React.FC<{
  t: number;
  init: { x: number; y: number };
  keys: CursorKey[];
  clicks: number[];
  show: [number, number];
  cell?: number;
}> = ({ t, init, keys, clicks, show, cell = 2 }) => {
  const visible = prog(t, show[0], 0.25, EASE_PX) * (1 - prog(t, show[1], 0.2, EASE_IN));
  if (visible <= 0) return null;
  const pos = cursorAt(t, init, keys);
  const pressing = clicks.some((c) => t >= c && t < c + 0.12);
  const scale = pressing ? 0.84 : 1;
  return (
    <>
      {clicks.map((c) => {
        if (t < c || t > c + 0.45) return null;
        const at = cursorAt(c, init, keys);
        const p = steps((t - c) / 0.45, 6);
        const size = lerp(12, 64, p) * (cell / 2);
        return (
          <div
            key={c}
            style={{
              position: "absolute",
              left: at.x - size / 2,
              top: at.y - size / 2,
              width: size,
              height: size,
              boxShadow: `0 0 0 ${3 * (cell / 2)}px rgba(3,105,161,${0.9 * (1 - p) * (1 - p)})`,
              pointerEvents: "none",
              zIndex: 290,
            }}
          />
        );
      })}
      <svg
        width={12 * cell}
        height={19 * cell}
        viewBox="0 0 12 19"
        shapeRendering="crispEdges"
        style={{
          position: "absolute",
          left: pos.x,
          top: pos.y,
          opacity: visible,
          overflow: "visible",
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
          zIndex: 300,
        }}
      >
        <g transform="translate(1.2 1.2)" fill="rgba(7,32,51,0.28)">
          {SHAPE.map((r) => (
            <rect key={`s${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} />
          ))}
        </g>
        <g fill="#072033">
          {OUTLINE.map((r) => (
            <rect key={`o${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} />
          ))}
        </g>
        <g fill="#FFFFFF">
          {FILL.map((r) => (
            <rect key={`f${r.x}-${r.y}`} x={r.x} y={r.y} width={r.w} height={1} />
          ))}
        </g>
      </svg>
    </>
  );
};

/** Tap jari di HP: kotak pixel yang menekan lalu ring bertingkat. */
export const TapMark: React.FC<{ t: number; at: number; x: number; y: number; size?: number }> = ({ t, at, x, y, size = 46 }) => {
  if (t < at - 0.3 || t > at + 0.5) return null;
  const approach = prog(t, at - 0.3, 0.3, EASE_PX);
  const after = clamp((t - at) / 0.5);
  const ring = steps(after, 6);
  const press = t >= at && t < at + 0.14;
  const dot = size * (press ? 0.78 : 1) * lerp(1.25, 1, approach);
  return (
    <>
      {t >= at && (
        <div
          style={{
            position: "absolute",
            left: x - lerp(size * 0.5, size * 1.5, ring) / 2,
            top: y - lerp(size * 0.5, size * 1.5, ring) / 2,
            width: lerp(size * 0.5, size * 1.5, ring),
            height: lerp(size * 0.5, size * 1.5, ring),
            boxShadow: `0 0 0 3px rgba(3,105,161,${0.85 * (1 - ring)})`,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: x - dot / 2,
          top: y - dot / 2,
          width: dot,
          height: dot,
          background: "rgba(7,32,51,0.22)",
          boxShadow: "0 0 0 2px rgba(255,255,255,0.7)",
          opacity: approach * (1 - prog(t, at + 0.2, 0.25, EASE_IN)),
        }}
      />
    </>
  );
};

/* ------------------------------------------------------------------ */
/* Sapuan tile pixel: transisi yang sama dengan menu HP Mira (takeover) */
/* ------------------------------------------------------------------ */

const TILE = 60;
const COLS = Math.ceil(WIDTH / TILE);
const ROWS = Math.ceil(HEIGHT / TILE);
const DIAG = COLS + ROWS - 2;

// Sama dengan tileColor() di Navbar.tsx Mira: taburan tile terang supaya terbaca pixel art.
function tileColor(c: number, r: number) {
  const h = (c * 73 + r * 151) % 29;
  if (h === 0) return "accent";
  if (h === 7 || h === 19) return "#0B2D46";
  return "#072033";
}

export const TileSweep: React.FC<{ t: number; sweep: Sweep }> = ({ t, sweep }) => {
  if (t < sweep.inStart || t > sweep.end) return null;
  const tileDur = 0.18;
  const spreadIn = Math.max(0.01, sweep.hold - sweep.inStart - tileDur);
  const spreadOut = Math.max(0.01, sweep.end - sweep.outStart - tileDur);
  // Tile aksen meredup ke #0E3A57 saat layar tertutup, seperti takeover Mira.
  const dim = prog(t, sweep.hold + 0.05, 0.5, EASE_GLASS);
  const accent = `rgb(${Math.round(lerp(3, 14, dim))}, ${Math.round(lerp(105, 58, dim))}, ${Math.round(lerp(161, 87, dim))})`;
  const tiles: React.ReactNode[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const d = (c + (ROWS - 1 - r)) / DIAG;
      const pin = steps(clamp((t - sweep.inStart - d * spreadIn) / tileDur), 3);
      const pout = steps(clamp((t - sweep.outStart - d * spreadOut) / tileDur), 3);
      const s = pin * (1 - pout);
      if (s <= 0) continue;
      const col = tileColor(c, r);
      tiles.push(
        <div
          key={`${c}-${r}`}
          style={{
            position: "absolute",
            left: c * TILE,
            top: r * TILE,
            width: TILE,
            height: TILE,
            background: col === "accent" ? accent : col,
            transform: `scale(${s === 1 ? 1.02 : s})`,
          }}
        />,
      );
    }
  }
  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 100 }}>
      {tiles}
      {null}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Stiker maskot Mura: ditempel dengan pegas, lalu napas pixel.        */
/* ------------------------------------------------------------------ */

export const Sticker: React.FC<{
  t: number;
  at: number;
  src: string;
  x: number;
  y: number;
  size: number;
  rotate?: number;
  exitAt?: number;
  flip?: boolean;
}> = ({ t, at, src, x, y, size, rotate = -4, exitAt, flip }) => {
  if (t < at) return null;
  const u = t - at;
  // Masuk: naik pelan dari bawah dan mengendap (pegas hampir kritis, tanpa goyang berlebihan).
  const sp = spring({ frame: Math.round(u * FPS), fps: FPS, config: { damping: 17, stiffness: 120, mass: 1 } });
  const out = exitAt !== undefined ? prog(t, exitAt, 0.35, EASE_IN) : 0;
  if (out >= 1) return null;
  // Diam: bernapas dari kaki, melayang, dan bergoyang tipis. Semua sinus halus, bukan patah-patah.
  const idle = clamp(u / 0.9);
  const breathe = Math.sin(u * Math.PI * 2 * 0.5) * 0.014 * idle;
  const floatY = Math.sin(u * Math.PI * 2 * 0.35 + 0.8) * 5 * idle;
  const sway = Math.sin(u * Math.PI * 2 * 0.27) * 1.2 * idle;
  const scale = lerp(0.92, 1, sp) * lerp(1, 0.95, out);
  const opacity = Math.min(1, u / 0.2) * (1 - out);
  return (
    <Img
      src={staticFile(src)}
      style={{
        position: "absolute",
        left: x,
        top: y + (1 - sp) * 48 + floatY + out * 26,
        width: size,
        height: size,
        objectFit: "contain",
        opacity,
        transformOrigin: "50% 100%",
        transform: `rotate(${rotate + sway + (1 - sp) * 4}deg) scale(${scale * (1 - breathe * 0.4)}, ${scale * (1 + breathe)})${flip ? " scaleX(-1)" : ""}`,
        filter: "drop-shadow(0 7px 0 rgba(7,32,51,0.16))",
      }}
    />
  );
};

/* ------------------------------------------------------------------ */
/* Sorotan: siku pixel yang "snap" ke target, plus label opsional.     */
/* ------------------------------------------------------------------ */

export const FocusBox: React.FC<{
  t: number;
  start: number;
  end: number;
  x: number;
  y: number;
  w: number;
  h: number;
  color?: string;
  label?: string;
  arm?: number;
  thick?: number;
}> = ({ t, start, end, x, y, w, h, color = "#0369A1", label, arm = 16, thick = 4 }) => {
  if (t < start || t > end + 0.2) return null;
  const snap = steps(prog(t, start, 0.24, (v) => v), 3);
  const out = prog(t, end, 0.2, EASE_IN);
  const gap = lerp(22, 6, snap);
  const op = Math.min(1, snap * 3) * (1 - out);
  const X = x - gap;
  const Y = y - gap;
  const W = w + gap * 2;
  const H = h + gap * 2;
  const corner = (cx: number, cy: number, sx: number, sy: number, key: string) => (
    <React.Fragment key={key}>
      <div style={{ position: "absolute", left: sx > 0 ? cx : cx - arm, top: sy > 0 ? cy : cy - thick, width: arm, height: thick, background: color }} />
      <div style={{ position: "absolute", left: sx > 0 ? cx : cx - thick, top: sy > 0 ? cy : cy - arm, width: thick, height: arm, background: color }} />
    </React.Fragment>
  );
  return (
    <div style={{ position: "absolute", left: 0, top: 0, opacity: op, zIndex: 200 }}>
      {corner(X, Y, 1, 1, "tl")}
      {corner(X + W, Y, -1, 1, "tr")}
      {corner(X, Y + H, 1, -1, "bl")}
      {corner(X + W, Y + H, -1, -1, "br")}
      {label && (
        <div
          className="font-mono"
          style={{
            position: "absolute",
            left: X,
            top: Y - 34,
            padding: "4px 10px",
            background: color,
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            boxShadow: "3px 3px 0 0 #072033",
            clipPath: `inset(0 ${100 - steps(prog(t, start + 0.08, 0.3, (v) => v), 8) * 100}% 0 0)`,
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Callout: kartu pixel + konektor putus-putus seperti .current-connector */
/* ------------------------------------------------------------------ */

export const Callout: React.FC<{
  t: number;
  start: number;
  end: number;
  x: number;
  y: number;
  toX: number;
  toY: number;
  kicker: string;
  text: string;
  tone?: "accent" | "success";
}> = ({ t, start, end, x, y, toX, toY, kicker, text, tone = "accent" }) => {
  if (t < start || t > end + 0.25) return null;
  const color = tone === "success" ? "#0F766E" : "#0369A1";
  const line = steps(prog(t, start, 0.3, (v) => v), 8);
  const card = prog(t, start + 0.15, 0.45, EASE_GLASS);
  const out = prog(t, end, 0.22, EASE_IN);
  const dx = toX - x;
  const dy = toY - y;
  const len = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  return (
    <div style={{ position: "absolute", left: 0, top: 0, opacity: 1 - out, zIndex: 210 }}>
      <div
        style={{
          position: "absolute",
          left: x,
          top: y - 2,
          width: len * line,
          height: 4,
          transformOrigin: "0 50%",
          transform: `rotate(${angle}deg)`,
          backgroundImage: `linear-gradient(90deg, ${color} 50%, transparent 50%)`,
          backgroundSize: "10px 4px",
        }}
      />
      <div style={{ position: "absolute", left: toX - 6, top: toY - 6, width: 12, height: 12, background: color, opacity: line >= 1 ? 1 : 0, boxShadow: "2px 2px 0 0 #9CC6E0" }} />
      <div
        style={{
          position: "absolute",
          left: x,
          top: y,
          transform: `translate(-50%, -50%) translateY(${(1 - card) * 14}px)`,
          opacity: card,
          background: "#fff",
          padding: "12px 18px",
          boxShadow: `0 -2px 0 0 #163A55, 0 2px 0 0 #163A55, -2px 0 0 0 #163A55, 2px 0 0 0 #163A55, 6px 6px 0 0 ${color}`,
          whiteSpace: "nowrap",
        }}
      >
        <div className="font-mono" style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color }}>
          {kicker}
        </div>
        <div className="font-display" style={{ fontSize: 26, fontWeight: 700, color: "#072033", marginTop: 2, letterSpacing: "-0.02em" }}>
          {text}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/* Latar kanvas Mira: mist + grid pixel 32px (grid-overlay dashboard). */
/* ------------------------------------------------------------------ */

export const MistBackground: React.FC<{ drift?: number }> = ({ drift = 0 }) => (
  <div
    style={{
      position: "absolute",
      inset: -64,
      background: "#F7FAFC",
      backgroundImage: "linear-gradient(rgba(7,32,51,0.045) 2px, transparent 2px), linear-gradient(90deg, rgba(7,32,51,0.045) 2px, transparent 2px)",
      backgroundSize: "40px 40px",
      transform: `translate(${(drift % 40) - 0}px, ${(drift * 0.5) % 40}px)`,
    }}
  />
);

export const InkBackground: React.FC<{ stripesShift?: number }> = ({ stripesShift = 0 }) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      backgroundColor: "#072033",
      backgroundImage: "repeating-linear-gradient(135deg, rgba(156,198,224,.07) 0 2px, transparent 2px 22px), linear-gradient(160deg, #072033 0%, #0B2D46 100%)",
      backgroundPosition: `${stripesShift}px 0, 0 0`,
    }}
  />
);

/** Teks naik dari balik masker, sama dengan .line-mask di hero Mira. */
export const LineRise: React.FC<{ t: number; at: number; dur?: number; children: React.ReactNode; style?: React.CSSProperties; className?: string }> = ({
  t,
  at,
  dur = 0.85,
  children,
  style,
  className,
}) => {
  const p = prog(t, at, dur, EASE_GLASS);
  return (
    <span style={{ display: "block", overflow: "hidden", paddingBottom: "0.08em" }}>
      <span className={className} style={{ display: "block", transform: `translateY(${(1 - p) * 105}%)`, ...style }}>
        {children}
      </span>
    </span>
  );
};

/** Masuk bertahap ala .stagger-rise Mira: naik 16px + fade. */
export function riseStyle(t: number, at: number, dur = 0.6, dist = 16): React.CSSProperties {
  const p = prog(t, at, dur, EASE_GLASS);
  return { opacity: p, transform: `translateY(${(1 - p) * dist}px)` };
}

/** Masuk halaman dashboard ala .page-in: naik 10px + fade 0.4s. */
export function pageIn(t: number, at: number): React.CSSProperties {
  const p = prog(t, at, 0.4, EASE_PX);
  return { opacity: p, transform: `translateY(${(1 - p) * 10}px)` };
}

export { EASE_CAM };
