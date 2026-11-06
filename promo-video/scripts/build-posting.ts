// Teks siap tempel untuk posting: judul & deskripsi YouTube (chapter otomatis dari timeline),
// caption IG Feed/Reels, teks IG Story, subtitle .srt, dan panduan upload.
// Jalankan: node --no-warnings scripts/build-posting.ts   (hasil di out/posting/)
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { BAB, DURATION, SCENES, STORY_PARTS } from "../src/timeline.ts";

const OUT = "out/posting";
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const dir = (d: string) => mkdirSync(`${OUT}/${d}`, { recursive: true });

// Chapter YouTube: mulai 0:00, tiap bab minimal 10 detik (bab pendek digabung ke bab berikutnya).
const chapters: { at: number; name: string }[] = [];
for (const s of SCENES) {
  const at = Math.floor(s.start);
  const prev = chapters[chapters.length - 1];
  if (prev && at - prev.at < 10) prev.name = `${prev.name} & ${BAB[s.id].toLowerCase()}`;
  else chapters.push({ at, name: BAB[s.id] });
}
const last = chapters[chapters.length - 1];
if (DURATION - last.at < 10 && chapters.length > 1) {
  chapters[chapters.length - 2].name += ` & ${last.name.toLowerCase()}`;
  chapters.pop();
}

const FITUR = [
  "Masuk sekali pakai akun kampus (NIM + password SIAKAD & MyBest), sesi aktif 7 hari",
  "Kode keamanan (captcha) MyBest diisi otomatis",
  "Ringkasan: kelas berikutnya, tugas, dan IPK langsung terlihat",
  "Jadwal kuliah hari ini dan seminggu penuh",
  "Kumpulkan tugas lewat link Drive, akses publik dicek dulu",
  "Komunitas kelas: format ala WhatsApp, link YouTube/Instagram tampil rapi",
  "Notifikasi absen dan presensi tanpa login ulang",
  "Password terenkripsi AES-256-GCM, login dibatasi, logout semua perangkat",
];
// Hashtag BSI: identitas resmi kampus ("Kampus Digital Kreatif") + akun resmi @kuliahbsiaja.
const HASHTAG = "#UBSI #UniversitasBSI #BSI #KampusDigitalKreatif #KuliahBSIAja #MahasiswaUBSI #UBSIPontianak #BinaSaranaInformatika";
const REPO = "https://github.com/MuaraAI/Mira";
const PEMBUAT = "Dibuat oleh mahasiswa semester 1 Informatika UBSI Kampus Pontianak (tim Muara AI), dan sekarang sudah dipakai 40 mahasiswa.";
const OPEN_SOURCE = `Open source (lisensi MIT) untuk UI dan sistemnya: ${REPO}
Mau fork atau kembangkan sendiri? Silakan.
Yang dibuka hanya kode. Data mahasiswa tidak ikut dibuka: dikelola terpisah dan aman, password terenkripsi AES-256-GCM.`;
const DISCLAIMER =
  "Disclaimer: Mira adalah proyek independen dari ide mahasiswa yang terus dikembangkan, tidak berafiliasi dengan pihak Universitas Bina Sarana Informatika (UBSI). Data di video adalah data contoh (Dinda).";

dir("youtube");
writeFileSync(
  `${OUT}/youtube/judul-dan-deskripsi.txt`,
  `PILIHAN JUDUL (maks 100 karakter)
1. Cara Pakai Mira: Login Sekali, Jadwal & Tugas Kuliah Beres
2. Kuliah Tanpa Ribet: Tutorial Mira untuk Mahasiswa UBSI
3. Mira: Satu Pintu untuk SIAKAD, MyBest, Presensi & Chat Kelas

DESKRIPSI
Portal kampus lemot dan tampilannya bikin pusing? Kenalan dengan Mira, alternatif tidak resmi untuk web BSI yang lebih cepat, lebih rapi, dan enak dipakai di HP: satu pintu untuk jadwal, tugas, presensi, sampai chat kelas.

Coba gratis: https://mira.muaraai.com

Bab:
${chapters.map((c) => `${mmss(c.at)} ${c.name}`).join("\n")}

Yang dibahas:
${FITUR.map((f) => `- ${f}`).join("\n")}

${PEMBUAT}

${OPEN_SOURCE}

${DISCLAIMER}

${HASHTAG}

TAG (kolom Tags di YouTube Studio)
mira, mira muara ai, ubsi, universitas bsi, mahasiswa ubsi, kampus digital kreatif, mybest ubsi, siakad ubsi, jadwal kuliah, presensi online, tutorial kuliah, open source
`,
);
if (existsSync("naskah-vo.srt")) copyFileSync("naskah-vo.srt", `${OUT}/youtube/subtitle-id.srt`);

