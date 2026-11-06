// Audio v3 video Mira, dijadwalkan dari src/timeline.ts:
//  - narasi: klip ElevenLabs suara "MwM" (suara/vo/*.wav, dibuat scripts/gen-vo.mjs)
//  - SFX: sampel ElevenLabs Sound Effects (suara/sfx/*.opus, dibuat scripts/gen-sfx.mjs)
//  - musik: disintesis di sini (lo-fi chiptune, mengikuti bagian MUSIC di timeline)
// Output (48 kHz, stereo, 16-bit) di audio/: vo.wav, sfx.wav, musik.wav,
//   mix-lengkap.wav (narasi + SFX + musik), mix-tanpa-musik.wav (narasi + SFX),
//   mix-tanpa-narasi.wav (SFX + musik, untuk dubbing ulang)
// Jalankan: node --no-warnings scripts/audio.mjs
import fs from "node:fs";
import path from "node:path";
import { CUES, MUSIC, DURATION, BAR, BPM, VO, T } from "../src/timeline.ts";
import { decodeMono } from "./eleven.mjs";

const SR = 48000;
const N = Math.ceil((DURATION + 0.05) * SR);
const TAU = Math.PI * 2;

/* ------------------------------------------------------------------ util */

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
const db = (d) => Math.pow(10, d / 20);

class Bus {
  constructor() {
    this.L = new Float32Array(N);
    this.R = new Float32Array(N);
  }
  /** tambah sinyal mono di detik t dengan gain & pan (0 kiri .. 1 kanan) */
  add(t, mono, gain = 1, pan = 0.5) {
    const i0 = Math.round(t * SR);
    const a = (pan * Math.PI) / 2;
    const gl = Math.cos(a) * gain * Math.SQRT2;
    const gr = Math.sin(a) * gain * Math.SQRT2;
    for (let i = 0; i < mono.length; i++) {
      const j = i0 + i;
      if (j < 0 || j >= N) continue;
      this.L[j] += mono[i] * gl;
      this.R[j] += mono[i] * gr;
    }
  }
  addStereo(t, L, R, gain = 1) {
    const i0 = Math.round(t * SR);
    for (let i = 0; i < L.length; i++) {
      const j = i0 + i;
      if (j < 0 || j >= N) continue;
      this.L[j] += L[i] * gain;
      this.R[j] += R[i] * gain;
    }
  }
}

