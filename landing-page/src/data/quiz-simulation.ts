// ==========================================================================
// SIMULATOR KUIS MANDIRI (TRYOUT CBT) MIRA
// Bank soal latihan resmi UBSI untuk menguji pemahaman materi kuliah
// ==========================================================================

export type OptionKey = "A" | "B" | "C" | "D" | "E";

export interface SimulationOption {
  key: OptionKey;
  text: string;
}

export interface SimulationQuestion {
  id: string;
  no: number;
  kategori: string;
  pertanyaan: string;
  opsi: SimulationOption[];
  kunci_jawaban: OptionKey;
  pembahasan: string;
}

export interface SimulationQuizPackage {
  id: string;
  judul: string;
  kategori: string;
  durasi_menit: number;
  total_soal: number;
  daftar_soal: SimulationQuestion[];
}

export interface SimulationResult {
  total_soal: number;
  terjawab: number;
  belum_terjawab: number;
  benar: number;
  salah: number;
  skor: number; // Skala 0 - 100
  detail_jawaban: Array<{
    id_soal: string;
    no: number;
    pertanyaan: string;
    jawaban_user: string | null;
    kunci_jawaban: OptionKey;
    is_benar: boolean;
    pembahasan: string;
  }>;
}

// --------------------------------------------------------------------------
// Master Bank Soal (32 Butir Soal Terstandarisasi Kurikulum Informatika UBSI)
// --------------------------------------------------------------------------

