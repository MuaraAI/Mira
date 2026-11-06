// Pembungkus kecil REST API ElevenLabs (tanpa SDK) + dekoder audio.
// Kunci dibaca dari ELEVENLABS_API_KEY di promo-video/.env (sudah di-.gitignore, jangan di-commit).
// Jalankan skrip yang memakai file ini dengan: node --env-file=.env scripts/<skrip>.mjs
//
// Semua hasil di-cache di folder suara/: permintaan yang sama tidak dikirim dua kali,
// jadi kredit tidak terbuang saat skrip diulang.
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const API = "https://api.elevenlabs.io";
export const VOICE_MWM = "49LTk18D35x8vgRpUeYe"; // suara "MwM" milik akun (perempuan, Indonesia)
export const SR = 48000;

function key() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) throw new Error("ELEVENLABS_API_KEY belum ada. Isi promo-video/.env lalu jalankan dengan node --env-file=.env");
  return k;
}

export const hash = (o) => createHash("sha1").update(JSON.stringify(o)).digest("hex").slice(0, 10);

async function call(path, init) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(API + path, { ...init, headers: { "xi-api-key": key(), ...(init.headers || {}) } });
    if (r.ok) return r;
    const body = await r.text();
    if (r.status === 429 || r.status >= 500) {
      await new Promise((s) => setTimeout(s, 2000 * (i + 1)));
      continue;
    }
    throw new Error(`ElevenLabs ${path} -> ${r.status}: ${body.slice(0, 500)}`);
  }
  throw new Error(`ElevenLabs ${path}: gagal setelah 4 percobaan`);
}

export async function credits() {
  const s = await (await call("/v1/user/subscription", { method: "GET" })).json();
  return { used: s.character_count, limit: s.character_limit, left: s.character_limit - s.character_count };
}

const FORMAT = "opus_48000_192"; // 48 kHz penuh, lebih jernih dari mp3 128 kbps, boleh di paket Starter

/**
 * Text-to-speech dengan timestamp per karakter.
 * Hasil: <base>.opus (audio) dan <base>.json (alignment + parameter). Di-cache per parameter.
 */
export async function ttsTimed(base, body) {
  const meta = { v: 1, format: FORMAT, voice: body.voice ?? VOICE_MWM, ...body };
  const id = hash(meta);
  const jsonFile = `${base}.json`;
  if (existsSync(jsonFile)) {
    const old = JSON.parse(readFileSync(jsonFile, "utf8"));
    if (old.id === id) return { ...old, cached: true };
  }
  const { voice, ...req } = meta;
  delete req.v;
  delete req.format;
  const r = await call(`/v1/text-to-speech/${voice}/with-timestamps?output_format=${FORMAT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const cost = r.headers.get("character-cost") ?? r.headers.get("x-character-count");
  const j = await r.json();
  mkdirSync(dirname(base), { recursive: true });
  writeFileSync(`${base}.opus`, Buffer.from(j.audio_base64, "base64"));
  const out = { id, request: meta, cost, requestId: r.headers.get("request-id"), alignment: j.alignment, normalized: j.normalized_alignment };
  writeFileSync(jsonFile, JSON.stringify(out));
  return { ...out, cached: false };
}

/** Efek suara. Hasil: <base>.opus. Di-cache per parameter. */
export async function soundEffect(base, body) {
  const meta = { v: 1, format: FORMAT, ...body };
  const id = hash(meta);
  const metaFile = `${base}.meta.json`;
  if (existsSync(metaFile) && existsSync(`${base}.opus`)) {
    const old = JSON.parse(readFileSync(metaFile, "utf8"));
    if (old.id === id) return { ...old, cached: true };
  }
  const { v, format, ...req } = meta;
  for (const k of Object.keys(req)) if (k.startsWith("_")) delete req[k]; // varian lokal, tidak dikirim
  const r = await call(`/v1/sound-generation?output_format=${FORMAT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const buf = Buffer.from(await r.arrayBuffer());
  mkdirSync(dirname(base), { recursive: true });
  writeFileSync(`${base}.opus`, buf);
  const out = { id, request: meta, cost: r.headers.get("character-cost") };
  writeFileSync(metaFile, JSON.stringify(out, null, 1));
  return { ...out, cached: false };
}

/** Speech-to-text (Scribe) untuk mengecek pelafalan. Hasil di-cache di <file>.stt.json. */
export async function transcribe(file, { language = "id", keyterms = [], key = "" } = {}) {
  const out = `${file}.stt.json`;
  if (existsSync(out)) {
    const old = JSON.parse(readFileSync(out, "utf8"));
    if (old.key === key) return old;
  }
  let last;
  for (const model of ["scribe_v2", "scribe_v1"]) {
    const fd = new FormData();
    fd.append("model_id", model);
    fd.append("language_code", language);
    fd.append("tag_audio_events", "false");
    fd.append("timestamps_granularity", "word");
    for (const k of keyterms) fd.append("keyterms", k);
    fd.append("file", new Blob([readFileSync(file)]), file.split(/[\\/]/).pop());
    try {
      const r = await call("/v1/speech-to-text", { method: "POST", body: fd });
      const j = await r.json();
      writeFileSync(out, JSON.stringify({ key, model, ...j }));
      return { key, model, ...j };
    } catch (e) {
      last = e;
    }
  }
  throw last;
}

/* ------------------------------------------------------------------ dekoder (ffmpeg bawaan Remotion) */

const FFMPEG = join(process.cwd(), "node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe");

/** Dekode file audio apa pun ke Float32Array mono 48 kHz. */
export function decodeMono(file) {
  // ffmpeg Remotion versi minimal: tanpa muxer mentah & encoder float, jadi keluarannya WAV 16-bit lalu header-nya dilewati.
  const raw = execFileSync(FFMPEG, ["-v", "error", "-i", file, "-ac", "1", "-ar", String(SR), "-c:a", "pcm_s16le", "-f", "wav", "-"], { maxBuffer: 1 << 30 });
  let o = 12;
  while (o < raw.length - 8 && raw.toString("ascii", o, o + 4) !== "data") o += 8 + raw.readUInt32LE(o + 4);
  const start = o + 8;
  const n = Math.floor((raw.length - start) / 2);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = raw.readInt16LE(start + i * 2) / 32768;
  return out;
}

/** Tulis WAV 16-bit (mono atau stereo [L, R]). */
export function writeWav(file, channels) {
  const chs = Array.isArray(channels) ? channels : [channels];
  const n = chs[0].length;
  const buf = Buffer.alloc(44 + n * chs.length * 2);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + n * chs.length * 2, 4);
  buf.write("WAVEfmt ", 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(chs.length, 22);
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * chs.length * 2, 28);
  buf.writeUInt16LE(chs.length * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(n * chs.length * 2, 40);
  let o = 44;
  for (let i = 0; i < n; i++)
    for (const c of chs) {
      buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(c[i] * 32767))), o);
      o += 2;
    }
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, buf);
}