/** Biquad RBJ */
class Biquad {
  constructor(type, f, q = 0.707) {
    this.type = type;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
    this.set(f, q);
  }
  set(f, q = this.q) {
    this.q = q;
    const w = (TAU * Math.min(f, SR * 0.45)) / SR;
    const cw = Math.cos(w);
    const sw = Math.sin(w);
    const al = sw / (2 * q);
    let b0, b1, b2, a0, a1, a2;
    if (this.type === "lp") {
      b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
    } else if (this.type === "hp") {
      b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
    } else {
      b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
    }
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  p(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

/** Freeverb sederhana (8 comb + 4 allpass per kanal). */
function reverb(L, R, { room = 0.82, damp = 0.35, wet = 0.25, dry = 1 } = {}) {
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((v) => Math.round((v * SR) / 44100));
  const apT = [556, 441, 341, 225].map((v) => Math.round((v * SR) / 44100));
  const run = (inp, spread) => {
    const out = new Float32Array(inp.length);
    const combs = combT.map((t) => ({ b: new Float32Array(t + spread), i: 0, f: 0 }));
    const aps = apT.map((t) => ({ b: new Float32Array(t + spread), i: 0 }));
    for (let n = 0; n < inp.length; n++) {
      const x = inp[n] * 0.015;
      let s = 0;
      for (const c of combs) {
        const y = c.b[c.i];
        c.f = y * (1 - damp) + c.f * damp;
        c.b[c.i] = x + c.f * room;
        c.i = (c.i + 1) % c.b.length;
        s += y;
      }
      for (const a of aps) {
        const y = a.b[a.i];
        a.b[a.i] = s + y * 0.5;
        a.i = (a.i + 1) % a.b.length;
        s = y - s;
      }
      out[n] = s;
    }
    return out;
  };
  const wl = run(L, 0);
  const wr = run(R, 23);
  const oL = new Float32Array(L.length);
  const oR = new Float32Array(R.length);
  for (let n = 0; n < L.length; n++) {
    oL[n] = L[n] * dry + wl[n] * wet;
    oR[n] = R[n] * dry + wr[n] * wet;
  }
  return [oL, oR];
}

const env = (n, attack, decay) => {
  // attack (detik) linear lalu decay eksponensial (konstanta waktu)
  const a = Math.max(1, Math.round(attack * SR));
  return (i) => (i < a ? i / a : Math.exp(-(i - a) / (decay * SR)));
};

function buf(sec) {
  return new Float32Array(Math.max(1, Math.round(sec * SR)));
}

/* ------------------------------------------------------------------ musik */

const BEAT = 60 / BPM;
const S16 = BEAT / 4;

const CH = {
  Fmaj7: { bass: 41, v: [53, 57, 60, 64] },
  Em7: { bass: 40, v: [52, 55, 59, 62] },
  Dm7: { bass: 38, v: [50, 53, 57, 60] },
  Cmaj7: { bass: 36, v: [48, 52, 55, 59, 62] },
  Am7: { bass: 33, v: [45, 48, 52, 55] },
  E7sus: { bass: 40, v: [52, 57, 59, 62] },
  E7: { bass: 40, v: [52, 56, 59, 62] },
  Bbmaj7: { bass: 34, v: [46, 50, 53, 57] },
  Gm7: { bass: 31, v: [43, 46, 50, 53] },
  A7sus: { bass: 33, v: [45, 50, 52, 55] },
};
const MAIN = ["Fmaj7", "Em7", "Dm7", "Cmaj7"];
const DARK = ["Dm7", "Bbmaj7", "Gm7", "A7sus"];
const INTRO = ["Am7", "Am7", "Fmaj7", "E7sus", "E7"];

function sectionAt(t) {
  return (MUSIC.find((m) => t >= m.from && t < m.to) ?? MUSIC[MUSIC.length - 1]).section;
}

function chordAtBar(b) {
  const t = b * BAR;
  const s = sectionAt(t);
  if (s === "intro") return CH[INTRO[Math.min(b, INTRO.length - 1)]];
  if (s === "dark") return CH[DARK[(b - 42) % 4]];
  if (s === "outro") {
    const k = b - 52;
    return CH[["Fmaj7", "Em7", "Dm7", "Cmaj7"][Math.min(3, k)]];
  }
  return CH[MAIN[(b - 5 + 400) % 4]];
}

function kickVoice() {
  const out = buf(0.45);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    ph += (TAU * (45 + 95 * Math.exp(-t / 0.035))) / SR;
    out[i] = Math.sin(ph) * Math.min(1, t / 0.001) * Math.exp(-t / 0.14) + (i < 90 ? (1 - i / 90) * 0.25 : 0);
  }
  return out;
}
function snareVoice(r) {
  const out = buf(0.3);
  const bp = new Biquad("bp", 1900, 0.8);
  let ph = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    ph += (TAU * 190) / SR;
    out[i] = bp.p(r() * 2 - 1) * Math.exp(-t / 0.075) * 0.9 + Math.sin(ph) * Math.exp(-t / 0.035) * 0.35;
  }
  return out;
}
function hatVoice(r, open = false) {
  const out = buf(open ? 0.3 : 0.08);
  const hp = new Biquad("hp", 7500, 0.7);
  const hp2 = new Biquad("hp", 6000, 0.7);
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] = hp2.p(hp.p(r() * 2 - 1)) * Math.exp(-t / (open ? 0.09 : 0.018));
  }
  return out;
}

