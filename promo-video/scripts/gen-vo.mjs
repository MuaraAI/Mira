// Narasi v3.2: ElevenLabs suara "MwM", model Eleven v4 (eleven_v4) dengan setelan PERSIS seperti
// di UI ElevenLabs: stability 0,5, similarity 0,75, kecepatan normal, bahasa otomatis.
// Dibuat per adegan (kalimat pendek seperti di UI), lalu tiap adegan dipotong per kalimat
// TEPAT DI HENING yang terdeteksi dari audionya (bukan dari perkiraan waktu per huruf).
//   node --env-file=.env scripts/gen-vo.mjs
// Hasil:
//   suara/vo/adegan-NN.opus|json  audio per adegan + timestamp kasar (cache)
//   suara/vo/vNN.wav              satu klip per kalimat (mono 48 kHz)
//   suara/vo/klip.json            posisi bicara tiap klip + waktu tiap kata (mixer & naskah)
//   src/vo-words.json             waktu tiap kata TAMPIL untuk subtitle
// Lalu tiap klip ditranskrip balik (Scribe): kata pertama/terakhir yang hilang = potongan salah.
import { mkdirSync, writeFileSync } from "node:fs";
import { DURATION, VO } from "../src/timeline.ts";
import { credits, decodeMono, SR, transcribe, ttsTimed, writeWav } from "./eleven.mjs";

const MODEL = "eleven_v4";
const SETTINGS = { stability: 0.5, similarity_boost: 0.75 }; // sama dengan slider di UI, tanpa ubah kecepatan
const ucap = (v) => v.ucap ?? v.text;
const isV = (c) => /[\p{L}\p{N}]/u.test(c);
const before = await credits();
mkdirSync("suara/vo", { recursive: true });

const klip = {};
const words = {};
const scenes = [...new Set(VO.map((v) => v.scene))];
const chunks = scenes.map((sc) => VO.filter((v) => v.scene === sc));
const takeIds = [];

/* ------------------------------------------------------------ 4. klip per kalimat (dirapikan ke suara) */
const tok = (s) => s.split(/\s+/).filter(Boolean);
const norm = (w) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Petakan kata tampil (text) ke kata terucap (ucap) untuk subtitle: kata sama = jangkar, sisanya dibagi rata. */
function displayTiming(display, spoken) {
  const D = tok(display);
  const n = D.length;
  const m = spoken.length;
  const dp = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)));
  for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (norm(D[i - 1]) === norm(spoken[j - 1].w) ? 0 : 1.5));
  const pairs = [];
  for (let i = n, j = m; i > 0 || j > 0; ) {
    if (i > 0 && j > 0 && norm(D[i - 1]) === norm(spoken[j - 1].w) && dp[i][j] === dp[i - 1][j - 1]) pairs.unshift([i - 1, j - 1]), i--, j--;
    else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1.5) i--, j--;
    else if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) i--;
    else j--;
  }
  const out = D.map((t) => ({ t, s: 0, e: 0 }));
  const anchors = [[-1, -1], ...pairs, [n, m]];
  for (let q = 0; q < anchors.length - 1; q++) {
    const [di, sj] = anchors[q];
    const [dk, sl] = anchors[q + 1];
    if (di >= 0) Object.assign(out[di], { s: spoken[sj].s, e: spoken[sj].e });
    const dRun = out.slice(di + 1, dk);
    if (!dRun.length) continue;
    const s0 = sl > sj + 1 ? spoken[sj + 1].s : sj >= 0 ? spoken[sj].e : 0;
    const s1 = sl > sj + 1 ? spoken[sl - 1].e : sl < m ? spoken[sl].s : s0;
    const L = dRun.reduce((acc, w) => acc + w.t.length, 0);
    let cur = s0;
    for (const w of dRun) {
      const d = ((s1 - s0) * w.t.length) / L;
      Object.assign(w, { s: cur, e: cur + d });
      cur += d;
    }
  }
  return out.map((w) => ({ t: w.t, s: +w.s.toFixed(3), e: +w.e.toFixed(3) }));
}


