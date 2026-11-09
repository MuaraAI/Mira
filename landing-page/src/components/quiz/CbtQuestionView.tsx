"use client";

import { ChevronLeft, ChevronRight, HelpCircle, CheckCircle2 } from "lucide-react";
import type { OptionKey } from "@/data/quiz-simulation";

export interface QuestionViewData {
  id: string;
  no: number;
  pertanyaan: string;
  kategori?: string;
  opsi: Array<{ key: string; text: string }>;
}

export interface CbtQuestionViewProps {
  soal: QuestionViewData;
  totalSoal: number;
  selectedAnswer: string | null;
  isRagu: boolean;
  onSelectOption: (optionKey: string) => void;
  onToggleRagu: () => void;
  onPrev: () => void;
  onNext: () => void;
  onFinish: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function CbtQuestionView({
  soal,
  totalSoal,
  selectedAnswer,
  isRagu,
  onSelectOption,
  onToggleRagu,
  onPrev,
  onNext,
  onFinish,
  isFirst,
  isLast,
}: CbtQuestionViewProps) {
  return (
    <article id="wrap-soal" className="bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden">
      {/* Hidden metadata markers identik MyBest CBT standard */}
      <div id="maxsoal" data-max={totalSoal} style={{ display: "none" }} />
      <div id="nomerurut" data-id={soal.id} style={{ display: "none" }} />

      {/* Header Soal */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-[#0369A1] text-white">
            Soal No. {soal.no}
          </span>
          {soal.kategori && (
            <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[11px] font-sans font-medium bg-slate-200/80 text-slate-700">
              {soal.kategori}
            </span>
          )}
        </div>
        <span className="text-xs font-mono text-slate-700">
          Dari {totalSoal} Soal
        </span>
      </div>

      {/* Teks Pertanyaan */}
      <div className="soal p-5 sm:p-6 space-y-6 flex-1" id="soal-text-container">
        <p id="soal-text" className="text-sm sm:text-base text-slate-900 leading-relaxed font-sans font-medium whitespace-pre-wrap select-none">
          {soal.pertanyaan}
        </p>

        {/* Daftar Pilihan Ganda (A..E) */}
        <div className="pilihan space-y-2.5 pt-2 select-none" id="pilihan-container" role="radiogroup" aria-label="Pilihan Jawaban">
          {soal.opsi.map((opt) => {
            const isSelected = selectedAnswer === opt.key;

            return (
              <button
                key={opt.key}
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-id={soal.id}
                data-jawab={`${soal.id}_${opt.key}`}
                onClick={() => onSelectOption(opt.key)}
                className={`jawab ${isSelected ? "dijawab" : ""} w-full text-left p-3.5 sm:p-4 rounded-lg border transition-all flex items-start gap-3.5 min-h-[50px] ${
                  isSelected
                    ? "bg-[#F0F7FB] border-[#0369A1] shadow-sm text-slate-950 font-medium"
                    : "bg-white border-slate-200 hover:bg-slate-50 text-slate-800"
                }`}
              >
                {/* Badge Huruf Opsi */}
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 mt-0.5 transition-colors ${
                    isSelected
                      ? "bg-[#0369A1] text-white"
                      : "bg-slate-100 text-slate-700 border border-slate-300"
                  }`}
                >
                  {opt.key}
                </span>

                {/* Teks Opsi */}
                <span className="pilihan text-xs sm:text-sm leading-relaxed font-sans flex-1">
                  <p><strong>{opt.key}.</strong> {opt.text}</p>
                </span>

                {/* Indikator Terpilih */}
                {isSelected && (
                  <CheckCircle2
                    className="w-4 h-4 text-[#0369A1] shrink-0 mt-1"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Navigasi Bawah */}
      <footer className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5">
        <button
          type="button"
          onClick={onPrev}
          disabled={isFirst}
          className="px-4 py-2 rounded-md border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" aria-hidden="true" />
          <span>Sebelumnya</span>
        </button>

        <button
          type="button"
          onClick={onToggleRagu}
          className={`px-4 py-2 rounded-md border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            isRagu
              ? "bg-amber-400 text-slate-950 border-amber-500 font-bold"
              : "bg-white text-slate-800 border-slate-300 hover:bg-amber-50"
          }`}
        >
          <HelpCircle className="w-4 h-4 text-amber-600" aria-hidden="true" />
          <span>{isRagu ? "Tanda Ragu-ragu Aktif" : "Ragu-ragu"}</span>
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={onFinish}
            className="px-5 py-2 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5"
          >
            <span>Selesaikan Ujian</span>
            <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onNext}
            className="px-4 py-2 rounded-md bg-[#0369A1] hover:bg-[#0284C7] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
          >
            <span>Selanjutnya</span>
            <ChevronRight className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </footer>
    </article>
  );
}