function renderMusic() {
  const r = rng(2026);
  const bus = new Bus();
  const pad = new Bus();
  const totalBars = Math.ceil(DURATION / BAR);
  const kick = kickVoice();
  const duck = new Float32Array(N); // envelope sidechain

  // ---- drum & bass per 16th
  for (let b = 0; b < totalBars; b++) {
    const t0 = b * BAR;
    const s = sectionAt(t0 + 0.01);
    const chord = chordAtBar(b);
    for (let k = 0; k < 16; k++) {
      const swing = k % 2 === 1 ? S16 * 0.12 : 0;
      const t = t0 + k * S16 + swing;
      if (t >= DURATION - 2.2 && s === "outro") continue; // drum berhenti menjelang akhir
      const drums = s !== "breakdown" && s !== "intro";
      const lightDrums = s === "dark";
      // kick
      const kickHits = s === "intro" ? (b >= 2 && k === 0 ? [0] : []) : lightDrums ? (k === 0 || k === 10 ? [k] : []) : k === 0 || k === 7 || k === 8 || (k === 14 && b % 2 === 1) ? [k] : [];
      if (kickHits.length && s !== "breakdown") {
        bus.add(t, kick, s === "intro" ? 0.35 : 0.62, 0.5);
        const i0 = Math.round(t * SR);
        for (let i = 0; i < 0.3 * SR && i0 + i < N; i++) duck[i0 + i] = Math.max(duck[i0 + i], Math.exp(-i / (0.09 * SR)));
      }
      // snare/clap di ketukan 2 & 4
      if (drums && !lightDrums && (k === 4 || k === 12)) bus.add(t, snareVoice(r), 0.32, 0.52);
      if (lightDrums && k === 12) bus.add(t, snareVoice(r), 0.18, 0.55);
      // build: snare roll di bar terakhir sebelum outro
      if (s === "build" && b === 51 && k >= 8) bus.add(t, snareVoice(r), 0.12 + 0.02 * (k - 8), 0.5);
      // hats
      const hat16 = s === "chat" || s === "build";
      if (s === "intro" ? b >= 1 && k % 2 === 0 : hat16 ? true : k % 2 === 0) {
        const open = drums && k === 14;
        bus.add(t, hatVoice(r, open), (open ? 0.1 : 0.075) * (k % 4 === 2 ? 1.15 : 0.85) * (s === "breakdown" ? 0.7 : 1), 0.62);
      }
      // bass
      if (s !== "intro" || b >= 3) {
        const pattern = s === "breakdown" ? [0] : [0, 6, 8, 11, 14];
        if (pattern.includes(k)) {
          const len = s === "breakdown" ? BAR * 0.95 : S16 * (k === 0 || k === 8 ? 3 : 1.6);
          const note = buf(len + 0.05);
          const f = mtof(chord.bass + (k === 11 ? 12 : 0));
          const lp = new Biquad("lp", 420, 0.8);
          let ph = 0;
          for (let i = 0; i < note.length; i++) {
            const tt = i / SR;
            ph += (TAU * f) / SR;
            const a = Math.min(1, tt / 0.006) * (tt > len ? Math.exp(-(tt - len) / 0.02) : 1) * Math.exp(-tt / 1.2);
            note[i] = lp.p(Math.tanh(1.6 * (Math.sin(ph) + 0.3 * Math.sin(2 * ph)))) * a;
          }
          bus.add(t, note, (s === "intro" ? 0.18 : 0.3), 0.5);
        }
      }
    }
  }

  // ---- pad (akor per bar), dengan filter sesuai bagian
  for (let b = 0; b < totalBars; b++) {
    const t0 = b * BAR;
    if (t0 >= DURATION) break;
    const s = sectionAt(t0 + 0.01);
    const chord = chordAtBar(b);
    const len = BAR + 0.6;
    const cutoff = s === "intro" ? 380 + 140 * b : s === "breakdown" ? 700 + 900 * Math.sin(((b - 31) / 4) * Math.PI) : s === "dark" ? 650 : 950;
    chord.v.forEach((m, vi) => {
      [-1, 1].forEach((side) => {
        const note = buf(len + 0.8);
        const f = mtof(m) * Math.pow(2, (side * (6 + vi)) / 1200);
        const lp = new Biquad("lp", cutoff, 0.6);
        let ph = r();
        for (let i = 0; i < note.length; i++) {
          const tt = i / SR;
          ph += f / SR;
          const saw = 2 * (ph - Math.floor(ph + 0.5));
          const a = Math.min(1, tt / 0.35) * (tt > len ? Math.exp(-(tt - len) / 0.35) : 1);
          note[i] = lp.p(saw) * a;
        }
        pad.add(t0, note, 0.035, side < 0 ? 0.28 : 0.72);
      });
    });
  }

  // ---- arp pluck (rasa chiptune) di groove/chat/phone/build/drop
  const dl = Math.round(BEAT * 0.75 * SR);
  const arpL = new Float32Array(N);
  const arpR = new Float32Array(N);
  for (let b = 0; b < totalBars; b++) {
    const t0 = b * BAR;
    const s = sectionAt(t0 + 0.01);
    const on = s === "drop" || s === "chat" || s === "build" || (s === "groove" && (b - 8) % 8 >= 4) || (s === "phone" && (b - 35) % 4 >= 2) || (s === "outro" && b < 54);
    if (!on) continue;
    const chord = chordAtBar(b);
    const tones = [...chord.v.slice(0, 4).map((m) => m + 12), chord.v[0] + 24];
    const order = [0, 1, 2, 3, 4, 3, 2, 1, 0, 1, 2, 3, 4, 3, 2, 1];
    for (let k = 0; k < 16; k++) {
      if (s !== "chat" && k % 2 === 1) continue;
      const t = t0 + k * S16 + (k % 2 === 1 ? S16 * 0.12 : 0);
      const f = mtof(tones[order[k]] + (s === "chat" ? 12 : 0));
      const note = buf(0.25);
      const lp = new Biquad("lp", 2600, 0.8);
      let ph = 0;
      for (let i = 0; i < note.length; i++) {
        const tt = i / SR;
        ph += f / SR;
        const pulse = ph - Math.floor(ph) < 0.25 ? 1 : -1;
        note[i] = lp.p(pulse) * Math.min(1, tt / 0.002) * Math.exp(-tt / 0.07);
      }
      const i0 = Math.round(t * SR);
      const g = s === "chat" ? 0.045 : 0.055;
      for (let i = 0; i < note.length && i0 + i < N; i++) {
        arpL[i0 + i] += note[i] * g;
        arpR[i0 + i] += note[i] * g * 0.7;
      }
    }
  }
  // delay ping-pong 3/16
  for (let i = dl; i < N; i++) {
    arpL[i] += arpR[i - dl] * 0.32;
    arpR[i] += arpL[i - dl] * 0.32;
  }

  // ---- lead singkat di reveal & outro
  const lead = (startBar, notes) => {
    let t = startBar * BAR;
    for (const [m, beats] of notes) {
      const len = beats * BEAT;
      if (m !== null) {
        const note = buf(len + 0.3);
        const f = mtof(m);
        const lp = new Biquad("lp", 3200, 0.7);
        let ph = 0;
        for (let i = 0; i < note.length; i++) {
          const tt = i / SR;
          const vib = 1 + 0.004 * Math.sin(TAU * 5.5 * tt) * Math.min(1, tt / 0.3);
          ph += (f * vib) / SR;
          const sq = ph - Math.floor(ph) < 0.5 ? 1 : -1;
          const a = Math.min(1, tt / 0.02) * (tt > len ? Math.exp(-(tt - len) / 0.08) : 1);
          note[i] = lp.p(sq) * a;
        }
        bus.add(t, note, 0.045, 0.45);
      }
      t += len;
    }
  };
  lead(5, [[79, 1.5], [81, 0.5], [84, 2], [83, 1], [81, 1], [79, 2], [81, 1], [77, 1], [76, 2]]);
  // (melodi outro dihapus di v3: bertabrakan dengan narasi penutup yang berjalan sampai akhir)

  // ---- sidechain pad & arp, lalu reverb pad
  for (let i = 0; i < N; i++) {
    const g = 1 - 0.38 * duck[i];
    pad.L[i] *= g;
    pad.R[i] *= g;
    arpL[i] *= 1 - 0.25 * duck[i];
    arpR[i] *= 1 - 0.25 * duck[i];
  }
  const [pL, pR] = reverb(pad.L, pad.R, { room: 0.86, damp: 0.4, wet: 0.45, dry: 0.85 });
  const [aL, aR] = reverb(arpL, arpR, { room: 0.75, damp: 0.5, wet: 0.25, dry: 1 });
  for (let i = 0; i < N; i++) {
    bus.L[i] += pL[i] + aL[i];
    bus.R[i] += pR[i] + aR[i];
  }
  // ---- intro teredam -> terbuka di reveal (low-pass master bergerak)
  const mL = new Biquad("lp", 600, 0.7);
  const mR = new Biquad("lp", 600, 0.7);
  for (let i = 0; i < N; i++) {
    const t = i / SR;
    if (t < 12.0) {
      if (i % 64 === 0) {
        const f = 600 + 2600 * Math.pow(Math.max(0, (t - 9.6) / 2.4), 2);
        mL.set(f, 0.7);
        mR.set(f, 0.7);
      }
      bus.L[i] = mL.p(bus.L[i]);
      bus.R[i] = mR.p(bus.R[i]);
    }
    // fade akhir
    const fade = t > DURATION - 1.4 ? Math.max(0, (DURATION - t) / 1.4) : 1;
    bus.L[i] *= fade;
    bus.R[i] *= fade;
  }
  return bus;
}

