"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiFetch, clearApiCache, clearSessionToken } from "@/lib/api";
import { useDialog } from "@/components/ConfirmDialog";

type Scope = "device" | "all";

const COPY: Record<Scope, { title: string; message: string; confirmLabel: string }> = {
  device: {
    title: "Keluar dari Mira?",
    message: "Sesi di perangkat ini diakhiri. Kamu perlu login lagi pakai NIM dan password kampus untuk masuk.",
    confirmLabel: "Ya, keluar",
  },
  all: {
    title: "Keluar dari semua perangkat?",
    message: "Semua sesi aktif (HP, laptop, dan perangkat lain) langsung diakhiri. Pakai ini kalau kamu login di perangkat orang lain.",
    confirmLabel: "Keluar semua",
  },
};

/** Logout dengan dialog konfirmasi; membersihkan token dan cache supaya data tidak bocor ke login berikutnya. */
export function useLogout() {
  const router = useRouter();
  const { confirm, notify } = useDialog();
  const [busy, setBusy] = useState<Scope | null>(null);

  const logout = useCallback(
    async (scope: Scope = "device") => {
      const ok = await confirm({ ...COPY[scope], tone: "danger", cancelLabel: "Batal" });
      if (!ok) return;
      setBusy(scope);
      try {
        await apiFetch(scope === "all" ? "/v1/auth/logout_all" : "/v1/auth/logout", { method: "POST" });
        clearSessionToken();
        clearApiCache();
        router.replace("/login");
      } catch (err) {
        notify(err instanceof ApiError ? err.message : "Gagal mengakhiri sesi. Coba lagi.");
        setBusy(null);
      }
    },
    [confirm, notify, router],
  );

  return { logout, busy };
}
