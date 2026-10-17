"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldX } from "lucide-react";
import { apiFetch, ApiError, useApi } from "@/lib/api";
import {
  ErrorState,
  LoadingState,
  PageHeader,
  ghostButtonClass,
  primaryButtonClass,
} from "@/components/dashboard-ui";

export default function SesiPage() {
  const router = useRouter();
  const { data, loading, error, reload } = useApi<{ nim: string; auth_type?: string }>(
    "/v1/auth/me"
  );
  const [busy, setBusy] = useState<"logout" | "logout_all" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) return <LoadingState label="Memuat info sesi" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;

  async function logout(path: "/v1/auth/logout" | "/v1/auth/logout_all") {
    setActionError(null);
    setBusy(path === "/v1/auth/logout" ? "logout" : "logout_all");
    try {
      await apiFetch(path, { method: "POST" });
      if (typeof window !== "undefined") {
        localStorage.removeItem("ubsi_session_token");
      }
      router.replace("/login");
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Gagal mengakhiri session. Coba lagi."
      );
      setBusy(null);
    }
  }

  function handleLogoutAll() {
    // Konfirmasi native: logout semua perangkat tidak bisa dibatalkan.
    if (window.confirm("Akhirkan SEMUA session aktif di semua perangkat?")) {
      logout("/v1/auth/logout_all");
    }
  }

  return (
    <div>
      <PageHeader
        title="Sesi"
        description="Informasi session aktif dan kontrol logout perangkat ini atau semua perangkat."
      />

      <div className="glass-card p-6 max-w-xl">
        <dl className="space-y-3 text-sm">
          <div className="flex flex-wrap gap-1">
            <dt className="font-semibold text-foreground">NIM: </dt>
            <dd className="font-mono">{data?.nim ?? "-"}</dd>
          </div>
          <div className="flex flex-wrap gap-1">
            <dt className="font-semibold text-foreground">Tipe Session: </dt>
            <dd>{data?.auth_type === "session" ? "Session Mahasiswa" : (data?.auth_type ?? "-")}</dd>
          </div>
          <div className="flex flex-wrap gap-1">
            <dt className="font-semibold text-foreground">Masa Aktif: </dt>
            <dd>7 hari dengan perpanjangan otomatis selama akun digunakan</dd>
          </div>
        </dl>

        {actionError && (
          <p className="mt-4 rounded-sm border border-[#BE123C]/30 bg-[#F0F7FB] px-4 py-3 text-sm text-[#BE123C]" role="alert">
            {actionError}
          </p>
        )}

        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            onClick={() => logout("/v1/auth/logout")}
            disabled={busy !== null}
            className={primaryButtonClass}
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {busy === "logout" ? "Mengakhiri session" : "Logout Perangkat Ini"}
          </button>
          <button
            type="button"
            onClick={handleLogoutAll}
            disabled={busy !== null}
            className={`${ghostButtonClass} text-[#BE123C] hover:border-[#BE123C]/40`}
          >
            <ShieldX className="h-4 w-4" aria-hidden="true" />
            {busy === "logout_all" ? "Mengakhiri semua session" : "Logout Semua Perangkat"}
          </button>
        </div>

        <p className="mt-4 text-xs text-secondary leading-relaxed">
          Logout semua perangkat mengakhiri setiap session yang pernah diterbitkan untuk NIM ini,
          termasuk session di perangkat lain.
        </p>
      </div>
    </div>
  );
}
