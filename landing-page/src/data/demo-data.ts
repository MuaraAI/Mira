export type DemoViewId =
  | "ringkasan"
  | "komunitas"
  | "jadwal"
  | "tugas"
  | "presensi"
  | "pengganti"
  | "materi"
  | "kuis"
  | "diskusi"
  | "nilai"
  | "krs"
  | "ujian"
  | "agenda"
  | "berita"
  | "perpustakaan"
  | "keys"
  | "notifikasi"
  | "sesi";

export const DEMO_STUDENT = {
  nama: "Dinda Putri Lestari",
  panggilan: "Dinda",
  nim: "15230789",
  prodi: "Teknik Informatika (S1)",
  kelas: "15.3A.01",
  semester: 3,
  kampus: "UBSI Pontianak",
};

export interface DemoCourseSchedule {
  id: string;
  kode: string;
  nama: string;
  hari: "Senin" | "Selasa" | "Rabu" | "Kamis" | "Jumat";
  jam: string;
  ruang: string;
  sks: number;
  dosen: string;
}

export const DEMO_SCHEDULE: DemoCourseSchedule[] = [
  {
    id: "inf101",
    kode: "INF101",
    nama: "Pemrograman Web",
    hari: "Senin",
    jam: "08:00 - 10:30",
    ruang: "LAB 1",
    sks: 3,
    dosen: "Dr. Hendra, M.Kom",
  },
  {
    id: "inf201",
    kode: "INF201",
    nama: "Basis Data Lanjut",
    hari: "Selasa",
    jam: "10:45 - 13:15",
    ruang: "R. 204",
    sks: 3,
    dosen: "Siti Nurhaliza, M.Kom",
  },
  {
    id: "inf204",
    kode: "INF204",
    nama: "Struktur Data & Algoritma",
    hari: "Rabu",
    jam: "08:00 - 10:30",
    ruang: "R. 302",
    sks: 4,
    dosen: "Rizky Pratama, M.Kom",
  },
  {
    id: "inf208",
    kode: "INF208",
    nama: "Jaringan Komputer",
    hari: "Kamis",
    jam: "13:30 - 16:00",
    ruang: "LAB Jaringan",
    sks: 3,
    dosen: "Budi Santoso, M.T",
  },
  {
    id: "inf212",
    kode: "INF212",
    nama: "Rekayasa Perangkat Lunak",
    hari: "Jumat",
    jam: "09:00 - 11:30",
    ruang: "Online (Zoom)",
    sks: 3,
    dosen: "Nadia Kusuma, M.Kom",
  },
  {
    id: "inf215",
    kode: "INF215",
    nama: "Bahasa Inggris I",
    hari: "Jumat",
    jam: "13:30 - 15:10",
    ruang: "R. 105",
    sks: 2,
    dosen: "Dewi Anggraini, M.Pd",
  },
  {
    id: "inf219",
    kode: "INF219",
    nama: "Statistika Komputasi",
    hari: "Selasa",
    jam: "14:00 - 15:40",
    ruang: "R. 201",
    sks: 2,
    dosen: "Agus Setiawan, M.Si",
  },
];

export interface DemoTaskItem {
  id: string;
  kode: string;
  matkul: string;
  judul: string;
  deadline: string;
  pertemuan: number;
  initialDone: boolean;
}

export const DEMO_TASKS: DemoTaskItem[] = [
  {
    id: "t1",
    kode: "INF201",
    matkul: "Basis Data Lanjut",
    judul: "Tugas 3: Desain ERD & Normalisasi Database Toko Online",
    deadline: "2 hari lagi (23:59 WIB)",
    pertemuan: 7,
    initialDone: false,
  },
  {
    id: "t2",
    kode: "INF101",
    matkul: "Pemrograman Web",
    judul: "Tugas 2: Implementasi REST Client & Validasi Form",
    deadline: "Sudah dikumpulkan",
    pertemuan: 6,
    initialDone: true,
  },
  {
    id: "t3",
    kode: "INF204",
    matkul: "Struktur Data & Algoritma",
    judul: "Tugas 1: Analisis Kompleksitas Binary Search Tree",
    deadline: "Sudah dikumpulkan",
    pertemuan: 5,
    initialDone: true,
  },
];

export const DEMO_PENGGANTI = [
  {
    id: "pg1",
    kode: "INF208",
    matkul: "Jaringan Komputer",
    tanggalAsli: "Kamis, 19 Nov 2026",
    jadwalPengganti: "Sabtu, 28 Nov 2026 · 09:00 - 11:30 WIB",
    ruang: "LAB Jaringan 2",
    alasan: "Penyesuaian jadwal praktikum router",
  },
  {
    id: "pg2",
    kode: "INF212",
    matkul: "Rekayasa Perangkat Lunak",
    tanggalAsli: "Jumat, 20 Nov 2026",
    jadwalPengganti: "Senin, 30 Nov 2026 · 18:30 - 20:30 WIB",
    ruang: "Online (MyBest Meet)",
    alasan: "Workshop desain arsitektur sistem",
  },
];

