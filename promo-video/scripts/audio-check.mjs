// QA audio tanpa perlu mendengar: gambar amplitudo (puncak & RMS) per 50 ms untuk tiap WAV,
// garis vertikal di batas adegan, dan laporan clipping. Output: stills/audio-check.png
import fs from "node:fs";
import zlib from "node:zlib";
import { SCENES, CUES } from "../src/timeline.ts";

const files = ["audio/vo.wav", "audio/sfx.wav", "audio/musik.wav", "audio/mix-lengkap.wav"];
const W = 1600;
const H = 180;
const img = new Uint8Array(W * H * files.length * 3).fill(250);

function readWav(f) {
  const b = fs.readFileSync(f);
  const n = (b.length - 44) / 4;
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    L[i] = b.readInt16LE(44 + i * 4) / 32768;
    R[i] = b.readInt16LE(46 + i * 4) / 32768;
  }
  return { L, R, n, sr: b.readUInt32LE(24) };
}

const put = (x, y, rgb) => {
  if (x < 0 || x >= W || y < 0 || y >= H * files.length) return;
  const o = (y * W + x) * 3;
  img[o] = rgb[0];
  img[o + 1] = rgb[1];
  img[o + 2] = rgb[2];
};

files.forEach((f, k) => {
  const { L, R, n, sr } = readWav(f);
  const dur = n / sr;
  let clips = 0;
  let peak = 0;
  const top = k * H;
  for (let x = 0; x < W; x++) {
    const i0 = Math.floor((x / W) * n);
    const i1 = Math.floor(((x + 1) / W) * n);
    let pk = 0;
    let s = 0;
    for (let i = i0; i < i1; i++) {
      const v = Math.max(Math.abs(L[i]), Math.abs(R[i]));
      if (v >= 0.999) clips++;
      pk = Math.max(pk, v);
      s += L[i] * L[i];
    }
    peak = Math.max(peak, pk);
    const rms = Math.sqrt(s / Math.max(1, i1 - i0));
    const mid = top + H / 2;
    const hp = Math.round(pk * (H / 2 - 6));
    const hr = Math.round(rms * (H / 2 - 6));
    for (let y = -hp; y <= hp; y++) put(x, mid + y, [156, 198, 224]);
    for (let y = -hr; y <= hr; y++) put(x, mid + y, [3, 105, 161]);
  }
  for (const s of SCENES) {
    const x = Math.round((s.start / dur) * W);
    for (let y = top; y < top + H; y += 2) put(x, y, [190, 18, 60]);
  }
  if (k === 1) for (const c of CUES) put(Math.round((c.t / dur) * W), top + 4, [15, 118, 110]);
  for (let x = 0; x < W; x++) put(x, top + H - 1, [7, 32, 51]);
  console.log(`${f}: durasi ${dur.toFixed(2)} dtk, puncak ${(20 * Math.log10(peak)).toFixed(1)} dBFS, sampel clipping ${clips}`);
});

// PNG encoder minimal
const h = H * files.length;
const raw = Buffer.alloc((W * 3 + 1) * h);
for (let y = 0; y < h; y++) {
  raw[y * (W * 3 + 1)] = 0;
  Buffer.from(img.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
}
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(h, 4);
ihdr[8] = 8;
ihdr[9] = 2;
fs.mkdirSync("stills", { recursive: true });
fs.writeFileSync(
  "stills/audio-check.png",
  Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]),
);
console.log("stills/audio-check.png ditulis");
