"use client";

import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    const navigatorWithStandalone = window.navigator as Navigator & { standalone?: boolean };
    if (window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone) {
      setInstalled(true);
    }

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  if (installed || !installEvent) return null;

  async function install() {
    await installEvent?.prompt();
    const choice = await installEvent?.userChoice;
    if (choice?.outcome === "accepted") setInstalled(true);
    setInstallEvent(null);
  }

  return (
    <button
      type="button"
      onClick={install}
      className="fixed bottom-20 right-4 z-40 min-h-11 rounded-lg bg-[#0369A1] px-4 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#075985] lg:bottom-6"
    >
      Pasang UBSI API
    </button>
  );
}
