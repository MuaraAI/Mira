// Ganti audio di semua video posting dengan audio/mix-lengkap.wav terbaru TANPA render ulang gambar.
// Story dipotong per bagian dengan fade pendek yang sama seperti komposisinya (src/posting/Social.tsx).
//   node --no-warnings scripts/remux-posting.mjs
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { DURATION, STORY_PARTS } from "../src/timeline.ts";

const FF = "node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe";
const MIX = "audio/mix-lengkap.wav";

function readWav(file) {
  const b = fs.readFileSync(file);
  let o = 12;
  let fmt = null;
  while (o < b.length - 8) {
    const id = b.toString("ascii", o, o + 4);
    const size = b.readUInt32LE(o + 4);
    if (id === "fmt ") fmt = { ch: b.readUInt16LE(o + 10), sr: b.readUInt32LE(o + 12) };
    if (id === "data") return { ...fmt, data: b.subarray(o + 8, o + 8 + size) };
    o += 8 + size;
  }
  throw new Error(`data tidak ditemukan di ${file}`);
}

function writeWav(file, { ch, sr }, data) {
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(ch, 22);
  h.writeUInt32LE(sr, 24);
  h.writeUInt32LE(sr * ch * 2, 28);
  h.writeUInt16LE(ch * 2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, data]));
}

/** Potong [from, to] dari mix dengan fade masuk/keluar (dtk), sama dengan MixAudio di Social.tsx. */
function cut(wav, from, to, fin, fout) {
  const frame = wav.ch * 2;
  const a = Math.round(from * wav.sr);
  const n = Math.round((to - from) * wav.sr);
  const out = Buffer.alloc(n * frame);
  wav.data.copy(out, 0, a * frame, Math.min(wav.data.length, (a + n) * frame));
  for (let i = 0; i < n; i++) {
    const s = i / wav.sr;
    const g = Math.min(fin > 0 ? Math.min(1, s / fin) : 1, fout > 0 ? Math.min(1, (to - from - s) / fout) : 1);
    if (g >= 1) continue;
    for (let c = 0; c < wav.ch; c++) {
      const p = i * frame + c * 2;
      out.writeInt16LE(Math.round(out.readInt16LE(p) * g), p);
    }
  }
  return out;
}

function mux(video, audio) {
  if (!fs.existsSync(video)) return console.warn(`lewati (belum ada): ${video}`);
  const tmp = video.replace(/\.mp4$/, ".tmp.mp4");
  execFileSync(FF, ["-v", "error", "-y", "-i", video, "-i", audio, "-map", "0:v", "-map", "1:a", "-c:v", "copy", "-c:a", "aac", "-b:a", "256k", "-shortest", "-movflags", "+faststart", tmp]);
  fs.renameSync(tmp, video);
  console.log(`audio diganti: ${video}`);
}

const wav = readWav(MIX);
fs.copyFileSync(MIX, "public/render/mix-lengkap.wav"); // render berikutnya memakai mix yang sama
for (const v of ["out/posting/youtube/mira-tutorial-youtube-1080p60.mp4", "out/posting/instagram-reels/mira-reels-9x16.mp4", "out/posting/instagram-feed/mira-feed-4x5.mp4"]) mux(v, MIX);
STORY_PARTS.forEach((p, i) => {
  const part = `audio/story-${i + 1}.wav`;
  writeWav(part, wav, cut(wav, p.from, p.to, p.from > 0 ? 0.08 : 0, p.to < DURATION ? 0.45 : 0));
  mux(`out/posting/instagram-story/mira-story-${i + 1}-dari-3.mp4`, part);
});
