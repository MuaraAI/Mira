"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck, ShieldX, KeyRound, UserCheck, School, MapPin } from "lucide-react";
import { apiFetch, ApiError, useApi, clearApiCache } from "@/lib/api";
import { DosenInfo } from "@/components/DosenInfo";
import { splitProgram } from "@/lib/profile";
import {
  ErrorState,
  LoadingState,
  PageHeader,
  ghostButtonClass,
  primaryButtonClass,
} from "@/components/dashboard-ui";

interface StudentProfile {
  nim?: string;
  nama?: string;
  program_studi?: string;
  lokasi_cabang?: string;
  kelas?: string;
  semester_aktif?: string;
  status_aktif?: string;
  dosen_pa?: string;
}

export default function SesiPage() {
  const router = useRouter();
  const meApi = useApi<{ nim: string; auth_type?: string }>("/v1/auth/me");
  const profileApi = useApi<StudentProfile>("/v1/studentv2/profile");

  const [busy, setBusy] = useState<"logout" | "logout_all" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (meApi.loading && !meApi.data) {
    return <LoadingState label="Memuat info sesi & keamanan" />;
  }
  if (meApi.error) return <ErrorState error={meApi.error} onRetry={meApi.reload} />;

  const nim = meApi.data?.nim ?? profileApi.data?.nim ?? "-";
  const studentName = profileApi.data?.nama || `Mahasiswa (${nim})`;
  const { prodi: prodiName, kampus: kampusName } = splitProgram(profileApi.data);
  const prodi = prodiName || "-";
  const kampus = kampusName || "-";
  const dosenPa = profileApi.data?.dosen_pa?.trim() || "";

  async function logout(path: "/v1/auth/logout" | "/v1/auth/logout_all") {
    setActionError(null);
    setBusy(path === "/v1/auth/logout" ? "logout" : "logout_all");
    try {
      await apiFetch(path, { method: "POST" });
      if (typeof window !== "undefined") {
        localStorage.removeItem("ubsi_session_token");
      }
      // Bersihkan semua cache RAM: data user ini tidak boleh tampil ke login berikutnya
      clearApiCache();
      router.replace("/login");
    } catch (err) {
      setActionError(
        err instanceof ApiError ? err.message : "Gagal mengakhiri session. Coba lagi."
      );
      setBusy(null);
    }
  }

  function handleLogoutAll() {
    if (window.confirm("Akhirkan SEMUA session aktif di semua perangkat?")) {
      logout("/v1/auth/logout_all");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sesi & Keamanan Akun"
        description="Info sesi login, profil, dan tombol keluar dari perangkat."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identitas Mahasiswa Card */}
        <div className="glass-card p-6 border-l-4 border-l-[#0369A1] space-y-4">
          <div className="flex items-center gap-2 border-b border-stroke pb-3">
            <School className="w-5 h-5 text-[#0369A1]" aria-hidden="true" />
            <h2 className="font-display font-bold text-base text-foreground">
              Profil Mahasiswa
            </h2>
          </div>

          <dl className="space-y-3 text-xs sm:text-sm">
            <div>
              <dt className="text-[11px] font-mono uppercase text-secondary font-bold">
                Nama Lengkap
              </dt>
              <dd className="font-bold text-foreground text-base">
                {studentName}
              </dd>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stroke/60">
              <div>
                <dt className="text-[10px] font-mono uppercase text-secondary font-bold">
                  NIM
                </dt>
                <dd className="font-mono font-semibold text-foreground">
                  {nim}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-mono uppercase text-secondary font-bold">
                  Kelas / Semester
                </dt>
                <dd className="text-foreground">
                  {profileApi.data?.kelas || "-"} (Smt {profileApi.data?.semester_aktif || "1"})
                </dd>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stroke/60">
              <div>
                <dt className="text-[10px] font-mono uppercase text-secondary font-bold">
                  Program Studi
                </dt>
                <dd className="text-foreground font-medium">
                  {prodi}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-mono uppercase text-secondary font-bold">
                  Kampus Cabang
                </dt>
                <dd className="text-foreground">
                  {kampus}
                </dd>
              </div>
            </div>

            {dosenPa && (
              <div className="pt-2 border-t border-stroke/60">
                <dt className="text-[10px] font-mono uppercase text-secondary font-bold">
                  Dosen Pembimbing Akademik (PA)
                </dt>
                <dd className="text-foreground font-medium">
                  <DosenInfo kode={dosenPa} />
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Security & Sesi Card */}
        <div className="glass-card p-6 border-l-4 border-l-[#0F766E] space-y-4">
          <div className="flex items-center gap-2 border-b border-stroke pb-3">
            <ShieldCheck className="w-5 h-5 text-[#0F766E]" aria-hidden="true" />
            <h2 className="font-display font-bold text-base text-foreground">
              Keamanan Sesi Login
            </h2>
          </div>

          <div className="p-3.5 rounded-sm bg-[#F0F7FB] border border-[#0369A1]/20 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0F766E] animate-pulse" />
              <span className="text-xs font-bold text-[#0369A1]">
                Terenkripsi AES-256-GCM di Redis RAM
              </span>
            </div>
            <p className="text-xs text-secondary leading-relaxed">
              Kredensial disimpan dalam format ciphertext authenticated anti-tamper dengan kunci 256-bit server. Tidak ada password plaintext yang disimpan di database atau disk.
            </p>
          </div>

          <dl className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-stroke/60">
              <dt className="text-secondary font-medium">Tipe Sesi:</dt>
              <dd className="font-semibold text-foreground">
                {meApi.data?.auth_type === "session" ? "Session Mahasiswa Aktif" : (meApi.data?.auth_type ?? "-")}
              </dd>
            </div>
            <div className="flex justify-between py-1 border-b border-stroke/60">
              <dt className="text-secondary font-medium">Masa Berlaku:</dt>
              <dd className="font-semibold text-foreground">
                7 Hari (Sliding TTL)
              </dd>
            </div>
            <div className="flex justify-between py-1">
              <dt className="text-secondary font-medium">Server Session:</dt>
              <dd className="font-mono text-secondary">
                Redis db2 (:6379)
              </dd>
            </div>
          </dl>

          {actionError && (
            <p className="rounded-sm border border-[#BE123C]/30 bg-[#FFF1F2] px-3.5 py-2 text-xs text-[#BE123C]" role="alert">
              {actionError}
            </p>
          )}

          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={() => logout("/v1/auth/logout")}
              disabled={busy !== null}
              className={primaryButtonClass}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>{busy === "logout" ? "Mengakhiri..." : "Logout Perangkat Ini"}</span>
            </button>

            <button
              type="button"
              onClick={handleLogoutAll}
              disabled={busy !== null}
              className={`${ghostButtonClass} text-[#BE123C] hover:border-[#BE123C]/40`}
            >
              <ShieldX className="h-4 w-4" aria-hidden="true" />
              <span>{busy === "logout_all" ? "Mengakhiri..." : "Logout Semua Sesi"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
