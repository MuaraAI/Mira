import { API_DOCS_URL, GITHUB_URL, MCP_URL } from "@/lib/public-links";

/** Identitas situs: satu sumber untuk metadata, JSON-LD, robots, sitemap, dan llms.txt. */
export const SITE_URL = "https://ubsi-api.muaraai.com";
export const SITE_NAME = "UBSI-API Muara";
export const SITE_TAGLINE = "Dashboard Akademik, REST API, dan MCP untuk UBSI";
export const SITE_TITLE = `${SITE_NAME}: ${SITE_TAGLINE}`;
export const SITE_DESCRIPTION =
  "UBSI-API Muara menyatukan jadwal kuliah, tugas, presensi, materi, kuis, nilai KHS, KRS, dan layanan kampus UBSI (SIAKAD dan MyBest) dalam satu dashboard, REST API publik, dan server MCP untuk AI agent. Gratis dan open source dari komunitas Muara AI.";

export const FAQ: { q: string; a: string }[] = [
  {
    q: "Apa itu UBSI-API Muara?",
    a: "UBSI-API Muara adalah proyek riset independen non-komersial dari komunitas Muara AI. Layanan ini menyatukan data SIAKAD (students.bsi.ac.id) dan MyBest (elearning.bsi.ac.id) milik Universitas Bina Sarana Informatika ke dalam satu dashboard mahasiswa, REST API, dan server MCP. Proyek ini tidak berafiliasi secara resmi dengan UBSI.",
  },
  {
    q: "Data apa saja yang bisa diakses?",
    a: "Jadwal kuliah, tugas dan deadline, presensi, bahan ajar, kuis dan ujian, nilai dan KHS, KRS, kartu ujian, berita kampus, serta pencarian perpustakaan OPAC.",
  },
  {
    q: "Apakah UBSI-API Muara gratis?",
    a: "Ya. Dashboard dan API gratis dipakai, dan kodenya open source berlisensi MIT di github.com/MuaraAI/UBSI-API.",
  },
  {
    q: "Bagaimana keamanan password kampus saya?",
    a: "Kredensial dienkripsi dengan AES-256-GCM pada sesi server yang aktif 7 hari. Dengan begitu server bisa login ulang ke SIAKAD dan MyBest otomatis saat sesi kampus habis, tanpa kamu login lagi. Kamu bisa keluar dari satu perangkat atau semua perangkat kapan saja, dan API hanya bisa dipakai dengan Personal API Key milikmu.",
  },
  {
    q: "Bagaimana cara memakai REST API dan MCP?",
    a: `Masuk ke dashboard, buat Personal API Key, lalu kirim lewat header Authorization: Bearer. Katalog endpoint ada di ${API_DOCS_URL}. AI agent seperti Claude, ChatGPT, atau Cursor bisa terhubung lewat server MCP di ${MCP_URL}.`,
  },
  {
    q: "Apakah bisa dipakai di HP?",
    a: "Bisa. Dashboard responsif dan dapat dipasang sebagai aplikasi (PWA), lengkap dengan notifikasi pengingat jadwal, tugas, kuis, dan nilai langsung di layar kunci HP.",
  },
];

/** Crawler AI/pencarian yang diizinkan membaca halaman publik (bukan dashboard). */
export const AI_CRAWLERS = [
  "Googlebot",
  "Google-Extended",
  "Bingbot",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Applebot",
  "Applebot-Extended",
  "DuckDuckBot",
  "YouBot",
  "CCBot",
  "Meta-ExternalAgent",
  "Amazonbot",
];

export { API_DOCS_URL, GITHUB_URL, MCP_URL };
