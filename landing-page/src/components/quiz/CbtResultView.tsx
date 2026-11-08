"use client";

import { Award, CheckCircle2, XCircle, RotateCcw, ArrowLeft, BookOpen } from "lucide-react";
import type { SimulationResult } from "@/data/quiz-simulation";

export interface CbtResultViewProps {
  judul: string;
  result: SimulationResult;
  onRetry: () => void;
  onBackToDashboard: () => void;
}

export function CbtResultView({
  judul,
  result,
  onRetry,
  onBackToDashboard,
}: CbtResultViewProps) {
  const isPassed = result.skor >= 65;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header Skor */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 sm:p-8 text-center space-y-4">
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-inner ${
            isPassed ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
          }`}
        >
          <Award className="w-8 h-8" aria-hidden="true" />
        </div>

        <div>
          <span className="text-xs font-mono font-bold tracking-wider uppercase text-[#0369A1]">
            Hasil Simulasi Mandiri (Tryout)
          </span>
          <h1 className="text-xl sm:text-2xl font-display font-bold text-slate-900 mt-1">
            {judul}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {isPassed
              ? "Bagus sekali. Pemahaman materi Anda sudah memenuhi standar kelulusan kuis."
              : "Tetap semangat. Tingkatkan latihan soal dan pelajari kembali pembahasan di bawah."}
          </p>
        </div>

        {/* Lingkaran / Kartu Skor Utama */}
        <div className="inline-flex flex-col items-center justify-center px-8 py-4 rounded-xl bg-slate-50 border border-slate-200">
          <span className="text-xs font-mono uppercase text-slate-500 font-semibold">
            Skor Akhir
          </span>
          <span
            className={`text-4xl sm:text-5xl font-mono font-bold mt-1 ${
              isPassed ? "text-emerald-600" : "text-amber-600"
            }`}
          >
            {result.skor}
          </span>
          <span className="text-[11px] font-mono text-slate-400 mt-0.5">
            Skala 0 / 100
          </span>
        </div>

        {/* Ringkasan Jumlah Soal */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-lg mx-auto pt-2">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <span className="text-[10px] font-mono uppercase text-slate-500 block">Total</span>
            <span className="text-base font-mono font-bold text-slate-800">{result.total_soal}</span>
          </div>
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
            <span className="text-[10px] font-mono uppercase text-emerald-700 block">Benar</span>
            <span className="text-base font-mono font-bold text-emerald-700">{result.benar}</span>
          </div>
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
            <span className="text-[10px] font-mono uppercase text-rose-700 block">Salah</span>
            <span className="text-base font-mono font-bold text-rose-700">{result.salah}</span>
          </div>
          <div className="p-3 bg-slate-100 border border-slate-200 rounded-lg">
            <span className="text-[10px] font-mono uppercase text-slate-500 block">Kosong</span>
            <span className="text-base font-mono font-bold text-slate-600">{result.belum_terjawab}</span>
          </div>
        </div>

        {/* Tombol Aksi */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
          <button
            type="button"
            onClick={onRetry}
            className="px-5 py-2.5 rounded-lg bg-[#0369A1] hover:bg-[#0284C7] text-white text-xs font-bold flex items-center gap-2 transition-colors shadow-sm"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
            <span>Ulangi Simulasi (Soal Baru)</span>
          </button>
          <button
            type="button"
            onClick={onBackToDashboard}
            className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>Kembali ke Jadwal Kuis</span>
          </button>
        </div>
      </div>

      {/* Pembahasan Butir per Butir */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <BookOpen className="w-4 h-4 text-[#0369A1]" aria-hidden="true" />
          <h2 className="text-sm font-mono font-bold uppercase tracking-wider text-slate-800">
            Pembahasan Butir Soal ({result.detail_jawaban.length})
          </h2>
        </div>

        <div className="space-y-3.5">
          {result.detail_jawaban.map((item) => (
            <div
              key={item.id_soal}
              className={`p-5 rounded-lg border bg-white shadow-sm space-y-3 ${
                item.is_benar ? "border-emerald-200" : "border-rose-200"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-slate-100 text-slate-700">
                  Soal No. {item.no}
                </span>

                {item.is_benar ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
                    <span>Jawaban Tepat</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                    <XCircle className="w-3.5 h-3.5 text-rose-600" aria-hidden="true" />
                    <span>Jawaban Salah / Kosong</span>
                  </span>
                )}
              </div>

              <p className="text-sm font-sans font-medium text-slate-900 leading-relaxed">
                {item.pertanyaan}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                <div className="p-2.5 rounded bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-mono text-slate-700 uppercase block">
                    Pilihan Anda:
                  </span>
                  <span
                    className={`font-mono font-bold ${
                      item.is_benar ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {item.jawaban_user ? `Opsi ${item.jawaban_user}` : "(Tidak Menjawab)"}
                  </span>
                </div>
                <div className="p-2.5 rounded bg-emerald-50/70 border border-emerald-200">
                  <span className="text-[10px] font-mono text-emerald-800 uppercase block">
                    Kunci Jawaban Benar:
                  </span>
                  <span className="font-mono font-bold text-emerald-700">
                    Opsi {item.kunci_jawaban}
                  </span>
                </div>
              </div>

              {item.pembahasan && (
                <div className="p-3 rounded-lg bg-sky-50/70 border border-sky-200/80 text-xs text-sky-950 space-y-1">
                  <span className="font-mono font-bold uppercase text-[10px] text-[#0369A1] block">
                    Pembahasan Materi:
                  </span>
                  <p className="leading-relaxed">{item.pembahasan}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
