"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BellRing } from "lucide-react";

import {
  getExistingSubscription,
  getNotificationPermission,
  getPushBlocker,
  isIosNotInstalled,
  isPushSupported,
  subscribeToPushNotifications,
} from "@/lib/pwa-push";

const DISMISS_KEY = "pwa-push-banner-dismissed-at";
const DISMISS_DAYS = 7;

/** Ajakan aktifkan notifikasi. Di iPhone yang belum dipasang ke Layar Utama, tampil panduan pemasangan. */
export default function PwaPushBanner() {
  const [mode, setMode] = useState<"hidden" | "enable" | "install-ios">("hidden");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissedAt < DISMISS_DAYS * 86400_000) return;
    if (isIosNotInstalled()) {
      setMode("install-ios");
      return;
    }
    if (!isPushSupported() || getNotificationPermission() !== "default") return;
    getExistingSubscription().then((sub) => {
      if (!sub) setMode("enable");
    });
  }, []);

  const dismiss = useCallback(() => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setMode("hidden");
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await subscribeToPushNotifications();
      setMode("hidden");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengaktifkan notifikasi");
    } finally {
      setBusy(false);
    }
  }, []);

  if (mode === "hidden") return null;

  return (
    <section
      role="region"
      aria-label="Aktivasi notifikasi"
      className="px-card mb-6 flex flex-col gap-4 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="px-icon h-10 w-10 shrink-0">
          <BellRing className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">
            {mode === "install-ios" ? "Pasang ke Layar Utama untuk dapat notifikasi" : "Aktifkan notifikasi di perangkat ini"}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-secondary">
            {mode === "install-ios"
              ? getPushBlocker()
              : "Dapat pengingat kelas segera mulai, absen, tugas, dan nilai langsung di layar kunci HP."}
          </p>
          {error && <p className="mt-1 text-xs text-[#BE123C]">{error}</p>}
        </div>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-3 sm:flex">
        {mode === "enable" ? (
          <button type="button" onClick={enable} disabled={busy} className="px-btn min-h-11 px-4 text-xs font-bold">
            {busy ? "Mengaktifkan..." : "Aktifkan"}
          </button>
        ) : (
          <Link href="/dashboard/notifikasi" className="px-btn inline-flex min-h-11 items-center justify-center px-4 text-xs font-bold">
            Lihat Panduan
          </Link>
        )}
        <button type="button" onClick={dismiss} className="px-btn-ghost min-h-11 px-4 text-xs font-semibold">
          Nanti
        </button>
      </div>
    </section>
  );
}
