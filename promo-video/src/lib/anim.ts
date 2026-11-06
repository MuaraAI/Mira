import { Easing, interpolate, useCurrentFrame } from "remotion";
import { FPS } from "../timeline";

/** Easing resmi Mira (DESIGN.md "hydro-motion"): cubic-bezier(0.16, 1, 0.3, 1). */
export const EASE_GLASS = Easing.bezier(0.16, 1, 0.3, 1);
/** Easing pixel Mira (--ease-px): cubic-bezier(0.22, 1, 0.36, 1). */
export const EASE_PX = Easing.bezier(0.22, 1, 0.36, 1);
/** Gerak kamera: mulai & berhenti halus. */
export const EASE_CAM = Easing.bezier(0.65, 0, 0.35, 1);
/** Gerak kursor tangan manusia: cepat di tengah, mendarat lembut. */
export const EASE_HAND = Easing.bezier(0.45, 0.05, 0.15, 1);
export const EASE_IN = Easing.bezier(0.55, 0, 0.85, 0.35);

export type EaseFn = (t: number) => number;

/** Detik global dari awal video. */
export const useTime = () => useCurrentFrame() / FPS;

/** Progres 0..1 dari `start` selama `dur` detik, sudah di-ease dan di-clamp. */
export function prog(t: number, start: number, dur: number, ease: EaseFn = EASE_GLASS) {
  if (dur <= 0) return t >= start ? 1 : 0;
  return interpolate(t, [start, start + dur], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: ease,
  });
}

/** Masuk lalu keluar: 0 -> 1 (in) ... 1 -> 0 (out). */
export function inOut(t: number, inStart: number, inDur: number, outStart: number, outDur: number, ease: EaseFn = EASE_GLASS) {
  return Math.min(prog(t, inStart, inDur, ease), 1 - prog(t, outStart, outDur, EASE_IN));
}

/** Seperti CSS steps(n, end): progres patah-patah ala pixel. */
export const steps = (p: number, n: number) => Math.min(1, Math.floor(p * n) / n);

export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

/** Waktu "patah-patah" (frame hold) untuk adegan portal lama yang sengaja terasa lemot. */
export const choppy = (t: number, fps = 12) => Math.floor(t * fps) / fps;

/** Kedip kursor teks (on/off), sama seperti .px-cursor (1 detik). */
export const blinkOn = (t: number, period = 1, start = 0) => ((t - start) % period + period) % period < period / 2;

/** Teks yang terketik: berapa karakter tampil pada waktu t. */
export function typed(text: string, t: number, start: number, cps: number) {
  if (t < start) return "";
  const n = Math.floor((t - start) * cps);
  return text.slice(0, Math.max(0, Math.min(text.length, n)));
}

/** Angka acak deterministik (render harus sama tiap frame). */
export function rand(seed: number) {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Pulsa 1 kali: 0 -> 1 -> 0 dalam `dur` detik. */
export function pulse(t: number, start: number, dur: number) {
  if (t < start || t > start + dur) return 0;
  const p = (t - start) / dur;
  return Math.sin(p * Math.PI);
}

/** Box-shadow bingkai pixel 2px + bayangan keras, sama seperti .px-card di Mira. */
export function pxShadow(line: string, drop?: string, off = 0, width = 2) {
  const parts = [`0 -${width}px 0 0 ${line}`, `0 ${width}px 0 0 ${line}`, `-${width}px 0 0 0 ${line}`, `${width}px 0 0 0 ${line}`];
  if (drop && off > 0) parts.push(`${off}px ${off}px 0 0 ${drop}`);
  return parts.join(", ");
}