export const MASTER_SIMULATION_QUESTIONS: Omit<SimulationQuestion, "no">[] = [
  {
    id: "sim_01",
    kategori: "Pengantar TIK",
    pertanyaan: "Komponen perangkat keras komputer yang berfungsi untuk menyimpan data dan instruksi program secara sementara saat sistem sedang berjalan adalah ....",
    opsi: [
      { key: "A", text: "Harddisk Drive" },
      { key: "B", text: "Read Only Memory (ROM)" },
      { key: "C", text: "Random Access Memory (RAM)" },
      { key: "D", text: "Solid State Drive (SSD)" },
      { key: "E", text: "Power Supply Unit" },
    ],
    kunci_jawaban: "C",
    pembahasan: "RAM (Random Access Memory) bersifat volatile, artinya data di dalamnya hanya bertahan selama komputer dialiri daya listrik.",
  },
  {
    id: "sim_02",
    kategori: "Jaringan Komputer",
    pertanyaan: "Topologi jaringan komputer yang menghubungkan semua workstation ke satu kabel utama sebagai jalur transmisi bersama disebut topologi ....",
    opsi: [
      { key: "A", text: "Star" },
      { key: "B", text: "Ring" },
      { key: "C", text: "Mesh" },
      { key: "D", text: "Bus" },
      { key: "E", text: "Tree" },
    ],
    kunci_jawaban: "D",
    pembahasan: "Topologi Bus menggunakan kabel tunggal (backbone) dengan terminator di kedua ujungnya untuk menyalurkan sinyal transmisi data.",
  },
  {
    id: "sim_03",
    kategori: "Jaringan Komputer",
    pertanyaan: "Pada model referensi Open Systems Interconnection (OSI) 7 Layer, lapisan yang bertanggung jawab untuk pengalamatan logis (IP Address) dan perutean (routing) paket data adalah ....",
    opsi: [
      { key: "A", text: "Data Link Layer" },
      { key: "B", text: "Physical Layer" },
      { key: "C", text: "Network Layer" },
      { key: "D", text: "Transport Layer" },
      { key: "E", text: "Application Layer" },
    ],
    kunci_jawaban: "C",
    pembahasan: "Network Layer (Layer 3) bertanggung jawab untuk logical addressing (IP) dan routing paket melalui jalur terbaik menuju tujuan.",
  },
  {
    id: "sim_04",
    kategori: "Dasar Pemrograman",
    pertanyaan: "Dalam sistem kontrol versi Git, perintah manakah yang digunakan untuk membuat sebuah branch baru sekaligus langsung berpindah ke branch tersebut?",
    opsi: [
      { key: "A", text: "git branch -m new-branch" },
      { key: "B", text: "git checkout -b new-branch" },
      { key: "C", text: "git pull origin new-branch" },
      { key: "D", text: "git commit -b new-branch" },
      { key: "E", text: "git switch -m new-branch" },
    ],
    kunci_jawaban: "B",
    pembahasan: "Flag '-b' pada perintah 'git checkout -b <nama_branch>' membuat branch baru dan langsung mengalihkan HEAD kerja ke branch tersebut.",
  },
  {
    id: "sim_05",
    kategori: "Logika dan Algoritma",
    pertanyaan: "Simbol bagan alir (flowchart) standar yang berbentuk belah ketupat (diamond) melambangkan instruksi ....",
    opsi: [
      { key: "A", text: "Operasi Masukan atau Keluaran (Input/Output)" },
      { key: "B", text: "Pengambilan Keputusan atau Percabangan (Decision)" },
      { key: "C", text: "Titik Awal atau Akhir Program (Terminal)" },
      { key: "D", text: "Operasi Perhitungan atau Pemrosesan Data (Process)" },
      { key: "E", text: "Penghubung Antar Halaman (Off-page Connector)" },
    ],
    kunci_jawaban: "B",
    pembahasan: "Simbol belah ketupat (decision) digunakan untuk mengevaluasi suatu kondisi logika yang menghasilkan cabang True atau False.",
  },
  {
    id: "sim_06",
    kategori: "Logika dan Algoritma",
    pertanyaan: "Urutan langkah-langkah terstruktur, logis, dan terhingga yang disusun secara sistematis untuk memecahkan suatu permasalahan komputasi disebut ....",
    opsi: [
      { key: "A", text: "Program" },
      { key: "B", text: "Algoritma" },
      { key: "C", text: "Pseudocode" },
      { key: "D", text: "Flowchart" },
      { key: "E", text: "Sintaksis" },
    ],
    kunci_jawaban: "B",
    pembahasan: "Algoritma adalah serangkaian instruksi terurut yang berhingga untuk menyelesaikan masalah tertentu secara terencana.",
  },
  {
    id: "sim_07",
    kategori: "Jaringan Komputer",
    pertanyaan: "Nomor port standar yang digunakan oleh protokol transfer halaman web dengan enkripsi keamanan Transport Layer Security (HTTPS) adalah ....",
    opsi: [
      { key: "A", text: "Port 21" },
      { key: "B", text: "Port 22" },
      { key: "C", text: "Port 80" },
      { key: "D", text: "Port 443" },
      { key: "E", text: "Port 8080" },
    ],
    kunci_jawaban: "D",
    pembahasan: "Port 443 adalah port default untuk protokol HTTPS (HTTP over TLS/SSL), sedangkan port 80 digunakan untuk HTTP biasa.",
  },
  {
    id: "sim_08",
    kategori: "Struktur Data",
    pertanyaan: "Struktur data linier yang menerapkan prinsip LIFO (Last In First Out), di mana elemen yang terakhir masuk akan pertama kali dikeluarkan, adalah ....",
    opsi: [
      { key: "A", text: "Queue" },
      { key: "B", text: "Stack (Tumpukan)" },
      { key: "C", text: "Array" },
      { key: "D", text: "Linked List" },
      { key: "E", text: "Binary Tree" },
    ],
    kunci_jawaban: "B",
    pembahasan: "Stack beroperasi dengan konsep LIFO melalui operasi push (memasukkan) dan pop (mengeluarkan data teratas).",
  },
  {
    id: "sim_09",
    kategori: "Sistem Basis Data",
    pertanyaan: "Dalam sintaks SQL, perintah manakah yang tergolong ke dalam kelompok Data Definition Language (DDL)?",
    opsi: [
      { key: "A", text: "SELECT" },
      { key: "B", text: "INSERT" },
      { key: "C", text: "CREATE TABLE" },
      { key: "D", text: "UPDATE" },
      { key: "E", text: "DELETE" },
    ],
    kunci_jawaban: "C",
    pembahasan: "DDL menangani struktur skema basis data, seperti CREATE, ALTER, DROP, dan TRUNCATE. SELECT, INSERT, UPDATE, dan DELETE termasuk DML.",
  },
  {
    id: "sim_10",
    kategori: "Pengantar TIK",
    pertanyaan: "Perangkat lunak sistem yang bertugas mengelola sumber daya perangkat keras dan menyediakan layanan dasar bagi aplikasi pengguna adalah ....",
    opsi: [
      { key: "A", text: "Compiler" },
      { key: "B", text: "Sistem Operasi (Operating System)" },
      { key: "C", text: "Database Management System" },
      { key: "D", text: "Web Browser" },
      { key: "E", text: "Antivirus" },
    ],
    kunci_jawaban: "B",
    pembahasan: "Sistem Operasi menjembatani interaksi antara hardware komputer (CPU, memori, I/O) dengan perangkat lunak aplikasi pengguna.",
  },
  {
    id: "sim_11",
    kategori: "Jaringan Komputer",
    pertanyaan: "Protokol jaringan yang bertugas memetakan nama domain ramah manusia (seperti mira.muaraai.com) ke alamat IP numerik server adalah ....",
    opsi: [
      { key: "A", text: "DHCP" },
      { key: "B", text: "DNS (Domain Name System)" },
      { key: "C", text: "FTP" },
      { key: "D", text: "SMTP" },
      { key: "E", text: "SNMP" },
    ],
    kunci_jawaban: "B",
    pembahasan: "DNS berfungsi sebagai buku telepon internet yang menerjemahkan nama host domain menjadi alamat IP komputer.",
  },
  {
    id: "sim_12",
    kategori: "Dasar Pemrograman",
    pertanyaan: "Pada bahasa pemrograman Python, tipe data koleksi manakah yang bersifat terurut (ordered) dan tidak dapat diubah isinya setelah dibuat (immutable)?",
    opsi: [
      { key: "A", text: "List" },
      { key: "B", text: "Dictionary" },
      { key: "C", text: "Tuple" },
      { key: "D", text: "Set" },
      { key: "E", text: "Bytearray" },
    ],
    kunci_jawaban: "C",
    pembahasan: "Tuple didefinisikan dengan tanda kurung () dan bersifat immutable sehingga nilainya tidak dapat dimodifikasi setelah inisialisasi.",
  },
  {
    id: "sim_13",
    kategori: "Pengantar TIK",
    pertanyaan: "Istilah Komunikasi berakar dari kata latin 'Communis' yang bermakna membuat kebersamaan atau membangun kesepahaman antara dua orang atau lebih. Definisi ini dikemukakan oleh ....",
    opsi: [
      { key: "A", text: "Colin Cherry" },
      { key: "B", text: "Harold D. Lasswell" },
      { key: "C", text: "Claude Shannon" },
      { key: "D", text: "Wilbur Schramm" },
      { key: "E", text: "David K. Berlo" },
    ],
    kunci_jawaban: "A",
    pembahasan: "Colin Cherry dalam kajian komunikasi menuturkan kata 'Communis' sebagai fondasi pembentukan kebersamaan informasi antar individu.",
  },
  {
    id: "sim_14",
    kategori: "Pengantar TIK",
    pertanyaan: "Formula model komunikasi klasik 'Who says what in which channel to whom with what effect' dirumuskan oleh tokoh ilmu komunikasi bernama ....",
    opsi: [
      { key: "A", text: "Shannon dan Weaver" },
      { key: "B", text: "Harold D. Lasswell" },
      { key: "C", text: "Wilbur Schramm" },
      { key: "D", text: "Aristoteles" },
      { key: "E", text: "Marshall McLuhan" },
    ],
    kunci_jawaban: "B",
    pembahasan: "Formula Harold D. Lasswell (1948) menguraikan 5 komponen utama komunikasi: komunikator, pesan, media, komunikan, dan efek.",
  },
  {
    id: "sim_15",
    kategori: "Jaringan Komputer",
    pertanyaan: "Metode transmisi data asinkronus (asynchronous) memiliki ciri pembeda utama berupa ....",
    opsi: [
      { key: "A", text: "Pengiriman data serentak dengan clock yang disinkronisasi bersama" },
      { key: "B", text: "Karakter data dibungkus dengan bit awal (start bit) dan bit akhir (stop bit)" },
      { key: "C", text: "Hanya dapat beroperasi melalui kabel serat optik kecepatan tinggi" },
      { key: "D", text: "Memerlukan alokasi bandwidth minimum sebesar 10 Gbps" },
      { key: "E", text: "Sama sekali tidak memerlukan bit paritas pemeriksaan kesalahan" },
    ],
    kunci_jawaban: "B",
    pembahasan: "Transmisi asinkronus mengirimkan data karakter demi karakter dengan start bit untuk memberi tahu kedatangan data dan stop bit sebagai penutup.",
  },
  {
    id: "sim_16",
    kategori: "Pengantar TIK",
    pertanyaan: "Format kompresi berkas gambar grafis yang mempertahankan kualitas gambar seutuhnya tanpa ada piksel yang hilang (lossless compression) adalah ....",
    opsi: [
      { key: "A", text: "JPEG / JPG" },
      { key: "B", text: "PNG (Portable Network Graphics)" },
      { key: "C", text: "MP3" },
      { key: "D", text: "MPEG-4" },
      { key: "E", text: "WebP berskala lossy" },
    ],
    kunci_jawaban: "B",
    pembahasan: "PNG menggunakan algoritma kompresi lossless Deflate, cocok untuk diagram, ilustrasi, dan gambar dengan latar transparan.",
  },
  {
    id: "sim_17",
    kategori: "Keamanan Siber",
    pertanyaan: "Dalam konsep dasar keamanan informasi, prinsip utama CIA Triad terdiri dari tiga pilar yaitu ....",
    opsi: [
      { key: "A", text: "Cipher, Integrity, Access" },
      { key: "B", text: "Confidentiality, Integrity, Availability" },
      { key: "C", text: "Control, Identity, Authentication" },
      { key: "D", text: "Cryptography, Inspection, Auditing" },
      { key: "E", text: "Certificate, Isolation, Authorization" },
    ],
    kunci_jawaban: "B",
    pembahasan: "CIA Triad adalah model standar keamanan informasi: Confidentiality (kerahasiaan), Integrity (keutuhan), dan Availability (ketersediaan).",
  },
  {
    id: "sim_18",
    kategori: "Logika dan Algoritma",
    pertanyaan: "Algoritma pengurutan (sorting) yang bekerja dengan membandingkan pasangan elemen bertetangga dan menukarnya jika urutannya keliru secara berulang disebut ....",
    opsi: [
      { key: "A", text: "Bubble Sort" },
      { key: "B", text: "Quick Sort" },
      { key: "C", text: "Merge Sort" },
      { key: "D", text: "Binary Search" },
      { key: "E", text: "Dijkstra Algorithm" },
    ],
    kunci_jawaban: "A",
    pembahasan: "Bubble Sort mengapungkan elemen terbesar ke posisi akhir seperti gelembung dengan menukar elemen yang posisinya tidak berurutan.",
  },
  {
    id: "sim_19",
    kategori: "Jaringan Komputer",
    pertanyaan: "Satuan dasar kecepatan aliran transfer data dalam kanal transmisi jaringan komputer dinyatakan dalam ....",
    opsi: [
      { key: "A", text: "Byte per second (Bps)" },
      { key: "B", text: "Bit per second (bps / Mbps)" },
      { key: "C", text: "Megahertz (MHz)" },
      { key: "D", text: "Gigabyte (GB)" },
      { key: "E", text: "Hertz (Hz)" },
    ],
    kunci_jawaban: "B",
    pembahasan: "Kecepatan transfer jaringan diukur dalam kelipatan bit per detik (bits per second / bps), berbeda dengan kapasitas penyimpanan berkas (Byte).",
  },
  {
    id: "sim_20",
    kategori: "Sistem Basis Data",
    pertanyaan: "Klausa dalam perintah SQL SELECT yang digunakan untuk memfilter baris data berdasarkan kriteria logika tertentu adalah ....",
    opsi: [
      { key: "A", text: "ORDER BY" },
      { key: "B", text: "GROUP BY" },
      { key: "C", text: "WHERE" },
      { key: "D", text: "HAVING" },
      { key: "E", text: "DISTINCT" },
    ],
    kunci_jawaban: "C",
    pembahasan: "Klausa WHERE menyaring rekaman baris sebelum proses pengelompokan atau pengurutan dilakukan.",
  },
  {
    id: "sim_21",
    kategori: "Dasar Pemrograman",
    pertanyaan: "Manakah struktur percabangan yang digunakan di Python untuk mengevaluasi kondisi alternatif setelah blok 'if' bernilai False?",
    opsi: [
      { key: "A", text: "else if" },
      { key: "B", text: "elseif" },
      { key: "C", text: "elif" },
      { key: "D", text: "then" },
      { key: "E", text: "case" },
    ],
    kunci_jawaban: "C",
    pembahasan: "Python menggunakan kata kunci 'elif' sebagai kependekan dari else-if untuk percabangan bertingkat.",
  },
  {
    id: "sim_22",
    kategori: "Logika dan Algoritma",
    pertanyaan: "Bagan alir (flowchart) yang menunjukkan arah aliran data atau instruksi dilambangkan dengan simbol ....",
    opsi: [
      { key: "A", text: "Garis Panah (Flowline)" },
      { key: "B", text: "Persegi Panjang" },
      { key: "C", text: "Jajaran Genjang" },
      { key: "D", text: "Lingkaran Kecil" },
      { key: "E", text: "Segi Enam" },
    ],
    kunci_jawaban: "A",
    pembahasan: "Flowline (garis alir berpanah) menunjukkan urutan sekuensial pelaksanaan instruksi dalam diagram alir.",
  },
  {
    id: "sim_23",
    kategori: "Pengantar TIK",
    pertanyaan: "Satuan terkecil data dalam sistem komputasi biner yang bernilai 0 atau 1 disebut ....",
    opsi: [
      { key: "A", text: "Nibble" },
      { key: "B", text: "Byte" },
      { key: "C", text: "Bit (Binary Digit)" },
      { key: "D", text: "Word" },
      { key: "E", text: "Block" },
    ],
    kunci_jawaban: "C",
    pembahasan: "Bit (Binary Digit) adalah unit data paling elementer yang merepresentasikan dua status logika: 0 atau 1. 1 Byte setara dengan 8 bit.",
  },
  {
    id: "sim_24",
    kategori: "Sistem Basis Data",
    pertanyaan: "Sebuah atribut atau kombinasi atribut pada tabel relasional yang secara unik mengidentifikasi setiap baris rekaman disebut ....",
    opsi: [
      { key: "A", text: "Foreign Key" },
      { key: "B", text: "Primary Key" },
      { key: "C", text: "Index Key" },
      { key: "D", text: "Composite Attribute" },
      { key: "E", text: "Candidate Null" },
    ],
    kunci_jawaban: "B",
    pembahasan: "Primary Key menjamin keunikan nilai tiap baris rekaman dan tidak boleh bernilai kosong (NOT NULL).",
  },
  {
    id: "sim_25",
    kategori: "Jaringan Komputer",
    pertanyaan: "Perangkat keras jaringan yang beroperasi pada Physical Layer (Layer 1) untuk memperkuat sinyal digital agar dapat menjangkau jarak transmisi lebih jauh adalah ....",
    opsi: [
      { key: "A", text: "Router" },
      { key: "B", text: "Bridge" },
      { key: "C", text: "Repeater" },
      { key: "D", text: "Switch Layer 3" },
      { key: "E", text: "Gateway" },
    ],
    kunci_jawaban: "C",
    pembahasan: "Repeater menerima sinyal yang melemah karena atenuasi jarak dan meregenerasi sinyal tersebut dengan kekuatan semula.",
  },
];