/* ------------------------------------------------------------------ SFX dari sampel ElevenLabs */

const SFX_DIR = "suara/sfx";

/** Dekode, buang hening awal/akhir, normalisasi puncak ke -3 dBFS, fade pendek anti-klik. */
function loadSample(file) {
  const x = decodeMono(file);
  let peak = 0;
  for (const v of x) peak = Math.max(peak, Math.abs(v));
  if (peak <= 0) return x;
  const thr = peak * db(-42);
  let a = 0;
  while (a < x.length && Math.abs(x[a]) < thr) a++;
  let b = x.length - 1;
  while (b > a && Math.abs(x[b]) < thr * 0.5) b--;
  a = Math.max(0, a - Math.round(0.004 * SR));
  b = Math.min(x.length - 1, b + Math.round(0.03 * SR));
  const y = x.slice(a, b + 1);
  const g = db(-3) / peak;
  const fi = Math.round(0.002 * SR);
  const fo = Math.min(Math.round(0.03 * SR), y.length >> 2);
  for (let i = 0; i < y.length; i++) {
    let e = 1;
    if (i < fi) e = i / fi;
    if (i > y.length - fo) e = Math.min(e, (y.length - i) / fo);
    y[i] *= g * e;
  }
  return y;
}

/** Potong rekaman ketikan jadi ketukan tunggal (deteksi onset) untuk dijadwalkan per huruf. */
function sliceKeys(x) {
  const w = Math.round(0.003 * SR);
  const e = new Float32Array(x.length);
  let acc = 0;
  for (let i = 0; i < x.length; i++) {
    acc += Math.abs(x[i]);
    if (i >= w) acc -= Math.abs(x[i - w]);
    e[i] = acc / w;
  }
  let mx = 0;
  for (const v of e) mx = Math.max(mx, v);
  const strokes = [];
  let last = -1e9;
  for (let i = 1; i < e.length; i++) {
    if (e[i] > mx * 0.28 && e[i - 1] <= mx * 0.28 && i - last > 0.075 * SR) {
      const a = Math.max(0, i - Math.round(0.006 * SR));
      const s = x.slice(a, Math.min(x.length, a + Math.round(0.11 * SR)));
      let pk = 0;
      for (const v of s) pk = Math.max(pk, Math.abs(v));
      const g = db(-6) / (pk || 1);
      const fo = Math.round(0.02 * SR);
      for (let k = 0; k < s.length; k++) s[k] *= g * (k > s.length - fo ? (s.length - k) / fo : 1);
      strokes.push(s);
      last = i;
    }
  }
  return strokes.slice(0, 16);
}