export const DEMO_MATERI = [
  {
    id: "m1",
    kode: "INF101",
    matkul: "Pemrograman Web",
    pertemuan: "Pertemuan 7",
    topik: "Server Components & State Management Modern",
    paket: ["Slide", "Modul", "Silabus", "RPS", "RTM"],
    ringkasan: "Membahas pemisahan server/client boundary, validasi form, dan optimasi bundle web.",
  },
  {
    id: "m2",
    kode: "INF201",
    matkul: "Basis Data Lanjut",
    pertemuan: "Pertemuan 7",
    topik: "Normalisasi 3NF, BCNF, dan Indexing B-Tree",
    paket: ["Slide", "Modul", "RPS"],
    ringkasan: "Strategi eliminasi anomali relasi tabel dan pembacaan execution plan query SQL.",
  },
  {
    id: "m3",
    kode: "INF204",
    matkul: "Struktur Data & Algoritma",
    pertemuan: "Pertemuan 6",
    topik: "Graph Traversal: BFS dan Shortest Path",
    paket: ["Slide", "Modul", "Silabus", "RTM"],
    ringkasan: "Implementasi adjacency list dengan queue dan aplikasi rute terpendek.",
  },
];

export const DEMO_QUIZ_QUESTIONS = [
  {
    id: "q1",
    prompt: "Bentuk normal ke-3 (3NF) pada basis data relasional bertujuan untuk menghilangkan...",
    options: [
      "Primary key pada tabel induk",
      "Dependensi transitif antar atribut non-kunci",
      "Seluruh foreign key antar tabel",
    ],
    answer: 1,
  },
  {
    id: "q2",
    prompt: "Pada React & Next.js App Router, hook useEffect hanya berjalan pada...",
    options: [
      "Browser (Client Component)",
      "Server saat proses build statis",
      "Database layer",
    ],
    answer: 0,
  },
  {
    id: "q3",
    prompt: "Kompleksitas waktu rata-rata pencarian pada Balanced Binary Search Tree adalah...",
    options: ["O(1)", "O(log n)", "O(n^2)"],
    answer: 1,
  },
];

export const DEMO_DISCUSSIONS = [
  {
    id: "d1",
    matkul: "Pemrograman Web (INF101)",
    author: "Dr. Hendra, M.Kom",
    title: "Ketentuan Proyek Akhir & Kelompok",
    body: "Silakan bentuk kelompok maksimal 3 mahasiswa dan daftarkan judul aplikasi sebelum pertemuan 9.",
    replies: [
      { author: "Rafi Pratama", text: "Baik Pak, kelompok kami sudah menyiapkan proposal." },
    ],
  },
  {
    id: "d2",
    matkul: "Basis Data Lanjut (INF201)",
    author: "Siti Nurhaliza, M.Kom",
    title: "Tanya Jawab Tugas 3 Normalisasi ERD",
    body: "Pastikan kardinalitas relasi many-to-many sudah dipecah menjadi tabel penghubung.",
    replies: [
      { author: "Dinda Putri", text: "Apakah atribut jumlah barang masuk ke tabel detail transaksi, Bu?" },
    ],
  },
];

export const DEMO_KHS_SEMESTERS: Record<
  string,
  { ips: string; sks: number; courses: { kode: string; nama: string; sks: number; nilai: string; mutu: string }[] }
> = {
  "1": {
    ips: "3.82",
    sks: 20,
    courses: [
      { kode: "INF100", nama: "Logika & Algoritma", sks: 4, nilai: "A", mutu: "16.0" },
      { kode: "INF102", nama: "Pengantar Teknologi Informasi", sks: 3, nilai: "A", mutu: "12.0" },
      { kode: "INF104", nama: "Matematika Diskrit", sks: 3, nilai: "A-", mutu: "11.1" },
      { kode: "UMM101", nama: "Pendidikan Pancasila", sks: 2, nilai: "A", mutu: "8.0" },
    ],
  },
  "2": {
    ips: "3.88",
    sks: 22,
    courses: [
      { kode: "INF110", nama: "Pemrograman Berorientasi Objek", sks: 4, nilai: "A", mutu: "16.0" },
      { kode: "INF112", nama: "Sistem Operasi", sks: 3, nilai: "A", mutu: "12.0" },
      { kode: "INF115", nama: "Basis Data Dasar", sks: 3, nilai: "A", mutu: "12.0" },
      { kode: "INF118", nama: "Aljabar Linear", sks: 3, nilai: "B+", mutu: "9.9" },
    ],
  },
  "3": {
    ips: "3.85",
    sks: 20,
    courses: [
      { kode: "INF101", nama: "Pemrograman Web", sks: 3, nilai: "A", mutu: "12.0" },
      { kode: "INF201", nama: "Basis Data Lanjut", sks: 3, nilai: "A", mutu: "12.0" },
      { kode: "INF204", nama: "Struktur Data & Algoritma", sks: 4, nilai: "A-", mutu: "14.8" },
      { kode: "INF208", nama: "Jaringan Komputer", sks: 3, nilai: "A", mutu: "12.0" },
    ],
  },
};

