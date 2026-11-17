// ==========================================================================
// QUIZ BY MIRA: KATALOG & TIPE PAKET KUIS MANDIRI
// Metadata kecil (tanpa bank soal) agar halaman kuis tetap ringan.
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
    teks_jawaban_user: string | null;
    kunci_jawaban: OptionKey;
    teks_kunci: string;
    is_benar: boolean;
    pembahasan: string;
  }>;
}

/** Format mentah bank soal: opsi berupa teks, kunci berupa indeks opsi benar. */
export interface BankQuestion {
  id: string;
  kategori: string;
  pertanyaan: string;
  opsi: string[];
  kunci: number;
  pembahasan: string;
}

export interface QuizPackageMeta {
  id: string;
  judul: string;
  kategori: string;
  deskripsi: string;
  total_soal: number;
  durasi_menit: number;
}

export const QUIZ_PACKAGES: QuizPackageMeta[] = [
  {
    id: "ptik",
    judul: "PTIK",
    kategori: "Pengantar Teknologi Informasi & Komunikasi",
    deskripsi:
      "Konsep dasar teknologi informasi, komponen sistem komputer, jaringan, hingga etika dan dampak sosial TIK.",
    total_soal: 50,
    durasi_menit: 60,
  },
  {
    id: "logika",
    judul: "Logika & Algoritma",
    kategori: "Logika dan Algoritma",
    deskripsi:
      "Sejarah logika, proposisi dan tabel kebenaran, inferensi, notasi algoritmik, flowchart, hingga kompleksitas dasar.",
    total_soal: 61,
    durasi_menit: 75,
  },
];

export const DEFAULT_QUIZ_PACKAGE_ID = QUIZ_PACKAGES[0].id;

export function findQuizPackage(packageId: string | null | undefined): QuizPackageMeta {
  return QUIZ_PACKAGES.find((pkg) => pkg.id === packageId) ?? QUIZ_PACKAGES[0];
}
