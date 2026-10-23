"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Tombol "Download App": memicu prompt install PWA native di Android/Chrome.
 * Di iOS, mengarahkan ke panduan "Tambahkan ke Layar Utama" (sudah ada di pwa-push.ts).
 * Di browser desktop tanpa dukungan install, fallback smooth-scroll ke #cara-pakai.
 */
export function InstallAppButton({ className }: { className?: string }) {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleClick = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      await installPrompt.userChoice.catch(() => undefined);
      setInstallPrompt(null);
      return;
    }
    // iOS / desktop tanpa prompt: pandu user ke langkah pemasangan manual
    document.getElementById("cara-pakai")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <button type="button" onClick={handleClick} className={className}>
      Pasang Aplikasi (PWA)
    </button>
  );
}
