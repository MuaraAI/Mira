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

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await navigator.serviceWorker.ready;
  return reg.pushManager.getSubscription();
}

export interface SubscribeResult {
  id: number;
  device_name: string;
  message: string;
}

export async function subscribeToPushNotifications(): Promise<SubscribeResult> {
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

  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  // TS 5.7: BufferSource butuh ArrayBuffer non-shared; copy dari Uint8Array ke buffer baru
  const keyBytes = urlBase64ToUint8Array(public_key);
  const keyBuffer = new ArrayBuffer(keyBytes.length);
  new Uint8Array(keyBuffer).set(keyBytes);
  const subscription =
    existing ??
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
  const ok = await subscription.unsubscribe();
  // Hapus di server berdasarkan endpoint match (device milik NIM sendiri)
  try {
    const { devices } = await apiFetch<{
      devices: Array<{ id: number; endpoint: string }>;
    }>("/v1/notifications/pwa/devices");
    const mine = devices.find((d) => d.endpoint === endpoint);
    if (mine) {
      await apiFetch(`/v1/notifications/pwa/devices/${mine.id}`, {
        method: "DELETE",
      });
    }
  } catch {
    // server cleanup best-effort
  }
  return ok;
}

export async function sendTestPush(): Promise<{ delivered: number; message: string }> {
  return apiFetch<{ delivered: number; message: string }>(
    "/v1/notifications/pwa/test",
    { method: "POST" },
  );
}
