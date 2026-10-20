"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Smartphone, Trash2, Send, RefreshCw } from "lucide-react";

import { apiFetch, ApiError, clearApiCache } from "@/lib/api";
import { EmptyState, primaryButtonClass, ghostButtonClass } from "@/components/dashboard-ui";
import {
  getExistingSubscription,
  getNotificationPermission,
  isPushSupported,
  sendTestPush,
  subscribeToPushNotifications,
  unsubscribeCurrentDevice,
} from "@/lib/pwa-push";

interface PushDevice {
  id: number;
  device_name: string;
  endpoint: string;
  is_active: boolean;
  created_at: string;
}

export default function PwaPushDeviceSection() {
  const [devices, setDevices] = useState<PushDevice[]>([]);
  const [supported, setSupported] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [hasLocalSub, setHasLocalSub] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setSupported(isPushSupported());
    setPermission(getNotificationPermission());
    setHasLocalSub((await getExistingSubscription()) !== null);
    try {
      const res = await apiFetch<{ devices: PushDevice[] }>("/v1/notifications/pwa/devices");
      setDevices(res.devices);
    } catch {
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleEnable() {
    setBusy(true);
    setStatus(null);
    try {
      await subscribeToPushNotifications();
      setStatus({ ok: true, message: "Perangkat ini berhasil terdaftar. Coba kirim uji coba." });
    } catch (err) {
      setStatus({
        ok: false,
        message: err instanceof Error ? err.message : "Gagal mengaktifkan notifikasi.",
      });
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function handleDisable() {
    setBusy(true);
    setStatus(null);
    try {
      await unsubscribeCurrentDevice();
      setStatus({ ok: true, message: "Perangkat ini berhenti menerima notifikasi." });
    } catch {
      setStatus({ ok: false, message: "Gagal menonaktifkan perangkat." });
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function handleTest() {
    setBusy(true);
    setStatus(null);
    try {
      const res = await sendTestPush();
      setStatus({ ok: true, message: res.message });
    } catch (err) {
      setStatus({
        ok: false,
        message: err instanceof ApiError ? err.message : "Gagal mengirim notifikasi uji coba.",
      });
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function handleDelete(id: number) {
    setBusy(true);
    setStatus(null);
    try {
      await apiFetch(`/v1/notifications/pwa/devices/${id}`, { method: "DELETE" });
      clearApiCache("/v1/notifications/pwa/devices");
      setStatus({ ok: true, message: "Perangkat dihapus." });
    } catch {
      setStatus({ ok: false, message: "Gagal menghapus perangkat." });
    } finally {
      setBusy(false);
      refresh();
    }
  }

  const statusLabel =
    !supported
      ? "Browser tidak mendukung Web Push"
      : hasLocalSub
        ? "Perangkat ini: Terdaftar (aktif)"
        : permission === "denied"
          ? "Perangkat ini: Izin diblokir (aktifkan via pengaturan browser)"
          : "Perangkat ini: Belum aktif";

  return (
    <section aria-labelledby="pwa-push-heading" className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BellRing className="h-5 w-5 text-[#0369A1]" aria-hidden="true" />
        <h2 id="pwa-push-heading" className="text-base font-semibold text-foreground">
          Notifikasi Langsung (PWA Push)
        </h2>
      </div>
      <p className="text-xs text-secondary">
        Tanpa webhook: notifikasi masuk langsung ke layar kunci HP via PWA ter-install. Kategori
        berlaku untuk semua perangkat akun Anda.
      </p>
      <p className="text-xs font-mono text-secondary">{statusLabel}</p>

      {status ? (
        <p
          role="status"
          className={`text-xs ${status.ok ? "text-[#0369A1]" : "text-red-700"}`}
        >
          {status.message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {supported && !hasLocalSub && permission !== "denied" ? (
          <button
            type="button"
            onClick={handleEnable}
            disabled={busy}
            className={`${primaryButtonClass} text-xs py-2 px-3.5 min-h-[44px]`}
          >
            <Smartphone className="h-4 w-4" aria-hidden="true" />
            Aktifkan di Perangkat Ini
          </button>
        ) : null}
        {supported && hasLocalSub ? (
          <button
            type="button"
            onClick={handleDisable}
            disabled={busy}
            className={`${ghostButtonClass} text-xs py-2 px-3.5 min-h-[44px]`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Cabut Perangkat Ini
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleTest}
          disabled={busy || devices.length === 0}
          className={`${ghostButtonClass} text-xs py-2 px-3.5 min-h-[44px] disabled:opacity-50`}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Kirim Uji Coba
        </button>
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className={`${ghostButtonClass} text-xs py-2 px-3.5 min-h-[44px]`}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Segarkan
        </button>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">
          Perangkat Terhubung ({devices.length})
        </h3>
        {loading ? (
          <p className="text-xs text-secondary">Memuat daftar perangkat...</p>
        ) : devices.length === 0 ? (
          <EmptyState
            title="Belum ada perangkat terdaftar."
            description="Aktifkan notifikasi di HP atau laptop untuk mulai menerima pengingat akademik."
          />
        ) : (
          <ul className="divide-y divide-[#D9E5ED] rounded-lg border border-[#D9E5ED]">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-foreground truncate">{d.device_name}</p>
                  <p className="text-[11px] font-mono text-secondary truncate">
                    Daftar: {new Date(d.created_at).toLocaleString("id-ID")}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(d.id)}
                  disabled={busy}
                  aria-label={`Hapus perangkat ${d.device_name}`}
                  className="min-h-[44px] min-w-[44px] grid place-items-center text-red-700 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
