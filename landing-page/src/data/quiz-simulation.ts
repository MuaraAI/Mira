// ==========================================================================
// QUIZ BY MIRA: GENERATOR & EVALUATOR SIMULASI KUIS MANDIRI
// Bank soal per mata kuliah (modul P1-P8) diacak per sesi.
// ==========================================================================

import {
  DEFAULT_QUIZ_PACKAGE_ID,
  findQuizPackage,
  type BankQuestion,
  type OptionKey,
  type SimulationQuestion,
  type SimulationQuizPackage,
  type SimulationResult,
} from "./quiz-catalog";
import { PTIK_BANK } from "./quiz-bank/ptik";
import { LOGIKA_BANK } from "./quiz-bank/logika";

const OPTION_KEYS: OptionKey[] = ["A", "B", "C", "D", "E"];

const BANK_BY_PACKAGE: Record<string, BankQuestion[]> = {
  ptik: PTIK_BANK,
  logika: LOGIKA_BANK,
};

/** Fisher-Yates shuffle untuk mengacak elemen array tanpa bias. */
function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Bangun paket kuis simulasi untuk satu mata kuliah.
 * Soal dan opsi diacak; kunci jawaban ikut disinkronkan ke posisi opsi baru.
 * `count` opsional untuk membatasi jumlah soal (default: seluruh bank).
 */
export function buildSimulationQuiz(
  packageId: string = DEFAULT_QUIZ_PACKAGE_ID,
  count?: number
): SimulationQuizPackage {
  const meta = findQuizPackage(packageId);
  const bank = BANK_BY_PACKAGE[meta.id];
  if (!bank) {
    throw new Error(`Paket kuis "${packageId}" tidak dikenal.`);
  }

  const pool = shuffleArray(bank);
  const selected = pool.slice(0, Math.min(count ?? pool.length, pool.length));

  const daftar_soal: SimulationQuestion[] = selected.map((q, idx) => {
    const paired = q.opsi.map((text, optIdx) => ({
      text,
      isCorrect: optIdx === q.kunci,
    }));
    const shuffled = shuffleArray(paired);
    const correctIdx = Math.max(
      0,
      shuffled.findIndex((opt) => opt.isCorrect)
    );

    return {
      id: q.id,
      no: idx + 1,
      kategori: q.kategori,
      pertanyaan: q.pertanyaan,
      opsi: shuffled.map((opt, optIdx) => ({
        key: OPTION_KEYS[optIdx],
        text: opt.text,
      })),
      kunci_jawaban: OPTION_KEYS[correctIdx],
      pembahasan: q.pembahasan,
    };
  });

  return {
    id: meta.id,
    judul: meta.judul,
    kategori: meta.kategori,
    durasi_menit: meta.durasi_menit,
    total_soal: daftar_soal.length,
    daftar_soal,
  };
}

/**
 * Evaluasi jawaban peserta dan hitung skor akhir (0 - 100).
 */
export function evaluateSimulationScore(
  answers: Record<string, string>, // Map id_soal -> key opsi terpilih (misal "ptik_01" -> "C")
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

    const opsiKunci = q.opsi.find((opt) => opt.key === q.kunci_jawaban);
    const opsiUser = q.opsi.find((opt) => opt.key === jawabanUser);

    return {
      id_soal: q.id,
      no: q.no,
      pertanyaan: q.pertanyaan,
      jawaban_user: jawabanUser,
      teks_jawaban_user: opsiUser?.text ?? null,
      kunci_jawaban: q.kunci_jawaban,
      teks_kunci: opsiKunci?.text ?? "",
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
