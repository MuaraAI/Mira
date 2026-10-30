"use client";

import { useEffect } from "react";
import { useApi } from "@/lib/api";

export const SECURITY_PATH = "/v1/auth/security";

export interface SecurityStatus {
  date: string;
  logins_today: number;
  failed_today: number;
  last_login_at: string | null;
  last_login_ip: string | null;
  default_password: { siakad: boolean; mybest: boolean };
}

const CHANGED_EVENT = "mira:security-changed";

/** Beri tahu semua badge/banner agar langsung memuat ulang status (mis. setelah ganti password). */
export function notifySecurityChanged() {
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

/** Status keamanan akun: login hari ini (WIB) dan password default. Diperbarui tiap 60 detik. */
export function useSecurityStatus() {
  const api = useApi<SecurityStatus>(SECURITY_PATH, { ttlMs: 30_000 });
  const { reload } = api;
  useEffect(() => {
    window.addEventListener(CHANGED_EVENT, reload);
    return () => window.removeEventListener(CHANGED_EVENT, reload);
  }, [reload]);
  return api;
}

export function usesDefaultPassword(status: SecurityStatus | null | undefined) {
  return Boolean(status?.default_password.siakad || status?.default_password.mybest);
}

export const PASSWORD_SYSTEM_LABEL = { siakad: "SIAKAD", mybest: "MyBest" } as const;
export type PasswordSystem = keyof typeof PASSWORD_SYSTEM_LABEL;

/** Aturan yang sama dengan validasi backend (`validate_new_password`). */
export function passwordChecks(nim: string, current: string, next: string) {
  return [
    { ok: next.length >= 8 && next.length <= 64, label: "8 sampai 64 karakter" },
    { ok: /[A-Za-z]/.test(next) && /\d/.test(next), label: "Ada huruf dan angka" },
    { ok: next.length > 0 && next !== "Mhs-1945" && next !== "Mhs-2026", label: "Bukan password default" },
    { ok: next.length > 0 && next !== current, label: "Beda dari password lama" },
    { ok: next.length > 0 && (!nim || !next.includes(nim)) && next === next.trim(), label: "Tanpa NIM dan spasi di ujung" },
  ];
}
