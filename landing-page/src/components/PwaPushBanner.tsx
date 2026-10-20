"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getExistingSubscription,
  getNotificationPermission,
  isPushSupported,
  subscribeToPushNotifications,
} from "@/lib/pwa-push";

const DISMISS_KEY = "pwa-push-banner-dismissed-at";
const DISMISS_DAYS = 7;

export default function PwaPushBanner() {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPushSupported()) return;
    if (getNotificationPermission() !== "default") return;
    const dismissedAt = Number(window.localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - dismissedAt < DISMISS_DAYS * 86400_000) return;
    getExistingSubscription().then((sub) => {
      if (!sub) setVisible(true);
    });
  }, []);

  const dismiss = useCallback(() => {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  }, []);

  const enable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await subscribeToPushNotifications();
      setVisible(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengaktifkan notifikasi");
    } finally {
      setBusy(false);
    }
  }, []);

  if (!visible) return null;

  return (
    <section
      role="region"
      aria-label="Aktivasi notifikasi PWA"
      className="mb-6 rounded-lg border-2 border-dashed border-px-soft bg-surface px-4 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p className="text-sm font-semibold text-foreground">
          Aktifkan notifikasi di perangkat ini
        </p>
        <p className="text-xs text-secondary mt-1">
          Terima pengingat jadwal, tugas, kuis, dan nilai langsung di layar kunci HP tanpa webhook.
        </p>
        {error ? <p className="text-xs text-danger mt-1">{error}</p> : null}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="min-h-[44px] px-4 rounded-md bg-accent text-white text-sm font-semibold disabled:opacity-60"
        >
          {busy ? "Mengaktifkan..." : "Aktifkan"}
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="min-h-[44px] px-4 rounded-md border border-px-soft text-sm text-secondary"
        >
          Nanti
        </button>
      </div>
    </section>
  );
}
