"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Check, Info, RefreshCw, Send, Smartphone, Trash2 } from "lucide-react";

import { apiFetch, ApiError } from "@/lib/api";
import { EmptyState, ghostButtonClass, primaryButtonClass } from "@/components/dashboard-ui";
import {
  getExistingSubscription,
  getNotificationPermission,
  getPushBlocker,
  isPushSupported,
  matchesPushEndpoint,
  sendTestPush,
  subscribeToPushNotifications,
  unsubscribeCurrentDevice,
} from "@/lib/pwa-push";
import { NOTIFICATION_CATEGORIES } from "@/lib/notification-categories";
import { useDialog } from "@/components/ConfirmDialog";

interface PushDevice {
  id: number;
  device_name: string;
  endpoint: string;
  is_active: boolean;
  created_at: string;
}

export default function PwaPushDeviceSection() {
  const { confirm } = useDialog();
  const [devices, setDevices] = useState<PushDevice[]>([]);
  const [categories, setCategories] = useState<string[] | null>(null);
  const [blocker, setBlocker] = useState<string | null>(null);
  const [hasLocalSub, setHasLocalSub] = useState(false);
  const [localEndpoint, setLocalEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [savingCategory, setSavingCategory] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setBlocker(getPushBlocker());
    try {
      const sub = isPushSupported() ? await getExistingSubscription() : null;
      setHasLocalSub(sub !== null);
      setLocalEndpoint(sub?.endpoint ?? null);
    } catch (err) {
      setHasLocalSub(false);
      setLocalEndpoint(null);
      setBlocker(err instanceof Error && err.message ? err.message : "Notifikasi belum bisa disiapkan di perangkat ini.");
    }
    // Dua permintaan jalan bersamaan; apiFetch sudah mencoba ulang sendiri bila jaringan putus sesaat.
    const [devicesResult, categoriesResult] = await Promise.allSettled([
      apiFetch<{ devices: PushDevice[] }>("/v1/notifications/pwa/devices"),
      apiFetch<{ categories: string[] }>("/v1/notifications/pwa/categories"),
    ]);
    if (devicesResult.status === "fulfilled") {
      setDevices(devicesResult.value.devices);
      setLoadError(null);
    } else {
      // Jangan kosongkan daftar lama: pengguna tetap bisa mencabut perangkat saat API sedang bermasalah.
      const err = devicesResult.reason;
      setLoadError(err instanceof ApiError && err.message ? err.message : "Daftar perangkat belum bisa dimuat.");
    }
    setCategories(categoriesResult.status === "fulfilled" ? categoriesResult.value.categories : null);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    // Koneksi kembali (mis. sinyal HP pulih): muat ulang otomatis supaya pesan galat hilang sendiri.
    const onOnline = () => void refresh();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [refresh]);

  async function run(action: () => Promise<string>, failure: string) {
    setBusy(true);
    setStatus(null);
    try {
      setStatus({ ok: true, message: await action() });
    } catch (err) {
      setStatus({ ok: false, message: err instanceof Error && err.message ? err.message : failure });
    } finally {
      setBusy(false);
      refresh();
    }
  }

  const handleEnable = () =>
    run(async () => {
      await subscribeToPushNotifications();
      return "Perangkat ini terdaftar. Tekan Kirim Uji Coba untuk memastikan notifikasinya masuk.";
    }, "Gagal mengaktifkan notifikasi.");

  const handleDisable = () =>
    run(async () => {
      await unsubscribeCurrentDevice();
      return "Perangkat ini berhenti menerima notifikasi.";
    }, "Gagal menonaktifkan perangkat.");

  const handleTest = () =>
    run(async () => (await sendTestPush()).message, "Gagal mengirim notifikasi uji coba.");

  const handleDelete = async (id: number) => {
    const target = devices.find((d) => d.id === id);
    const ok = await confirm({
      title: `Hapus perangkat ${target?.device_name ?? "ini"}?`,
      message: "Perangkat tersebut berhenti menerima notifikasi dari Mira.",
      confirmLabel: "Hapus perangkat",
      tone: "danger",
    });
    if (!ok) return;
    return run(async () => {
      if (target && localEndpoint && matchesPushEndpoint(target.endpoint, localEndpoint)) {
        // Device yang sedang dipakai: cabut subscription lokal JUGA, bukan cuma baris server.
        // Kalau cuma DELETE, browser tetap punya subscription dan tombol Aktifkan malah hilang.
        await unsubscribeCurrentDevice();
        return "Perangkat ini berhenti menerima notifikasi dan dihapus.";
      }
      await apiFetch(`/v1/notifications/pwa/devices/${id}`, { method: "DELETE" });
      return "Perangkat dihapus.";
    }, "Gagal menghapus perangkat.");
  };

  async function toggleCategory(id: string) {
    if (!categories) return;
    const next = categories.includes(id) ? categories.filter((c) => c !== id) : [...categories, id];
    if (next.length === 0) {
      setStatus({ ok: false, message: "Minimal satu kategori harus aktif. Untuk berhenti total, cabut perangkatnya." });
      return;
    }
    setSavingCategory(id);
    setStatus(null);
    const previous = categories;
    setCategories(next);
    try {
      const res = await apiFetch<{ categories: string[] }>("/v1/notifications/pwa/categories", {
        method: "PUT",
        json: { categories: next },
      });
      setCategories(res.categories);
    } catch (err) {
      setCategories(previous);
      setStatus({ ok: false, message: err instanceof ApiError ? err.message : "Gagal menyimpan kategori." });
    } finally {
      setSavingCategory(null);
    }
  }

  const supported = isPushSupported();
  // Server dan browser harus sinkron dua-duanya: subscription lokal tanpa baris server
  // berarti backend kehilangan barisnya (dihapus dari device lain / kuota penuh).
  const serverSynced = hasLocalSub && !!localEndpoint && devices.some((d) => matchesPushEndpoint(d.endpoint, localEndpoint));
  const statusLabel = hasLocalSub
    ? serverSynced
      ? "Perangkat ini aktif menerima notifikasi"
      : "Perangkat ini perlu didaftarkan ulang"
    : blocker
    ? "Perangkat ini belum bisa menerima notifikasi"
    : "Perangkat ini belum diaktifkan";

  return (
    <section aria-labelledby="pwa-push-heading" className="glass-card space-y-5 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="px-icon h-10 w-10 shrink-0">
          <BellRing className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 id="pwa-push-heading" className="text-base font-bold text-foreground">
            Notifikasi di HP dan Laptop
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-secondary">
            Pengingat kelas, absen, tugas, dan nilai masuk langsung ke layar kunci. Aktifkan di tiap perangkat yang kamu pakai.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 font-mono text-xs">
        <span className={`h-2 w-2 shrink-0 ${hasLocalSub && serverSynced ? "bg-[#0F766E]" : blocker ? "bg-[#BE123C]" : "bg-secondary/50"}`} aria-hidden="true" />
        <span className={hasLocalSub && serverSynced ? "font-semibold text-[#0F766E]" : "text-secondary"}>{statusLabel}</span>
      </div>

      {loadError && (
        <div className="flex flex-col gap-3 bg-[#FFF1F2] p-3 text-xs text-[#BE123C] sm:flex-row sm:items-center sm:justify-between" role="alert">
          <span className="min-w-0 break-words">{loadError}</span>
          <button type="button" onClick={refresh} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 bg-white px-3 font-bold text-[#BE123C] shadow-[0_-2px_0_0_#FDA4AF,0_2px_0_0_#FDA4AF,-2px_0_0_0_#FDA4AF,2px_0_0_0_#FDA4AF]">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Coba lagi
          </button>
        </div>
      )}

      {blocker && (
        <div className="flex items-start gap-2.5 bg-[#FFF7ED] p-3 text-xs leading-relaxed text-[#9A3412] shadow-[0_-2px_0_0_#FDBA74,0_2px_0_0_#FDBA74,-2px_0_0_0_#FDBA74,2px_0_0_0_#FDBA74]" role="note">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{blocker}</p>
        </div>
      )}

      {status && (
        <p
          role="status"
          className={`p-3 text-xs ${status.ok ? "bg-[#F0FDF4] text-[#0F766E]" : "bg-[#FFF1F2] text-[#BE123C]"}`}
        >
          {status.message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2 sm:flex sm:flex-wrap">
        {supported && !serverSynced && !blocker && (
          <button type="button" onClick={handleEnable} disabled={busy} className={`${primaryButtonClass} min-h-11 text-xs min-[430px]:col-span-2 sm:col-span-1`}>
            <Smartphone className="h-4 w-4" aria-hidden="true" />
            {hasLocalSub ? "Daftarkan Ulang Perangkat" : "Aktifkan di Perangkat Ini"}
          </button>
        )}
        {supported && hasLocalSub && (
          <button type="button" onClick={handleDisable} disabled={busy} className={`${ghostButtonClass} min-h-11 text-xs`}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Cabut perangkat ini
          </button>
        )}
        <button type="button" onClick={handleTest} disabled={busy || devices.length === 0} className={`${ghostButtonClass} min-h-11 text-xs`}>
          <Send className="h-4 w-4" aria-hidden="true" />
          Kirim uji coba
        </button>
        <button type="button" onClick={refresh} disabled={busy} className={`${ghostButtonClass} min-h-11 text-xs`}>
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Segarkan
        </button>
      </div>

      {categories && (
        <div className="space-y-3 border-t-2 border-dashed border-px-soft pt-4">
          <h3 className="text-sm font-bold text-foreground">Yang ingin kamu terima</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {NOTIFICATION_CATEGORIES.map((cat) => {
              const on = categories.includes(cat.id);
              return (
                <li key={cat.id}>
                  <label
                    className={`flex min-h-14 cursor-pointer items-start gap-3 p-3 transition-colors ${
                      on ? "bg-px-highlight shadow-[inset_3px_0_0_#0369A1]" : "bg-white shadow-[0_-2px_0_0_#D9E5ED,0_2px_0_0_#D9E5ED,-2px_0_0_0_#D9E5ED,2px_0_0_0_#D9E5ED] hover:bg-[#F0F7FB]"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={savingCategory !== null}
                      onChange={() => toggleCategory(cat.id)}
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#0369A1]"
                    />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                        {cat.label}
                        {savingCategory === cat.id && <Check className="h-3.5 w-3.5 animate-pulse text-[#0369A1]" aria-hidden="true" />}
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-snug text-secondary">{cat.desc}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <div className="space-y-2 border-t-2 border-dashed border-px-soft pt-4">
        <h3 className="text-sm font-bold text-foreground">Perangkat terhubung ({devices.length})</h3>
        {loading ? (
          <p className="font-mono text-xs text-secondary">Memuat daftar perangkat...</p>
        ) : devices.length === 0 ? (
          <EmptyState
            title="Belum ada perangkat terdaftar."
            description="Aktifkan notifikasi di HP atau laptop untuk mulai menerima pengingat akademik."
          />
        ) : (
          <ul className="divide-y-2 divide-dashed divide-px-soft bg-white shadow-[0_-2px_0_0_#D9E5ED,0_2px_0_0_#D9E5ED,-2px_0_0_0_#D9E5ED,2px_0_0_0_#D9E5ED]">
            {devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{d.device_name}</p>
                  <p className="truncate font-mono text-[11px] text-secondary">Daftar: {new Date(d.created_at).toLocaleString("id-ID")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(d.id)}
                  disabled={busy}
                  aria-label={`Hapus perangkat ${d.device_name}`}
                  className="grid min-h-11 min-w-11 shrink-0 place-items-center text-[#BE123C] disabled:opacity-50"
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
