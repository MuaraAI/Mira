import type { Metadata } from "next";
import { API_DOCS_URL, GITHUB_URL, MCP_URL } from "@/lib/public-links";

/** Identitas situs: satu sumber untuk metadata, JSON-LD, robots, sitemap, dan llms.txt. */
export const SITE_URL = "https://mira.muaraai.com";
export const SITE_NAME = "Mira";
export const SITE_TAGLINE = "Dashboard Mahasiswa untuk MyBest & SIAKAD UBSI";
export const SITE_TITLE = "Mira UBSI: Dashboard Mahasiswa untuk MyBest & SIAKAD";
export const SITE_DESCRIPTION =
  "Akses SIAKAD, MyBest, Ujian Online, Perpustakaan OPAC, Berita, dan Repository UBSI dalam satu dashboard mahasiswa. Cek jadwal, absen, tugas, dan nilai.";

export function buildPageMetadata({
  title,
  description,
  path,
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  const fullTitle = path === "/" ? SITE_TITLE : `${title} | ${SITE_NAME}`;
  const pageUrl = path === "/" ? SITE_URL : `${SITE_URL}${path}`;

  return {
    title,
    description,
    ...(noIndex ? { robots: { index: false, follow: false } } : { alternates: { canonical: path } }),
    openGraph: {
      title: fullTitle,
      description,
      url: pageUrl,
      siteName: SITE_NAME,
      locale: "id_ID",
      type: "website",
      images: [
        {
          url: "/opengraph-image",
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      site: "@MuaraAI",
      creator: "@MuaraAI",
      title: fullTitle,
      description,
      images: ["/opengraph-image"],
    },
  };
}

export function buildBreadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.path === "/" ? SITE_URL : `${SITE_URL}${item.path}`,
    })),
  };
}

export const FAQ: { q: string; a: string }[] = [
  {
    q: "Ini apa sih?",
    a: "Mira (sebelumnya dikenal sebagai UBSI API / Mira API) adalah platform terpadu untuk mengakses 6 layanan kampus Universitas Bina Sarana Informatika / UBSI (BSI) sekaligus: SIAKAD (students.bsi.ac.id), MyBest Elearning (elearning.bsi.ac.id), Ujian Online (ujiankampusa.bsi.ac.id), Perpustakaan OPAC (elibrary.bsi.ac.id), Berita Resmi (news.bsi.ac.id), dan Repository Skripsi/Riset (repository.bsi.ac.id) di satu tempat. Proyek independen non-komersial dari komunitas Muara AI, bukan aplikasi resmi UBSI.",
  },
  {
    q: "Bisa dipakai buat apa aja?",
    a: "Lihat jadwal kuliah, presensi kehadiran, tugas dan deadline, kuis dan ujian online, bahan ajar dosen, unduh 5 paket bahan ajar resmi (Slide, Modul, Silabus, RPS, RTM), nilai dan KHS/KRS, berita kampus, cari buku fisik di perpustakaan, hingga eksplorasi repositori skripsi. Ada juga pengingat otomatis ke notifikasi HP, Discord, atau Telegram.",
  },
  {
    q: "Gratis nggak?",
    a: "Gratis. Kodenya juga open source (lisensi MIT) di github.com/MuaraAI/Mira.",
  },
  {
    q: "Password kampusku aman?",
    a: "Password dienkripsi di server: salinan sesi aktif 7 hari memakai AES-256-GCM di Redis, dan tautan SIAKAD disimpan terenkripsi Fernet per NIM di SQLite agar kamu tidak perlu menautkan ulang saat berganti perangkat. Keduanya dipakai supaya server bisa memperbarui login kampus otomatis saat sesi portal kedaluwarsa, dan dapat dicabut kapan saja lewat Sesi & Keamanan atau logout semua perangkat. Akses API dan MCP membutuhkan Personal API Key milikmu.",
  },
  {
    q: "Gimana cara pakai REST API dan MCP?",
    a: `Masuk ke dashboard, buat Personal API Key, lalu kirim lewat header Authorization: Bearer. Panduan pengembang ada di ${SITE_URL}/developers, katalog endpoint JSON ada di ${API_DOCS_URL}, dan AI agent seperti Claude, ChatGPT, Codex, atau Cursor bisa tersambung ke server MCP 42 tools di ${MCP_URL}.`,
  },
  {
    q: "Bisa dipakai di HP?",
    a: "Bisa. Tampilannya menyesuaikan layar HP dan bisa dipasang sebagai aplikasi (PWA), jadi notifikasi pengingat kelas, absen, dan tugas muncul langsung di HP.",
  },
];

export { API_DOCS_URL, GITHUB_URL, MCP_URL };
