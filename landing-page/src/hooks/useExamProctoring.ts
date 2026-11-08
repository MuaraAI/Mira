"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface ProctoringState {
  examStarted: boolean;
  isFullscreen: boolean;
  strikes: number;
  warningModalOpen: boolean;
  warningReason: string;
  toastMessage: string | null;
  startExam: () => Promise<void>;
  returnToExam: () => Promise<void>;
  clearToast: () => void;
}

export function useExamProctoring(enabled = true): ProctoringState {
  const [examStarted, setExamStarted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [strikes, setStrikes] = useState(0);
  const [warningModalOpen, setWarningModalOpen] = useState(false);
  const [warningReason, setWarningReason] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const wasFullscreenRef = useRef(false);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const showToast = useCallback((msg: string) => {
    clearTimeout(toastTimeoutRef.current as NodeJS.Timeout);
    setToastMessage(msg);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, 2800);
  }, []);

  const clearToast = useCallback(() => {
    setToastMessage(null);
  }, []);

  const triggerViolation = useCallback(
    (reason: string) => {
      if (!examStarted || !enabled) return;
      setStrikes((prev) => prev + 1);
      setWarningReason(reason);
      setWarningModalOpen(true);
    },
    [examStarted, enabled]
  );

  const requestFullscreenSafe = useCallback(async (): Promise<boolean> => {
    if (typeof document === "undefined") return false;
    try {
      const docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        await docEl.requestFullscreen();
        wasFullscreenRef.current = true;
        setIsFullscreen(true);
        return true;
      }
    } catch (err: unknown) {
      // Graceful fallback untuk Safari iOS / peramban yang menolak fullscreen
      console.warn("Fullscreen request not allowed or unsupported:", err);
    }
    return false;
  }, []);

  const startExam = useCallback(async () => {
    await requestFullscreenSafe();
    setExamStarted(true);
    showToast("Mode Ujian Aktif. Selamat mengerjakan!");
  }, [requestFullscreenSafe, showToast]);

  const returnToExam = useCallback(async () => {
    setWarningModalOpen(false);
    if (wasFullscreenRef.current) {
      await requestFullscreenSafe();
    }
  }, [requestFullscreenSafe]);

  useEffect(() => {
    if (!examStarted || !enabled || typeof window === "undefined") return;

    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = Boolean(document.fullscreenElement);
      setIsFullscreen(isCurrentlyFullscreen);
      if (!isCurrentlyFullscreen && wasFullscreenRef.current) {
        triggerViolation("Keluar dari Layar Penuh (Fullscreen)");
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        triggerViolation("Pindah Tab atau Aplikasi Lain (Visibility Hidden)");
      }
    };

    const handleWindowBlur = () => {
      // Hanya deteksi blur di desktop jika sebelumnya berada dalam fullscreen
      if (wasFullscreenRef.current && !document.fullscreenElement) {
        triggerViolation("Kehilangan Fokus Jendela Ujian (Window Blur)");
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      showToast("Klik kanan dinonaktifkan oleh sistem ujian!");
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Cegah tombol pintasan inspeksi / copy / print: F12, Ctrl+C, Ctrl+U, Ctrl+S, Ctrl+P
      const key = e.key.toLowerCase();
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;

      if (
        e.key === "F12" ||
        (isCtrlOrMeta && (key === "c" || key === "u" || key === "s" || key === "p")) ||
        (isCtrlOrMeta && e.shiftKey && (key === "i" || key === "j" || key === "c"))
      ) {
        e.preventDefault();
        showToast("Tombol pintasan dilarang selama sesi ujian!");
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [examStarted, enabled, triggerViolation, showToast]);

  return {
    examStarted,
    isFullscreen,
    strikes,
    warningModalOpen,
    warningReason,
    toastMessage,
    startExam,
    returnToExam,
    clearToast,
  };
}