const igCaption = (ajakan: string) => `Portal kampus lemot, tampilannya bikin pusing? Coba Mira ⚡

Mira adalah alternatif tidak resmi untuk web BSI: lebih cepat, lebih rapi, dan enak dipakai di HP. Semua layanan kuliah UBSI dikumpulkan dalam satu pintu.

■ Jadwal hari ini & seminggu, langsung di halaman depan
■ Tugas urut dari deadline terdekat, kumpulkan lewat link Drive
■ Notifikasi absen masuk ke HP → ketuk → beres
■ Chat kelas dengan format ala WhatsApp
■ Tampilan bersih & nyaman di laptop, tablet, dan HP

Dibangun oleh mahasiswa semester 1 Informatika UBSI Kampus Pontianak (tim Muara AI) 🎓
Sudah dipakai 40 mahasiswa, dan terus dikembangkan.

→ Coba: mira.muaraai.com (link di bio)
→ Kode sumber: github.com/MuaraAI/Mira

Open source (MIT) untuk UI & sistemnya. Silakan fork, pelajari, atau kembangkan sendiri.
🔒 Yang dibuka hanya kodenya. Data mahasiswa tidak ikut dibuka: disimpan terpisah dan aman, password terenkripsi AES-256-GCM.

${ajakan}

Sisanya, biar Mira yang atur.

※ Mira adalah proyek independen dari ide mahasiswa dan tidak berafiliasi dengan Universitas Bina Sarana Informatika (UBSI). Data di video adalah data contoh.

${HASHTAG}
`;
dir("instagram-feed");
writeFileSync(`${OUT}/instagram-feed/caption.txt`, igCaption("Simpan dulu, lalu tag teman sekelas yang paling sering nunggu portal loading 👇"));
dir("instagram-reels");
writeFileSync(`${OUT}/instagram-reels/caption.txt`, igCaption("Kirim ke teman sekelas yang masih setia nunggu portal loading 👇"));
dir("instagram-story");
writeFileSync(
  `${OUT}/instagram-story/teks-story.txt`,
  STORY_PARTS.map((p, i) => {
    const names = SCENES.filter((s) => s.start >= p.from && s.start < p.to).map((s) => BAB[s.id]);
    return `BAGIAN ${i + 1}/3 (${mmss(p.from)} - ${mmss(p.to)}): ${names.join(", ")}\nStiker tautan: https://mira.muaraai.com (teks stiker: "Coba Mira")${i === 0 ? "\nStiker polling (opsional): \"Pernah ke-logout pas mau absen?\" Pernah / Sering banget" : ""}`;
  }).join("\n\n") + "\n",
);

writeFileSync(
  `${OUT}/BACA-DULU.md`,
  `# Paket posting video Mira

| Platform | File | Spesifikasi |
|---|---|---|
| YouTube | \`youtube/mira-tutorial-youtube-1080p60.mp4\` | 1920x1080, 60 fps, subtitle Jersey 25 menyatu |
| YouTube thumbnail | \`youtube/thumbnail-youtube.jpg\` | 1280x720 |
| YouTube teks | \`youtube/judul-dan-deskripsi.txt\` | judul, deskripsi + chapter, tag |
| YouTube CC | \`youtube/subtitle-id.srt\` | opsional: unggah sebagai subtitle Bahasa Indonesia |
| IG Feed | \`instagram-feed/mira-feed-4x5.mp4\` + \`cover-feed-4x5.png\` | 1080x1350 (4:5), 30 fps |
| IG Reels | \`instagram-reels/mira-reels-9x16.mp4\` + \`cover-reels-9x16.png\` | 1080x1920 (9:16), 30 fps, ${mmss(DURATION)} |
| IG Story | \`instagram-story/mira-story-1-dari-3.mp4\` s/d \`3-dari-3\` | 1080x1920, tiap bagian di bawah 60 dtk |

## Tips upload
- **YouTube:** pilih thumbnail khusus, tempel deskripsi apa adanya (baris \`0:00 ...\` otomatis jadi chapter).
- **IG Reels:** saat memilih cover, pakai \`cover-reels-9x16.png\`; judul cover sudah di tengah supaya tetap utuh saat dipotong jadi kotak di grid profil.
- **IG Feed:** unggah sebagai postingan biasa; rasio 4:5 sudah pas, tidak perlu di-crop.
- **IG Story:** unggah berurutan 1, 2, 3. Tambahkan stiker tautan ke mira.muaraai.com di bagian 3 (atau di semua bagian).
- Area atas & bawah video vertikal sengaja dibiarkan lega supaya tidak tertutup nama akun dan kolom balasan Instagram.
`,
);
console.log(`Teks posting ditulis ke ${OUT}/. Chapter YouTube: ${chapters.length}`);
console.log(chapters.map((c) => `  ${mmss(c.at)} ${c.name}`).join("\n"));