function repitch(x, ratio) {
  if (Math.abs(ratio - 1) < 1e-3) return x;
  const n = Math.floor(x.length / ratio);
  const y = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const p = i * ratio;
    const k = Math.floor(p);
    const f = p - k;
    y[i] = (x[k] ?? 0) * (1 - f) + (x[k + 1] ?? 0) * f;
  }
  return y;
}

const LIB = {};
for (const f of fs.readdirSync(SFX_DIR).filter((x) => x.endsWith(".opus")).sort()) {
  const name = f.replace(/\.opus$/, "").replace(/-\d$/, "");
  (LIB[name] ??= []).push(loadSample(`${SFX_DIR}/${f}`));
}
const KEYS = sliceKeys(decodeMono(`${SFX_DIR}/keys.opus`));

// Level dasar tiap jenis (sampel sudah dinormalisasi ke puncak yang sama).
const BASE = {
  click: 0.42, tap: 0.4, whoosh: 0.3, "whoosh-big": 0.32, sweep: 0.34, pop: 0.3, chime: 0.32, notif: 0.42,
  send: 0.32, receive: 0.3, hit: 0.5, riser: 0.34, morph: 0.3, error: 0.32, lock: 0.42, shimmer: 0.22,
  tick: 0.28, stamp: 0.34, slide: 0.24, paste: 0.32, cards: 0.3, cloth: 0.28, "card-slide": 0.3,
  scramble: 0.24, denied: 0.36, drag: 0.3, outro: 0.4, type: 0.3,
};
const VARIES = new Set(["click", "tap", "pop", "tick", "card-slide", "stamp", "receive"]);