// --------------------------------------------------------------------------
// Fungsi Generator & Evaluasi Kuis Simulasi
// --------------------------------------------------------------------------

/**
 * Fisher-Yates shuffle untuk mengacak elemen array tanpa bias.
 */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Buat paket kuis simulasi acak dengan jumlah soal yang dapat dikonfigurasi.
 */
export function generateSimulationQuiz(count = 20): SimulationQuizPackage {
  const pool = shuffleArray(MASTER_SIMULATION_QUESTIONS);
  const selected = pool.slice(0, Math.min(count, pool.length));

  const daftar_soal: SimulationQuestion[] = selected.map((q, idx) => ({
    ...q,
    no: idx + 1,
    // Acak juga opsi pilihan gandanya agar tidak monoton
    opsi: shuffleArray(q.opsi).map((opt, optIdx) => ({
      ...opt,
      key: (["A", "B", "C", "D", "E"] as OptionKey[])[optIdx],
    })),
  }));

  // Sesuaikan kunci jawaban dengan posisi opsi baru yang teracak
  const synchronizedQuestions = daftar_soal.map((soal) => {
    const originalQuestion = MASTER_SIMULATION_QUESTIONS.find((m) => m.id === soal.id);
    if (!originalQuestion) return soal;

    const originalCorrectOption = originalQuestion.opsi.find(
      (opt) => opt.key === originalQuestion.kunci_jawaban
    );
    const newCorrectKey =
      soal.opsi.find((opt) => opt.text === originalCorrectOption?.text)?.key || "A";

    return {
      ...soal,
      kunci_jawaban: newCorrectKey,
    };
  });

  return {
    id: `sim_${Date.now()}`,
    judul: "Simulasi Ujian Mandiri CBT (Tryout Akademik)",
    kategori: "Informatika & TIK Terpadu",
    durasi_menit: 45,
    total_soal: synchronizedQuestions.length,
    daftar_soal: synchronizedQuestions,
  };
}

/**
 * Evaluasi jawaban peserta dan hitung skor akhir (0 - 100).
 */
export function evaluateSimulationScore(
  answers: Record<string, string>, // Map id_soal -> key opsi terpilih (misal "sim_01" -> "C")
  questions: SimulationQuestion[]
): SimulationResult {
  let benar = 0;
  let terjawab = 0;

  const detail_jawaban = questions.map((q) => {
    const jawabanUser = answers[q.id] || null;
    const isTerjawab = Boolean(jawabanUser);
    if (isTerjawab) terjawab++;

    const isBenar = jawabanUser === q.kunci_jawaban;
    if (isBenar) benar++;

    return {
      id_soal: q.id,
      no: q.no,
      pertanyaan: q.pertanyaan,
      jawaban_user: jawabanUser,
      kunci_jawaban: q.kunci_jawaban,
      is_benar: isBenar,
      pembahasan: q.pembahasan,
    };
  });

  const total = questions.length;
  const salah = terjawab - benar;
  const belum_terjawab = total - terjawab;
  const skor = total > 0 ? Math.round((benar / total) * 100) : 0;

  return {
    total_soal: total,
    terjawab,
    belum_terjawab,
    benar,
    salah,
    skor,
    detail_jawaban,
  };
}
