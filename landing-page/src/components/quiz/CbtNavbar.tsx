"use client";

import { Clock, Maximize2, Minimize2, Check, AlertCircle, RefreshCw } from "lucide-react";

export interface CbtNavbarProps {
  judul: string;
  subjudul?: string;
  remainingSeconds: number;
  syncStatus?: "saved" | "saving" | "error" | "offline";
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onFinishClick: () => void;
}

export function CbtNavbar({
  judul,
  subjudul,
  remainingSeconds,
  syncStatus = "saved",
  isFullscreen,
  onToggleFullscreen,
  onFinishClick,
}: CbtNavbarProps) {
  const hours = String(Math.floor(remainingSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((remainingSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(remainingSeconds % 60).padStart(2, "0");

  const isLowTime = remainingSeconds <= 300 && remainingSeconds > 0; // <= 5 menit

  return (
    <header className="sticky top-0 z-40 bg-gradient-to-r from-[#0F172A] via-[#1E293B] to-[#0F172A] text-white border-b border-slate-700/60 shadow-md">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Brand & Judul Ujian */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-[#0369A1] text-white shrink-0">
              CBT ROOM
            </span>
            <h1 className="text-sm sm:text-base font-display font-bold text-white truncate">
              {judul}
            </h1>
          </div>
          {subjudul && (
            <p className="text-[11px] text-slate-300 truncate mt-0.5 font-sans">
              {subjudul}
            </p>
          )}
        </div>

        {/* Status Sinkronisasi Jawaban */}
        <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-300 bg-slate-800/80 px-2.5 py-1 rounded border border-slate-700/50">
          {syncStatus === "saving" && (
            <>
              <RefreshCw className="w-3.5 h-3.5 text-amber-400 animate-spin" aria-hidden="true" />
              <span className="text-amber-300 text-[11px]">Menyimpan jawaban...</span>
            </>
          )}
          {syncStatus === "saved" && (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              <span className="text-emerald-300 text-[11px]">Jawaban tersimpan</span>
            </>
          )}
          {syncStatus === "error" && (
            <>
              <AlertCircle className="w-3.5 h-3.5 text-rose-400" aria-hidden="true" />
              <span className="text-rose-300 text-[11px]">Gagal sinkron</span>
            </>
          )}
          {syncStatus === "offline" && (
            <span className="text-slate-400 text-[11px]">Mode Simulasi (Lokal)</span>
          )}
        </div>

        {/* Countdown Timer */}
        <div
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-md font-mono text-xs sm:text-sm font-bold tracking-wider shadow-inner transition-colors ${
            isLowTime
              ? "bg-rose-950/80 text-rose-300 border border-rose-600 animate-pulse"
              : "bg-slate-900/90 text-white border border-[#0369A1]/60"
          }`}
          aria-live="polite"
        >
          <Clock className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline text-[11px] font-sans font-medium text-slate-300">
            Sisa Waktu:
          </span>
          <span className="text-white">
            {hours} : {minutes} : {seconds}
          </span>
        </div>

        {/* Action Controls: Fullscreen & Selesai */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onToggleFullscreen}
            aria-label={isFullscreen ? "Keluar layar penuh" : "Masuk layar penuh"}
            title={isFullscreen ? "Keluar layar penuh" : "Masuk layar penuh"}
            className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors border border-slate-700"
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" aria-hidden="true" />
            ) : (
              <Maximize2 className="w-4 h-4" aria-hidden="true" />
            )}
          </button>

          <button
            type="button"
            onClick={onFinishClick}
            className="px-3 py-1.5 rounded-md bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors shadow-sm"
          >
            Selesaikan
          </button>
        </div>
      </div>
    </header>
  );
}
