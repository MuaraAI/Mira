import { RoadmapItem } from "@/types";

export const ROADMAP_ITEMS: RoadmapItem[] = [
  {
    version: "v1.2",
    title: "Dashboard Mahasiswa & Webhook",
    description:
      "Akses mandiri jadwal, berita, dan integrasi notifikasi warta kampus ke Discord/Telegram pribadi tanpa API key.",
    status: "tersedia",
    href: "/login",
  },
  {
    version: "v1.2",
    title: "Personal API Key Vault",
    description:
      "Generate personal API key terenkripsi untuk otomasi bot pribadi, integrasi kalender, dan skrip mahasiswa mandiri.",
    status: "tersedia",
    href: "/dashboard",
  },
  {
    version: "v1.2",
    title: "Ekspor Kalender iCal (.ics)",
    description:
      "Sinkronisasi otomatis jadwal kuliah SIAKAD langsung ke Google Calendar di Android dan Apple Calendar di iOS.",
    status: "upcoming",
  },
  {
    version: "v1.2",
    title: "Bulk Modul Downloader",
    description:
      "Unduh seluruh berkas materi perkuliahan, slide presentasi, dan silabus 6 matkul sekaligus dalam satu file terkompresi.",
    status: "planned",
  },
  {
    version: "v1.2",
    title: "Kalkulator & Simulator IPK",
    description:
      "Simulasi perhitungan Indeks Prestasi Kumulatif berdasarkan riwayat nilai murni dan estimasi bobot nilai semester berjalan.",
    status: "planned",
  },
];
