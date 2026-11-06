/**
 * Data contoh untuk video (v2). Struktur & teks mengikuti Mira asli (mock.py, notifier.py,
 * link_check.py, komponen social), tapi isinya fiktif. Satu persona dipakai konsisten di
 * seluruh video, termasuk sisi portal kampus: Dinda, NIM 15250418.
 */
export const DEMO = {
  nama: "Dinda",
  namaKapital: "DINDA",
  username: "dinda",
  nim: "15250418",
  email: "dinda@example.com",
  prodi: "Teknik Informatika",
  kelas: "1A.01",
  semester: "3",
  kampus: "UBSI Pontianak",
  tanggal: "Senin, 9 Nov",
  ipk: "3.75",
  sksLulus: 42,
};

export const CLASSES = [
  { kode: "INF101", nama: "Pemrograman Web", jam: "08:00-10:30", sks: 3, ruang: "302", roomLabel: "Tatap muka · Lantai 3, Ruang 02" },
  { kode: "INF102", nama: "Basis Data", jam: "10:30-13:00", sks: 3, ruang: "305", roomLabel: "Tatap muka · Lantai 3, Ruang 05" },
];

/** Jadwal seminggu (6 mata kuliah) untuk halaman Jadwal Kuliah. */
export const WEEK = [
  {
    day: "Senin",
    today: true,
    items: [
      { kode: "INF101", nama: "Pemrograman Web", sks: 3, jam: "08:00-10:30", room: "Tatap muka · Lantai 3, Ruang 02", dosen: "Andi Pratama (ANP)", status: "next" as const },
      { kode: "INF102", nama: "Basis Data", sks: 3, jam: "10:30-13:00", room: "Tatap muka · Lantai 3, Ruang 05", dosen: "Sari Wulandari (SWD)", status: "upcoming" as const },
    ],
  },
  {
    day: "Selasa",
    items: [{ kode: "MKW103", nama: "Pancasila", sks: 2, jam: "08:00-09:40", room: "Tatap muka · Lantai 1, Ruang 05", dosen: "Hendra Saputra (HSP)" }],
  },
  {
    day: "Rabu",
    items: [
      { kode: "INF104", nama: "Struktur Data", sks: 3, jam: "13:00-15:30", room: "Online · EL1-P1", dosen: "Rina Kusuma (RKS)" },
      { kode: "INF105", nama: "Matematika Diskrit", sks: 3, jam: "15:30-17:10", room: "Tatap muka · Lantai 4, Ruang 01", dosen: "Yoga Permana (YGP)" },
    ],
  },
  {
    day: "Kamis",
    items: [{ kode: "INF106", nama: "Jaringan Komputer", sks: 3, jam: "08:00-10:30", room: "Tatap muka · Lantai 4, Ruang 03", dosen: "Dewi Lestari (DWL)" }],
  },
];

export const TASKS = [
  {
    mk: "PEMROGRAMAN WEB",
    judul: "Tugas 2: Form Registrasi",
    meta: "Pertemuan 5 · Kelas 1A.01",
    desc: "Buat form registrasi mahasiswa dengan validasi HTML5, lalu unggah ke Google Drive.",
    batas: "Sen, 9 Nov 17.00",
    chip: "Sisa 9 jam",
    tone: "urgent" as const,
  },
  {
    mk: "BASIS DATA",
    judul: "Tugas 1: ERD Perpustakaan",
    meta: "Pertemuan 3 · Kelas 1A.01",
    desc: "Rancang ERD sistem perpustakaan lengkap dengan relasi dan kardinalitas.",
    batas: "Rab, 11 Nov 23.59",
    chip: "Sisa 2 hari",
    tone: "soon" as const,
  },
  {
    mk: "STRUKTUR DATA",
    judul: "Tugas 1: Implementasi Stack",
    meta: "Pertemuan 4 · Kelas 1A.01",
    desc: "Implementasikan stack berbasis array dan linked list, sertakan contoh push dan pop.",
    batas: "Min, 15 Nov 23.59",
    chip: "Sisa 6 hari",
    tone: "later" as const,
  },
];

export const DRIVE_LINK = "https://drive.google.com/file/d/1Qm8vR2xLkT7nWp3s/view?usp=sharing";

/** Teks notifikasi persis format notifier.py. */
export const PUSH = {
  kelas: { title: "Kuliah 15 menit lagi: Pemrograman Web", body: "08:00-10:30 | Ruang 302", time: "07.45" },
  absen: { title: "Absen sudah dibuka: Pemrograman Web", body: "Sesi presensi dibuka di MyBest. Tekan untuk absen sekarang.", time: "07.51" },
};

export const SERVICES = ["SIAKAD", "MyBest LMS", "Ujian Online", "Perpustakaan", "Berita Kampus", "Repository Riset"];

/* ------------------------------------------------------------------ Komunitas */

export const MEMBERS = {
  raka: { name: "Raka Pratama", username: "raka" },
  salsa: { name: "Salsabila", username: "salsa" },
  dinda: { name: "Dinda", username: "dinda" },
  bima: { name: "Bima Sakti", username: "bima" },
};

export type ChatMsg = {
  id: string;
  who: keyof typeof MEMBERS;
  text: string;
  time: string;
  /** detik global saat pesan muncul (undefined = sudah ada sejak awal) */
  at?: number;
};

export const CHAT: ChatMsg[] = [
  { id: "m1", who: "raka", text: "Guys, *Tugas 2 Pemweb* deadline nanti jam 17.00 ya", time: "07.31" },
  { id: "m2", who: "raka", text: "Materi pertemuan 5 ada di sini https://youtu.be/pemweb5", time: "07.32" },
  { id: "m3", who: "salsa", text: "_Noted_, makasih! Grup belajar: https://chat.whatsapp.com/kelas1a", time: "07.35", at: 63.7 },
  { id: "m4", who: "salsa", text: "Contoh form yang rapi: https://instagram.com/p/formui", time: "07.36", at: 65.0 },
];

export const DINDA_MSG = "Siap! Cek jadwal di ";
export const DINDA_LINK = "https://mira.muaraai.com/dashboard/jadwal";

/** Warna avatar sama persis dengan toneFor() di lib/social.ts. */
const AVATAR_TONES = [
  { bg: "#0369A1", fg: "#FFFFFF" },
  { bg: "#0F766E", fg: "#FFFFFF" },
  { bg: "#072033", fg: "#FFFFFF" },
  { bg: "#5FA3CC", fg: "#072033" },
  { bg: "#9A3412", fg: "#FFFFFF" },
  { bg: "#FCD34D", fg: "#072033" },
  { bg: "#163A55", fg: "#FFFFFF" },
  { bg: "#9CC6E0", fg: "#072033" },
];

export function toneFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