/** Satu adegan: generate, petakan hening, potong per kalimat di jeda terdekat. */
async function doChunk(ci) {
  const lines = chunks[ci];
  const parts = lines.map(ucap);
  const text = parts.join(" ");
  const prev = ci > 0 ? chunks[ci - 1].map(ucap).join(" ") : undefined;
  const next = ci < chunks.length - 1 ? chunks[ci + 1].map(ucap).join(" ") : undefined;
  const base = `suara/vo/adegan-${String(ci + 1).padStart(2, "0")}`;
  const take = await ttsTimed(base, { text, model_id: MODEL, voice_settings: SETTINGS, seed: 1717, previous_text: prev, next_text: next });
  takeIds.push(take.id);
  const al = take.alignment;
  const audio = decodeMono(`${base}.opus`);
  const total = audio.length / SR;
  const HOP = Math.round(0.01 * SR);
  const nF = Math.floor(audio.length / HOP);
  const lev = new Float32Array(nF);
  for (let f = 0; f < nF; f++) {
    let s = 0;
    for (let i = f * HOP; i < (f + 1) * HOP; i++) s += audio[i] * audio[i];
    lev[f] = 10 * Math.log10(s / HOP + 1e-12);
  }
  const sorted = [...lev].sort((a, b) => a - b);
  const THR = Math.max(sorted[Math.floor(nF * 0.05)] + 10, sorted[Math.floor(nF * 0.9)] - 36);
  const sil = [];
  for (let f = 0, a = -1; f <= nF; f++) {
    const quiet = f < nF && lev[f] < THR;
    if (quiet && a < 0) a = f;
    if (!quiet && a >= 0) {
      if (f - a >= 9) sil.push([(a * HOP) / SR, (f * HOP) / SR]);
      a = -1;
    }
  }
  const st = al.character_start_times_seconds;
  const en = al.character_end_times_seconds;
  let off = 0;
  const spans = parts.map((p) => {
    const s = { a: off, b: off + p.length };
    off += p.length + 1;
    return s;
  });
  const aligned = spans.map(({ a, b }) => {
    let t0 = Infinity;
    let t1 = 0;
    for (let i = a; i < b; i++)
      if (isV(al.characters[i])) {
        t0 = Math.min(t0, st[i]);
        t1 = Math.max(t1, en[i]);
      }
    return { t0, t1 };
  });
  const cuts = [0];
  for (let k = 0; k < parts.length - 1; k++) {
    const mid = (aligned[k].t1 + aligned[k + 1].t0) / 2;
    let best = null;
    let score = -Infinity;
    for (const [x, y] of sil) {
      const c = (x + y) / 2;
      if (c < mid - 0.7 || c > mid + 1.3 || c <= cuts[cuts.length - 1] + 0.4) continue;
      const sc = y - x - 0.5 * Math.abs(c - mid);
      if (sc > score) {
        score = sc;
        best = [x, y];
      }
    }
    if (!best) console.warn(`PERINGATAN: tidak ada jeda di batas ${lines[k].id}/${lines[k + 1].id}, pakai perkiraan`);
    cuts.push(best ? (best[0] + best[1]) / 2 : mid);
  }
  cuts.push(total);
  console.log(`${base}: ${take.cached ? "cache" : "baru"} | ${text.length} huruf | ${total.toFixed(2)} dtk`);
  for (let k = 0; k < parts.length; k++) {
    const v = lines[k];
    const A = cuts[k];
    const B = cuts[k + 1];
    const fA = Math.floor((A * SR) / HOP);
    const fB = Math.min(nF, Math.floor((B * SR) / HOP));
    let on = fA;
    while (on < fB && lev[on] < THR + 4) on++;
    let last = fB - 1;
    while (last > on && lev[last] < THR + 4) last--;
    const onT = (on * HOP) / SR;
    const offT = ((last + 1) * HOP) / SR;
    const cA = Math.max(A, onT - 0.08);
    const cB = Math.min(B, offT + 0.22);
    const seg = audio.slice(Math.floor(cA * SR), Math.floor(cB * SR));
    const fi = Math.floor(0.015 * SR);
    const fo = Math.floor(0.05 * SR);
    for (let i = 0; i < fi && i < seg.length; i++) seg[i] *= i / fi;
    for (let i = 0; i < fo && i < seg.length; i++) seg[seg.length - 1 - i] *= i / fo;
    writeWav(`suara/vo/${v.id}.wav`, seg);
  
    // waktu kata: timestamp kasar diregangkan ke batas bicara yang nyata
    const { t0, t1 } = aligned[k];
    const scale = (offT - onT) / Math.max(0.05, t1 - t0);
    const map = (t) => (t - t0) * scale;
    const kata = [];
    let w = null;
    const { a, b } = spans[k];
    for (let i = a; i <= b; i++) {
      const ch = i < b ? al.characters[i] : " ";
      if (ch === " ") {
        if (w && w.s !== null) kata.push(w);
        w = null;
        continue;
      }
      if (!w) w = { w: "", s: null, e: null };
      w.w += ch;
      if (isV(ch)) {
        if (w.s === null) w.s = map(st[i]);
        w.e = map(en[i]);
      }
    }
    const clean = kata.map((x) => ({ w: x.w, s: +Math.max(0, x.s).toFixed(3), e: +Math.min(offT - onT, x.e).toFixed(3) }));
    klip[v.id] = { file: `suara/vo/${v.id}.wav`, lead: +(onT - cA).toFixed(3), bicara: +(offT - onT).toFixed(3), panjang: +(seg.length / SR).toFixed(3), kata: clean };
    words[v.id] = { bicara: +(offT - onT).toFixed(3), words: displayTiming(v.text, clean) };
  }
}
for (let ci = 0; ci < chunks.length; ci++) await doChunk(ci);
writeFileSync("suara/vo/klip.json", JSON.stringify(klip, null, 1));
writeFileSync("src/vo-words.json", JSON.stringify(words));