function renderSfx() {
  const bus = new Bus();
  const r = rng(77);
  const used = {};
  for (const c of [...CUES].sort((a, b) => a.t - b.t)) {
    const pan = c.pan ?? 0.5;
    const g = c.gain ?? 1;
    if (c.type === "type") {
      const n = c.n ?? 8;
      const cps = c.cps ?? 14;
      let t = c.t;
      for (let k = 0; k < n; k++) {
        const s = KEYS[Math.floor(r() * KEYS.length)];
        bus.add(t, repitch(s, 0.97 + r() * 0.06), BASE.type * g * db((r() - 0.5) * 4), pan);
        t += (1 / cps) * (0.88 + r() * 0.24);
      }
      continue;
    }
    const vars = LIB[c.type];
    if (!vars) {
      console.warn(`SFX belum ada di suara/sfx: ${c.type}`);
      continue;
    }
    used[c.type] = (used[c.type] ?? 0) + 1;
    const s = vars[(used[c.type] - 1) % vars.length];
    bus.add(c.t, VARIES.has(c.type) ? repitch(s, 0.98 + r() * 0.04) : s, (BASE[c.type] ?? 0.3) * g, pan);
  }
  return bus;
}

/* ------------------------------------------------------------------ narasi */

const KLIP = JSON.parse(fs.readFileSync("suara/vo/klip.json", "utf8"));

function readWavMono(file) {
  const b = fs.readFileSync(file);
  const n = (b.length - 44) / 2;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = b.readInt16LE(44 + i * 2) / 32768;
  return x;
}

/** EQ peaking (RBJ) untuk kejernihan vokal. */
class PeakEQ {
  constructor(f, gainDb, q = 1) {
    const A = Math.pow(10, gainDb / 40);
    const w = (TAU * f) / SR;
    const al = Math.sin(w) / (2 * q);
    const cw = Math.cos(w);
    const a0 = 1 + al / A;
    this.b0 = (1 + al * A) / a0;
    this.b1 = (-2 * cw) / a0;
    this.b2 = (1 - al * A) / a0;
    this.a1 = (-2 * cw) / a0;
    this.a2 = (1 - al / A) / a0;
    this.x1 = this.x2 = this.y1 = this.y2 = 0;
  }
  p(x) {
    const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2;
    this.x2 = this.x1;
    this.x1 = x;
    this.y2 = this.y1;
    this.y1 = y;
    return y;
  }
}

/**
 * Narasi: satu take utuh (scripts/gen-vo.mjs), jadi warna & volume suaranya sudah seragam.
 * Di sini hanya: penyeimbang halus antar kalimat (maks +-1,5 dB), high-pass 80 Hz, sedikit
 * potong 280 Hz (tidak "bindeng") dan angkat 3,2 kHz (lebih jelas di speaker HP), lalu
 * limiter look-ahead untuk puncak. Tanpa kompresor cepat supaya suara tetap natural.
 */
function renderVo() {
  const bus = new Bus();
  const spans = [];
  const clips = [];
  for (const v of VO) {
    const k = KLIP[v.id];
    if (!k) {
      console.warn(`Klip narasi belum ada: ${v.id} (jalankan scripts/gen-vo.mjs)`);
      continue;
    }
    const x = readWavMono(k.file);
    const a = Math.round(k.lead * SR);
    const b = Math.min(x.length, a + Math.round(k.bicara * SR));
    let s = 0;
    for (let i = a; i < b; i++) s += x[i] * x[i];
    clips.push({ v, k, x, rmsDb: 20 * Math.log10(Math.sqrt(s / Math.max(1, b - a)) + 1e-12) });
  }
  const med = [...clips].map((c) => c.rmsDb).sort((p, q) => p - q)[Math.floor(clips.length / 2)];
  const TARGET = -16; // RMS bagian bicara (dBFS)
  for (const { v, k, x, rmsDb } of clips) {
    const g = db(TARGET - med + Math.max(-1.5, Math.min(1.5, (med - rmsDb) * 0.5)));
    // Tanpa EQ pewarna: suara dibiarkan persis seperti keluaran Eleven v4 (hanya buang dengung < 60 Hz).
    const hp = new Biquad("hp", 60, 0.707);
    const y = new Float32Array(x.length);
    for (let i = 0; i < x.length; i++) y[i] = hp.p(x[i]) * g;
    limitMono(y, -2);
    bus.add(v.start - k.lead, y, 1, 0.5);
    spans.push([v.start, v.start + k.bicara]);
  }
  return { bus, spans };
}

