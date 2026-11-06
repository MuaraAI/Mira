// Membuat NASKAH.md, naskah-vo.srt, dan naskah-teleprompter.txt dari src/timeline.ts (v3).
// Waktu bicara diambil dari klip narasi ElevenLabs yang sudah jadi (suara/vo/klip.json),
// jadi subtitle & timestamp pas dengan suara di video. Jalankan: npm run naskah
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { BAR, BPM, CUES, DURATION, FPS, HEIGHT, MUSIC, SCENES, SWEEPS, T, VO, WIDTH, stamp } from "../src/timeline.ts";
import { LIB } from "./gen-sfx.mjs";

type Klip = { lead: number; bicara: number; kata: { w: string; s: number; e: number }[] };
const KLIP: Record<string, Klip> = existsSync("suara/vo/klip.json") ? JSON.parse(readFileSync("suara/vo/klip.json", "utf8")) : {};
const endOf = (id: string, fallback: number, start: number) => (KLIP[id] ? start + KLIP[id].bicara : fallback);

function srtTime(sec: number) {
  const ms = Math.round(sec * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const r = ms % 1000;
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${p(h)}:${p(m)}:${p(s)},${p(r, 3)}`;
}

const MUSIC_DESC: Record<string, string> = {
  intro: "Teredam (low-pass), akor Am, hi-hat tipis: suasana portal lama. Muncul pelan dari hening (fade buka 0,6 dtk).",
  drop: "Masuk penuh tepat saat logo jatuh: drum, bass, pad, arpeggio pixel, melodi pendek.",
  groove: "Groove utama lo-fi chiptune (Fmaj7 - Em7 - Dm7 - Cmaj7), arpeggio keluar-masuk tiap 4 bar.",
  chat: "Lebih ceria: hi-hat 16-an, arpeggio satu oktaf lebih tinggi.",
  breakdown: "Drum turun, pad mengembang mengikuti morph laptop -> tablet -> HP.",
  phone: "Groove kembali untuk alur di HP.",
  dark: "Nada minor lebih tenang (Dm7 - Bbmaj7 - Gm7 - A7sus) untuk bagian keamanan.",
  build: "Energi naik untuk perbandingan, snare roll di bar terakhir.",
  outro: "Resolusi ke Cmaj7 tanpa melodi (narasi penutup berjalan sampai akhir), drum berhenti, memudar bersama gambar.",
};

let md = "";
md += `# Naskah Video Tutorial Mira (v3)\n\n`;
md += `**Durasi:** ${stamp(DURATION)} (${DURATION.toFixed(1)} detik) · **Format:** ${WIDTH}×${HEIGHT}, ${FPS} fps, H.264 BT.709 · **Tempo musik:** ${BPM} BPM (1 bar = ${BAR} detik)\n\n`;
md += `**Narasi:** ElevenLabs, suara **MwM** (perempuan, Indonesia), model Eleven v4 (\`eleven_v4\`), bahasa otomatis, stability 0,5 · similarity 0,75, kecepatan normal (persis setelan di UI ElevenLabs), dibuat per adegan lalu dipotong tepat di jeda bicara; suara tidak diberi EQ. `;
md += `Persona: **Mira sendiri yang bicara** (orang pertama, "aku"): dewasa, tenang, dan "ngatur". Memberi arahan singkat lalu mengambil alih urusanmu, ditutup dengan "Sisanya, biar aku yang atur."\n\n`;
md += `| File | Isi |\n|---|---|\n`;
md += `| \`out/mira-tutorial.mp4\` | Video lengkap: narasi + SFX + musik |\n`;
md += `| \`out/mira-tutorial-tanpa-musik.mp4\` | Narasi + SFX, tanpa musik |\n`;
md += `| \`out/mira-tutorial-tanpa-narasi.mp4\` | SFX + musik, tanpa narasi (untuk dubbing sendiri) |\n`;
md += `| \`out/mira-tutorial-bisu.mp4\` | Video tanpa audio sama sekali |\n`;
md += `| \`audio/vo.wav\`, \`audio/sfx.wav\`, \`audio/musik.wav\` | Stem terpisah (48 kHz) untuk mixing ulang di editor |\n`;
md += `| \`naskah-vo.srt\` | Subtitle narasi (waktu persis dari audio) |\n`;
md += `| \`naskah-teleprompter.txt\` | Teks narasi polos dengan timestamp |\n`;
md += `| \`out/posting/\` | Paket posting: YouTube (subtitle Jersey 25 menyatu), IG Feed 4:5, IG Reels 9:16, IG Story 3 bagian, cover, caption |\n\n`;
md += `> Semua timestamp dibangkitkan otomatis dari \`src/timeline.ts\` dan \`suara/vo/klip.json\` (posisi bicara nyata tiap klip). Animasi penting dikunci ke kata yang diucapkan: ketukan tangan Mira pada "SIAKAD / MyBest / presensi", morph pada "tablet / hape", slider pada "Di portal / Di sini", telunjuk pada URL.\n\n`;

md += `## Cara pakai di editor (CapCut / Premiere / DaVinci)\n\n`;
md += `1. Paling praktis: pakai \`mira-tutorial.mp4\` apa adanya. Level akhir sekitar -15 dB RMS, puncak -1 dBFS.\n`;
md += `2. Mau atur sendiri: pakai \`mira-tutorial-bisu.mp4\` + tiga stem (\`vo.wav\`, \`sfx.wav\`, \`musik.wav\`). Saat narasi bicara, musik di mix lengkap diturunkan -7 dB (tetap terdengar, sekitar 13 dB di bawah suara) dan SFX -8 dB; musik juga diberi kantong -3 dB di 2,5 kHz supaya suara tetap jelas.\n`;
md += `3. Mau dubbing suara sendiri: pakai \`mira-tutorial-tanpa-narasi.mp4\`, import \`naskah-vo.srt\` sebagai panduan, rekam per baris (v01 sampai v${String(VO.length).padStart(2, "0")}).\n`;
md += `4. Fade buka (0,6 dtk dari gelap) dan fade tutup (${stamp(T.fadeOut)} sampai akhir) sudah menyatu di gambar dan audio.\n\n`;

md += `## Peta adegan\n\n| # | Waktu | Adegan | Yang terlihat di layar |\n|---|---|---|---|\n`;
SCENES.forEach((s, i) => (md += `| ${i + 1} | ${stamp(s.start)} – ${stamp(s.end)} | ${s.judul} | ${s.visual} |\n`));
md += `\n**Transisi sapuan pixel** (khas Mira): ${SWEEPS.map((s) => stamp(s.inStart)).join(", ")}. Laptop → tablet → HP memakai morph pegas mulus (${stamp(T.morphTablet)} dan ${stamp(T.morphPhone)}), bukan potongan.\n`;

md += `\n## Naskah narasi per baris\n\nKolom *Ucapan TTS* hanya diisi bila ejaan untuk suara berbeda dari teks tampil (supaya lafal Indonesia pas).\n`;
for (const s of SCENES) {
  const lines = VO.filter((v) => v.scene === s.id);
  if (!lines.length) continue;
  md += `\n### ${s.judul} (${stamp(s.start)} – ${stamp(s.end)})\n\n| ID | Mulai | Selesai | Kalimat | Ucapan TTS | Arahan | Di layar |\n|---|---|---|---|---|---|---|\n`;
  for (const v of lines) md += `| ${v.id} | ${stamp(v.start)} | ${stamp(endOf(v.id, v.end, v.start))} | **${v.text}** | ${v.ucap ?? ""} | ${v.arahan ?? ""} | ${v.layar} |\n`;
}

md += `\n## Teks narasi utuh (sekali baca)\n\n`;
for (const s of SCENES) {
  const lines = VO.filter((v) => v.scene === s.id);
  if (lines.length) md += `**${s.judul}**  \n${lines.map((v) => v.text).join(" ")}\n\n`;
}

md += `## Musik (audio/musik.wav)\n\n| Waktu | Bagian | Isi |\n|---|---|---|\n`;
MUSIC.forEach((m) => (md += `| ${stamp(m.from)} – ${stamp(m.to)} | ${m.section} | ${MUSIC_DESC[m.section]} |\n`));

md += `\n## SFX (audio/sfx.wav)\n\nSemua SFX dibuat dengan **ElevenLabs Sound Effects** (model v3) dalam satu tema: UI modern yang bersih, lembut, tanpa gema. Ketikan keyboard dipotong per ketukan dari satu rekaman lalu dijadwalkan per huruf, supaya pas dengan teks yang muncul.\n\n`;
md += `| Nama | Deskripsi (prompt) | Durasi |\n|---|---|---|\n`;
for (const [name, s] of Object.entries(LIB as Record<string, { text: string; d: number; n?: number }>)) md += `| ${name}${s.n ? ` (${s.n} varian)` : ""} | ${s.text} | ${s.d} dtk |\n`;
md += `\n### Jadwal SFX\n\n| Waktu | Jenis | Untuk |\n|---|---|---|\n`;
[...CUES].sort((a, b) => a.t - b.t).forEach((c) => (md += `| ${stamp(c.t)} | ${c.type === "type" ? "ketikan" : c.type} | ${c.label} |\n`));

md += `\n## Catatan fakta (aman dipublikasikan)\n\n`;
md += `- Kode keamanan (captcha) MyBest memang diisi otomatis oleh Mira: \`solve_captcha()\` di \`app/modules/elearning.py\`.\n`;
md += `- Sesi portal kampus sekitar 15 menit dan Mira login ulang otomatis: komentar \`app/upstream_session.py\`; sesi Mira aktif 7 hari (README, halaman login).\n`;
md += `- Keamanan: password terenkripsi AES-256-GCM, maks 10 login per menit per IP dengan blokir bertingkat, logout semua sesi (README, halaman Sesi & Keamanan).\n`;
md += `- Kontras teks utama \`#072033\` di atas latar \`#F7FAFC\` = 15,5 : 1 (target WCAG AAA, \`landing-page/DESIGN.md\`). Standar AA minimal 4,5 : 1, AAA mulai 7 : 1.\n`;
md += `- Teks notifikasi persis \`app/notifier.py\`; cek link publik/privat dari \`app/link_check.py\`; format chat ala WhatsApp & chip YouTube/Instagram dari \`MessageBody.tsx\`.\n`;
md += `- Tampilan portal kampus digambar ulang dari tangkapan layar untuk perbandingan: logo resmi diganti bentuk netral, data pribadi diganti persona contoh **Dinda (NIM 15250418)**, email \`dinda@example.com\`, IP dokumentasi \`203.0.113.24\`.\n`;
md += `- Narasi dan SFX dibuat dengan akun ElevenLabs berbayar milikmu (paket Starter); pemakaian komersial mengikuti ketentuan ElevenLabs untuk paket berbayar. Musik disintesis sendiri dari kode (orisinal).\n`;
md += `- Disclaimer "Mira bukan aplikasi resmi UBSI" tampil di outro.\n`;

md += `\n## Mengubah narasi\n\n`;
md += `- Edit \`text\` / \`ucap\` di \`VO\` (\`src/timeline.ts\`), lalu \`npm run vo\` (butuh \`ELEVENLABS_API_KEY\` di \`.env\`; kalimat yang tidak berubah diambil dari cache, tidak memakan kredit), \`npm run audio\`, \`npm run mux\`, \`npm run naskah\`.\n`;
md += `- \`npm run vo\` juga mentranskrip balik narasi dengan Scribe untuk mengecek lafal, dan memberi tanda bila kalimat terlalu panjang untuk slotnya.\n`;
md += `- URL dibaca "mira dot muaraai dot com" dan "HP" dieja "hape" supaya pelafalannya pas.\n`;

writeFileSync("NASKAH.md", md);

let srt = "";
VO.forEach((v, i) => {
  const next = VO[i + 1];
  const end = Math.min(endOf(v.id, v.end, v.start) + 0.15, next ? next.start - 0.05 : DURATION);
  srt += `${i + 1}\n${srtTime(v.start)} --> ${srtTime(end)}\n${v.text}\n\n`;
});
writeFileSync("naskah-vo.srt", srt);

let tp = `NARASI MIRA v3 (teleprompter) · durasi ${stamp(DURATION)} · suara ElevenLabs MwM\n\n`;
for (const s of SCENES) {
  const lines = VO.filter((v) => v.scene === s.id);
  if (!lines.length) continue;
  tp += `== ${s.judul.toUpperCase()} ==\n`;
  for (const v of lines) tp += `[${stamp(v.start)}]  ${v.text}\n`;
  tp += `\n`;
}
writeFileSync("naskah-teleprompter.txt", tp);

const words = VO.reduce((acc, v) => acc + v.text.split(/\s+/).length, 0);
const missing = VO.filter((v) => !KLIP[v.id]).map((v) => v.id);
console.log(`NASKAH.md, naskah-vo.srt, naskah-teleprompter.txt ditulis. ${VO.length} baris narasi, ${words} kata.${missing.length ? ` Klip belum ada: ${missing.join(", ")}` : ""}`);
for (let i = 0; i < VO.length - 1; i++) {
  const a = VO[i];
  const b = VO[i + 1];
  const end = endOf(a.id, a.end, a.start);
  if (end > b.start - 0.1) console.warn(`PERINGATAN: ${a.id} selesai ${stamp(end)}, terlalu mepet dengan ${b.id} (${stamp(b.start)})`);
}
