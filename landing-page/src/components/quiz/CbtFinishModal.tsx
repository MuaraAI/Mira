"use client";

import { CheckCircle2, AlertTriangle, FileQuestion } from "lucide-react";
import { FocusDialog } from "@/components/FocusDialog";

export interface CbtFinishModalProps {
  open: boolean;
  totalSoal: number;
  answeredCount: number;
  raguCount: number;
  unansweredCount: number;
  submitting?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function CbtFinishModal({
  open,
  totalSoal,
  answeredCount,
  raguCount,
  unansweredCount,
  submitting = false,
  onCancel,
  onConfirm,
}: CbtFinishModalProps) {
  if (!open) return null;

  const hasUnanswered = unansweredCount > 0;
  const hasRagu = raguCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
      <FocusDialog
        open={open}
        onClose={onCancel}
        labelledBy="finish-modal-title"
        className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden p-6 space-y-5"
      >
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-full bg-sky-100 text-[#0369A1] flex items-center justify-center mx-auto">
            <FileQuestion className="w-6 h-6" aria-hidden="true" />
          </div>
          <h3
            id="finish-modal-title"
            className="text-lg font-display font-bold text-slate-900"
          >
            Selesaikan Sesi Ujian?
          </h3>
          <p className="text-xs text-slate-600">
            Pastikan seluruh butir pertanyaan telah Anda jawab dengan cermat sebelum mengirimkan berkas final.
          </p>
        </div>

        {/* Statistik Jawaban */}
        <div className="grid grid-cols-3 gap-2 py-3 px-3.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
          <div className="p-2">
            <span className="text-[10px] font-mono uppercase text-slate-500 block">
              Terjawab
            </span>
            <span className="text-lg font-mono font-bold text-[#0369A1]">
              {answeredCount}
            </span>
          </div>
          <div className="p-2 border-x border-slate-200">
            <span className="text-[10px] font-mono uppercase text-slate-500 block">
              Ragu-ragu
            </span>
            <span className="text-lg font-mono font-bold text-amber-600">
              {raguCount}
            </span>
          </div>
          <div className="p-2">
            <span className="text-[10px] font-mono uppercase text-slate-500 block">
              Belum Diisi
            </span>
            <span className="text-lg font-mono font-bold text-rose-600">
              {unansweredCount}
            </span>
          </div>
        </div>

        {/* Peringatan jika ada yang belum terjawab */}
        {(hasUnanswered || hasRagu) && (
          <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
            <p className="leading-relaxed">
              Masih terdapat <strong>{unansweredCount} soal belum dijawab</strong>
              {hasRagu ? ` dan ${raguCount} soal ditandai ragu-ragu` : ""}. Anda tetap dapat menyelesaikan ujian sekarang.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold disabled:opacity-50"
          >
            Periksa Kembali
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitting ? (
              <span>Mengirimkan...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                <span>Ya, Selesaikan Ujian</span>
              </>
            )}
          </button>
        </div>
      </FocusDialog>
    </div>
  );
}