/**
 * Limiter look-ahead 3 ms untuk narasi: hanya menekan puncak transien di atas `ceilDb`,
 * kekerasan rata-rata tidak berubah. Minimum geser O(n) (van Herk / Gil-Werman).
 */
function limitMono(y, ceilDb = -3, look = 0.003, rel = 0.06) {
  const n = y.length;
  const W = Math.max(1, Math.round(look * SR));
  const c = db(ceilDb);
  const need = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.abs(y[i]);
    need[i] = a > c ? c / a : 1;
  }
  const pre = new Float32Array(n);
  const suf = new Float32Array(n);
  for (let i = 0; i < n; i++) pre[i] = i % W === 0 ? need[i] : Math.min(pre[i - 1], need[i]);
  for (let i = n - 1; i >= 0; i--) suf[i] = i === n - 1 || (i + 1) % W === 0 ? need[i] : Math.min(suf[i + 1], need[i]);
  const cr = Math.exp(-1 / (rel * SR));
  let g = 1;
  for (let i = 0; i < n; i++) {
    const j = Math.min(n - 1, i + W - 1);
    const tgt = Math.min(suf[i], pre[j]);
    g = tgt < g ? tgt : tgt + (g - tgt) * cr;
    y[i] *= g;
  }
  return y;
}

/** Kurva ducking: turun cepat menjelang narasi, naik pelan sesudahnya. */
function duckCurve(spans, depthDb, lead = 0.2, hold = 0.12) {
  const target = new Float32Array(N).fill(1);
  const lo = db(depthDb);
  for (const [a, b] of spans) {
    const i0 = Math.max(0, Math.round((a - lead) * SR));
    const i1 = Math.min(N, Math.round((b + hold) * SR));
    for (let i = i0; i < i1; i++) target[i] = lo;
  }
  const out = new Float32Array(N);
  let g = 1;
  const ca = Math.exp(-1 / (0.06 * SR));
  const cr = Math.exp(-1 / (0.5 * SR));
  for (let i = 0; i < N; i++) {
    const tg = target[i];
    g = tg + (g - tg) * (tg < g ? ca : cr);
    out[i] = g;
  }
  return out;
}

/* ------------------------------------------------------------------ master & tulis */

const cosFade = (u) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, u)));
/** Fade buka (musik & SFX) dan fade tutup (semua), sama dengan fade visual di MiraTutorial.tsx. */
const fadeIn = (i) => cosFade(i / SR / 0.6);
const fadeOut = (i) => {
  const t = i / SR;
  return t < T.fadeOut ? 1 : 1 - cosFade((t - T.fadeOut) / (DURATION - T.fadeOut));
};

/** Pembatas lunak: di bawah -1.4 dBFS tidak disentuh, di atasnya ditekuk halus ke ~-0.1 dBFS. */
function limit(v) {
  const a = Math.abs(v);
  const k = 0.85;
  if (a <= k) return v;
  return Math.sign(v) * (k + 0.14 * Math.tanh((a - k) / 0.14));
}

/** Versi stereo limiter look-ahead (gain sama untuk kiri & kanan supaya posisi stereo tetap). */
function limitStereo(L, R, ceilDb = -1, look = 0.003, rel = 0.08) {
  const M = new Float32Array(N);
  for (let i = 0; i < N; i++) M[i] = Math.max(Math.abs(L[i]), Math.abs(R[i]));
  const g = M.slice();
  limitMono(g, ceilDb, look, rel);
  for (let i = 0; i < N; i++) {
    const k = M[i] > 1e-9 ? g[i] / M[i] : 1;
    L[i] *= k;
    R[i] *= k;
  }
}

function bounce(parts, masterDb = 0) {
  const L = new Float32Array(N);
  const R = new Float32Array(N);
  for (const { bus, gain = 1, curve, fin = true } of parts) {
    for (let i = 0; i < N; i++) {
      const g = gain * (curve ? curve[i] : 1) * (fin ? fadeIn(i) : 1) * fadeOut(i);
      L[i] += bus.L[i] * g;
      R[i] += bus.R[i] * g;
    }
  }
  if (masterDb !== 0) {
    const m = db(masterDb);
    for (let i = 0; i < N; i++) {
      L[i] *= m;
      R[i] *= m;
    }
    limitStereo(L, R, -1);
  }
  for (let i = 0; i < N; i++) {
    L[i] = limit(L[i]);
    R[i] = limit(R[i]);
  }
  return [L, R];
}

