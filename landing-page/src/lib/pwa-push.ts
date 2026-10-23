"use client";

/**
 * Client helper PWA Web Push (W3C Push API + VAPID).
 * Subscribe/unsubscribe device + cek status permission & langganan.
 */
import { apiFetch } from "./api";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

function detectDeviceName(): string {
  if (typeof navigator === "undefined") return "Browser";
  const ua = navigator.userAgent;
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari"
    : "Browser";
  const os =
    /Android/.test(ua) ? "Android"
    : /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Windows/.test(ua) ? "Windows"
    : /Mac OS/.test(ua) ? "macOS"
    : /Linux/.test(ua) ? "Linux"
    : "OS";
  return `${browser} on ${os}`;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  );
}

/** iPhone/iPad hanya mengizinkan Web Push untuk situs yang dipasang ke Layar Utama. */
export function isIosNotInstalled(): boolean {
  if (typeof window === "undefined") return false;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

/** Alasan kenapa notifikasi belum bisa diaktifkan di perangkat ini (null = bisa). */
export function getPushBlocker(): string | null {
  if (typeof window === "undefined") return null;
  if (isIosNotInstalled()) {
    return "Di iPhone/iPad, buka menu Bagikan lalu pilih Tambahkan ke Layar Utama, kemudian buka Mira dari ikon itu untuk mengaktifkan notifikasi.";
  }
  if (!isPushSupported()) return "Browser ini belum mendukung notifikasi push. Coba Chrome, Edge, Firefox, atau Safari terbaru.";
  if (getNotificationPermission() === "denied") {
    return "Izin notifikasi diblokir. Buka pengaturan situs di browser (ikon gembok di address bar), izinkan Notifikasi, lalu muat ulang halaman.";
  }
  return null;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await waitForServiceWorker();
  return reg.pushManager.getSubscription();
}

/** serviceWorker.ready tanpa guard bisa menggantung selamanya bila instalasi SW gagal. */
async function waitForServiceWorker(): Promise<ServiceWorkerRegistration> {
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Service worker belum siap. Muat ulang halaman.")), 5000),
    ),
  ]);
}

export interface SubscribeResult {
  id: number;
  device_name: string;
  message: string;
}

let inflightSubscribe: Promise<SubscribeResult> | null = null;

export function subscribeToPushNotifications(): Promise<SubscribeResult> {
  // Mutex: banner + section bisa hidup bersamaan; jangan subscribe paralel dua kali.
  inflightSubscribe ??= doSubscribe().finally(() => {
    inflightSubscribe = null;
  });
  return inflightSubscribe;
}

async function doSubscribe(): Promise<SubscribeResult> {
  if (!isPushSupported()) {
    throw new Error("Browser tidak mendukung Web Push");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Izin notifikasi ditolak");
  }

  const { public_key } = await apiFetch<{ public_key: string }>(
    "/v1/notifications/pwa/vapid-key",
  );

  const reg = await waitForServiceWorker();
  const existing = await reg.pushManager.getSubscription();
  // TS 5.7: BufferSource butuh ArrayBuffer non-shared; copy dari Uint8Array ke buffer baru
  const keyBytes = urlBase64ToUint8Array(public_key);
  const keyBuffer = new ArrayBuffer(keyBytes.length);
  new Uint8Array(keyBuffer).set(keyBytes);
  // Langganan lama yang dibuat dengan kunci VAPID berbeda tidak akan pernah menerima push: buat ulang.
  let current = existing;
  if (current?.options?.applicationServerKey) {
    const old = new Uint8Array(current.options.applicationServerKey);
    const same = old.length === keyBytes.length && old.every((byte, i) => byte === keyBytes[i]);
    if (!same) {
      await current.unsubscribe();
      current = null;
    }
  }
  const subscription =
    current ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: keyBuffer,
    }));

  const raw = subscription.toJSON() as {
    endpoint?: string;
    keys?: { p256dh?: string; auth?: string };
  };
  if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) {
    throw new Error("Subscription push tidak lengkap");
  }

  return apiFetch<SubscribeResult>("/v1/notifications/pwa/subscribe", {
    method: "POST",
    json: {
      endpoint: raw.endpoint,
      keys: { p256dh: raw.keys.p256dh, auth: raw.keys.auth },
      device_name: detectDeviceName(),
    },
  });
}

export async function unsubscribeCurrentDevice(): Promise<boolean> {
  const subscription = await getExistingSubscription();
  if (!subscription) return false;
  const endpoint = subscription.endpoint;
  // Server dulu, lokal kemudian: kalau server gagal, jangan klaim sukses,
  // baris yatim akan terus dikirimi push sampai push service balas 410.
  const { devices } = await apiFetch<{
    devices: Array<{ id: number; endpoint: string }>;
  }>("/v1/notifications/pwa/devices");
  const mine = devices.find((d) => d.endpoint === endpoint);
  if (mine) {
    await apiFetch(`/v1/notifications/pwa/devices/${mine.id}`, { method: "DELETE" });
  }
  return subscription.unsubscribe();
}

export async function sendTestPush(): Promise<{ delivered: number; message: string }> {
  return apiFetch<{ delivered: number; message: string }>(
    "/v1/notifications/pwa/test",
    { method: "POST" },
  );
}
