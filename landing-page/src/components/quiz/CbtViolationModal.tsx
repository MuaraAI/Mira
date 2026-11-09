"use client";

import { AlertTriangle, ShieldAlert } from "lucide-react";
import { FocusDialog } from "@/components/FocusDialog";

export interface CbtViolationModalProps {
  open: boolean;
  reason: string;
  strikeCount: number;
  onReturn: () => void;
}

export function CbtViolationModal({
  open,
  reason,
  strikeCount,
  onReturn,
}: CbtViolationModalProps) {
  if (!open) return null;

  return (
    <div id="violation-modal" className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm">
      <FocusDialog
        open={open}
        onClose={onReturn}
        labelledBy="violation-modal-title"
        className="violation-box w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden text-center p-6 space-y-4"
      >
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" aria-hidden="true" />
        </div>

        <div>
          <span
            id="violation-strike-badge"
            className="violation-badge inline-block px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300"
          >
            Peringatan Sesi #{strikeCount}
          </span>
          <h3
            id="violation-modal-title"
            className="text-lg font-display font-bold text-slate-900 mt-2"
          >
            Fokus Ujian Terganggu
          </h3>
          <p id="violation-reason" className="text-xs sm:text-sm text-slate-600 mt-1 leading-relaxed">
            Terdeteksi: <strong className="text-rose-600">{reason || "Keluar dari area ujian"}</strong>.
          </p>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-left text-xs text-slate-600 space-y-1.5">
          <p className="font-semibold text-slate-800 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" aria-hidden="true" />
            Tata Tertib Ujian Online:
          </p>
          <ul className="list-disc list-inside space-y-1 pl-1 text-[11px]">
            <li>Tetap berada di jendela ujian hingga seluruh soal selesai.</li>
            <li>Hindari membuka tab peramban atau aplikasi lain.</li>
            <li>Jawaban Anda tetap aman tersimpan otomatis di sistem.</li>
          </ul>
        </div>

        <button
          type="button"
          id="btn-return-fullscreen"
          onClick={onReturn}
          className="btn-start w-full py-2.5 rounded-lg bg-[#0369A1] hover:bg-[#0284C7] text-white text-xs font-bold transition-colors shadow-sm"
        >
          Kembali ke Lembar Ujian
        </button>
      </FocusDialog>
    </div>
  );
}