export const DEMO_UTS_EXAMS = [
  { kode: "INF215", matkul: "Bahasa Inggris I", tanggal: "Selasa, 10 Nov 2026", waktu: "09:00 - 10:30 WIB", ruang: "EN2-P1" },
  { kode: "INF101", matkul: "Pemrograman Web", tanggal: "Rabu, 11 Nov 2026", waktu: "08:00 - 09:30 WIB", ruang: "LAB-1" },
  { kode: "INF201", matkul: "Basis Data Lanjut", tanggal: "Kamis, 12 Nov 2026", waktu: "10:00 - 11:30 WIB", ruang: "R-204" },
  { kode: "INF204", matkul: "Struktur Data & Algoritma", tanggal: "Jumat, 13 Nov 2026", waktu: "08:00 - 09:30 WIB", ruang: "R-302" },
];

export const DEMO_AGENDA = [
  {
    id: "ag1",
    judul: "Ujian Tengah Semester (UTS) Ganjil 2026/2027",
    tanggal: "10 Nov 2026 s.d. 21 Nov 2026",
    countdown: "H-4 Menuju Ujian",
    kategori: "Ujian",
  },
  {
    id: "ag2",
    judul: "Batas Pengisian KRS Susulan & Perubahan Kelas",
    tanggal: "27 Nov 2026",
    countdown: "3 hari lagi",
    kategori: "Akademik",
  },
  {
    id: "ag3",
    judul: "Pekan Riset & Seminar Proposal Informatika",
    tanggal: "12 Des 2026 s.d. 15 Des 2026",
    countdown: "18 hari lagi",
    kategori: "Kampus",
  },
];

export const DEMO_BERITA = [
  {
    id: "b1",
    tanggal: "22 Nov 2026",
    kategori: "Akademik",
    judul: "Jadwal Pencetakan Kartu Ujian Online UTS Semester Ganjil",
    ringkasan: "Mahasiswa diimbau memastikan status pembayaran dan presensi memenuhi syarat sebelum mencetak kartu ujian.",
    isi: "Kartu Ujian Tengah Semester sudah dapat diunduh melalui portal ujian atau langsung dari menu Kartu Ujian di Mira. Bawa kartu peserta dan identitas mahasiswa saat mengikuti ujian laboratorium.",
  },
  {
    id: "b2",
    tanggal: "19 Nov 2026",
    kategori: "Perpustakaan",
    judul: "Pembaruan Koleksi E-Book & Referensi Skripsi Teknik Informatika",
    ringkasan: "Perpustakaan OPAC menambahkan 140 judul referensi sistem terdistribusi dan machine learning.",
    isi: "Mahasiswa tingkat akhir dan semester menengah dapat menelusuri kode rak serta status ketersediaan buku secara real-time melalui katalog OPAC.",
  },
  {
    id: "b3",
    tanggal: "15 Nov 2026",
    kategori: "Kemahasiswaan",
    judul: "Pendaftaran Asisten Laboratorium Komputer Periode Genap",
    ringkasan: "Terbuka bagi mahasiswa semester 3 ke atas dengan IPK minimal 3.50.",
    isi: "Seleksi meliputi tes pemrograman dasar, jaringan komputer, dan microteaching di masing-masing kampus cabang.",
  },
];

export const DEMO_BOOKS = [
  { id: "bk1", kode: "005.133 IND", judul: "Clean Architecture & Desain Sistem Web", penulis: "R. Martin", stok: 4, lokasi: "Rak TI-02" },
  { id: "bk2", kode: "005.74 SIL", judul: "Database System Concepts (Edisi 7)", penulis: "A. Silberschatz", stok: 2, lokasi: "Rak TI-05" },
  { id: "bk3", kode: "004.6 TAN", judul: "Computer Networks & Internet Protocols", penulis: "A. Tanenbaum", stok: 0, lokasi: "Dipinjam" },
  { id: "bk4", kode: "005.1 COR", judul: "Introduction to Algorithms", penulis: "T. Cormen", stok: 3, lokasi: "Rak TI-01" },
  { id: "bk5", kode: "006.3 RUS", judul: "Artificial Intelligence: A Modern Approach", penulis: "S. Russell", stok: 5, lokasi: "Rak TI-08" },
  { id: "bk6", kode: "005.43 SIL", judul: "Operating System Concepts", penulis: "A. Silberschatz", stok: 1, lokasi: "Rak TI-04" },
];

export const DEMO_CHANNELS = {
  umum: [
    { id: "c1", sender: "Rafi Pratama", time: "08:12", text: "Info ruang Lab 1 pagi ini AC sudah nyala normal ya.", likes: 4 },
    { id: "c2", sender: "Dinda Putri", time: "08:15", text: "Siap makasih infonya, baru mau otw ke kampus.", likes: 2 },
  ],
  informatika: [
    { id: "c3", sender: "Nadia Salsabila", time: "09:04", text: "Slide pertemuan 7 Basis Data sudah bisa diunduh di menu Bahan Ajar.", likes: 6 },
  ],
  tugas: [
    { id: "c4", sender: "Bagas Prakoso", time: "09:40", text: "Untuk Tugas 3 ERD, relasi many-to-many wajib dipisah jadi tabel detail.", likes: 3 },
  ],
};