function rms(L, R) {
  let s = 0;
  for (let i = 0; i < N; i++) s += L[i] * L[i] + R[i] * R[i];
  return 20 * Math.log10(Math.sqrt(s / (2 * N)) + 1e-12);
}

function peakDb(L, R) {
  let p = 0;
  for (let i = 0; i < N; i++) p = Math.max(p, Math.abs(L[i]), Math.abs(R[i]));
  return 20 * Math.log10(p + 1e-12);
}

function normPeak(bus, peakDbTarget) {
  let p = 0;
  for (let i = 0; i < N; i++) p = Math.max(p, Math.abs(bus.L[i]), Math.abs(bus.R[i]));
  const g = p > 0 ? db(peakDbTarget) / p : 1;
  for (let i = 0; i < N; i++) {
    bus.L[i] *= g;
    bus.R[i] *= g;
  }
  return bus;
}

function writeWav(file, L, R) {
  const data = Buffer.alloc(N * 4);
  for (let i = 0; i < N; i++) {
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * 32767))), i * 4);
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * 32767))), i * 4 + 2);
  }
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(2, 22);
  h.writeUInt32LE(SR, 24);
  h.writeUInt32LE(SR * 4, 28);
  h.writeUInt16LE(4, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

const t0 = Date.now();
const vo = renderVo();
const sfx = renderSfx();
const music = normPeak(renderMusic(), -4);
// Kantong frekuensi untuk vokal: musik dipotong -3 dB di sekitar 2,5 kHz supaya suara narasi
// tetap jelas walau musiknya dibiarkan terdengar di bawahnya.
for (const ch of ["L", "R"]) {
  const eq = new PeakEQ(2500, -3, 0.9);
  const x = music[ch];
  for (let i = 0; i < N; i++) x[i] = eq.p(x[i]);
}
const duckMusic = duckCurve(vo.spans, -7);
const duckSfx = duckCurve(vo.spans, -8);

const G = { vo: 1.0, sfx: 0.85, music: 0.62 };
let voPeak = 0;
for (let i = 0; i < N; i++) voPeak = Math.max(voPeak, Math.abs(vo.bus.L[i]));
console.log(`Puncak narasi sebelum limiter: ${(20 * Math.log10(voPeak)).toFixed(1)} dBFS`);
const stemVo = bounce([{ bus: vo.bus, gain: G.vo, fin: false }]);
const stemSfx = bounce([{ bus: sfx, gain: G.sfx }]);
const stemMusic = bounce([{ bus: music, gain: G.music }]);
const lengkap = bounce([
  { bus: vo.bus, gain: G.vo, fin: false },
  { bus: sfx, gain: G.sfx, curve: duckSfx },
  { bus: music, gain: G.music, curve: duckMusic },
], 3.5);
const tanpaMusik = bounce([
  { bus: vo.bus, gain: G.vo, fin: false },
  { bus: sfx, gain: G.sfx, curve: duckSfx },
], 3.5);
const tanpaNarasi = bounce([
  { bus: sfx, gain: G.sfx },
  { bus: music, gain: G.music * 1.2 },
], 3.5);

for (const f of ["audio/mix-dengan-musik.wav"]) if (fs.existsSync(f)) fs.rmSync(f);
writeWav("audio/vo.wav", ...stemVo);
writeWav("audio/sfx.wav", ...stemSfx);
writeWav("audio/musik.wav", ...stemMusic);
writeWav("audio/mix-lengkap.wav", ...lengkap);
writeWav("audio/mix-tanpa-musik.wav", ...tanpaMusik);
writeWav("audio/mix-tanpa-narasi.wav", ...tanpaNarasi);
const fmt = (x) => `RMS ${rms(...x).toFixed(1)} dB, puncak ${peakDb(...x).toFixed(1)} dBFS`;
console.log(`Audio selesai dalam ${((Date.now() - t0) / 1000).toFixed(1)} dtk. ${KEYS.length} ketukan keyboard dari sampel.`);
console.log(`  narasi      ${fmt(stemVo)}\n  sfx         ${fmt(stemSfx)}\n  musik       ${fmt(stemMusic)}\n  lengkap     ${fmt(lengkap)}\n  tanpa musik ${fmt(tanpaMusik)}\n  tanpa narasi ${fmt(tanpaNarasi)}`);