/* ------------------------------------------------------------ 5. cocokkan dengan slot di timeline */
for (let i = 0; i < VO.length; i++) {
  const v = VO[i];
  const k = klip[v.id];
  const next = VO[i + 1];
  const room = next ? next.start - v.start - 0.2 : DURATION - 1.3 - v.start;
  if (k.bicara > room) console.log(`${v.id} bicara ${k.bicara.toFixed(2)} > ruang ${room.toFixed(2)} (TABRAKAN ${(k.bicara - room).toFixed(2)} dtk)`);
}

/* ------------------------------------------------------------ 6. cek potongan: transkrip balik tiap klip */
const KEY = ["Mira", "SIAKAD", "MyBest", "NIM", "IPK", "WhatsApp", "YouTube", "Instagram", "Drive", "UBSI", "muaraai", "deadline", "login", "password"];
let bad = 0;
for (const v of VO) {
  const stt = await transcribe(klip[v.id].file, { keyterms: KEY, key: `${takeIds.join(".")}-${v.id}-${klip[v.id].panjang}` });
  const ref = tok(ucap(v)).map(norm).filter(Boolean);
  const hyp = tok(stt.text ?? "").map(norm).filter(Boolean);
  const firstOk = hyp.slice(0, 3).some((x) => x === ref[0] || x.startsWith(ref[0].slice(0, 3)));
  const lastOk = hyp.slice(-3).some((x) => x === ref[ref.length - 1] || x.startsWith(ref[ref.length - 1].slice(0, 3)));
  const lenOk = Math.abs(hyp.length - ref.length) <= 2;
  if (!firstOk || !lastOk || !lenOk) bad++;
  console.log(`${v.id} ${firstOk && lastOk && lenOk ? "ok " : "CEK"} | ${stt.text}`);
}
const after = await credits();
console.log(`\n${bad ? `${bad} klip perlu dicek` : "Semua klip utuh"} | kredit terpakai ${after.used - before.used} | sisa ${after.left}`);
