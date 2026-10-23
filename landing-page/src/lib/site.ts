import { API_DOCS_URL, GITHUB_URL, MCP_URL } from "@/lib/public-links";

/** Identitas situs: satu sumber untuk metadata, JSON-LD, robots, sitemap, dan llms.txt. */
export const SITE_URL = "https://mira.muaraai.com";
export const SITE_NAME = "Mira";
export const SITE_TAGLINE = "Satu Tempat untuk Seluruh Layanan Kampus UBSI";
export const SITE_TITLE = `${SITE_NAME}: ${SITE_TAGLINE}`;
export const SITE_DESCRIPTION =
  "Satu akses terpadu untuk 6 layanan kampus UBSI: SIAKAD, MyBest, Ujian Online, Perpustakaan OPAC, Berita Kampus, dan Repository Riset. Terhubung langsung tanpa perlu login berulang.";

export const FAQ: { q: string; a: string }[] = [
  {
    q: "Ini apa sih?",
    a: "Mira adalah platform terpadu untuk mengakses 6 layanan kampus UBSI sekaligus: SIAKAD (students.bsi.ac.id), MyBest Elearning (elearning.bsi.ac.id), Ujian Online (ujiankampusa.bsi.ac.id), Perpustakaan OPAC (elibrary.bsi.ac.id), Berita Resmi (news.bsi.ac.id), dan Repository Skripsi/Riset (repository.bsi.ac.id) di satu tempat. Proyek independen non-komersial dari komunitas Muara AI, bukan aplikasi resmi UBSI.",
  },
  {
    q: "Bisa dipakai buat apa aja?",
    a: "Lihat jadwal kuliah, presensi kehadiran, tugas dan deadline, kuis dan ujian online, bahan ajar dosen, nilai dan KHS/KRS, berita kampus, cari buku fisik di perpustakaan, hingga eksplorasi repositori skripsi. Ada juga pengingat otomatis ke notifikasi HP, Discord, atau Telegram.",
  },
  {
    q: "Gratis nggak?",
    a: "Gratis. Kodenya juga open source (lisensi MIT) di github.com/MuaraAI/Mira.",
  },
  {
    q: "Password kampusku aman?",
    a: "Password dienkripsi (AES-256-GCM) di sesi server yang aktif 7 hari. Gunanya biar server bisa login ulang sendiri ke SIAKAD dan MyBest waktu sesi kampus habis, jadi kamu nggak perlu login lagi. Kamu bisa keluar dari satu atau semua perangkat kapan aja, dan API cuma bisa dipakai dengan Personal API Key milikmu.",
  },
  {
    q: "Gimana cara pakai REST API dan MCP?",
    a: `Masuk ke dashboard, buat Personal API Key, lalu kirim lewat header Authorization: Bearer. Daftar endpoint ada di ${API_DOCS_URL}. Buat AI agent seperti Claude, ChatGPT, atau Cursor, sambungkan ke server MCP di ${MCP_URL}.`,
  },
  {
    q: "Bisa dipakai di HP?",
    a: "Bisa. Tampilannya menyesuaikan layar HP dan bisa dipasang sebagai aplikasi (PWA), jadi notifikasi pengingat kelas, absen, dan tugas muncul langsung di HP.",
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
