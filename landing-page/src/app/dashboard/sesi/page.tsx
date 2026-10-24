"use client";

import { LogOut, ShieldCheck, ShieldX, KeyRound, UserCheck, School, MapPin } from "lucide-react";
import { useApi } from "@/lib/api";
import { useLogout } from "@/lib/logout";
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
  const meApi = useApi<{ nim: string; auth_type?: string }>("/v1/auth/me");
  const profileApi = useApi<StudentProfile>("/v1/studentv2/profile");

  const { logout, busy } = useLogout();

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

        {/* Keluar: detail teknis penyimpanan sesi sengaja tidak ditampilkan. */}
        <div className="glass-card p-6 border-l-4 border-l-[#0F766E] space-y-4">
          <div className="flex items-center gap-2 border-b border-stroke pb-3">
            <ShieldCheck className="w-5 h-5 text-[#0F766E]" aria-hidden="true" />
            <h2 className="font-display font-bold text-base text-foreground">
              Keluar dari Mira
            </h2>
          </div>

          <p className="text-sm leading-relaxed text-secondary">
            Sesi login aktif sampai 7 hari dan diperpanjang otomatis selama kamu pakai. Pernah login di HP atau laptop orang lain?
            Pilih <span className="font-semibold text-foreground">Logout Semua Sesi</span> supaya semua perangkat langsung keluar.
          </p>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={() => logout("device")}
              disabled={busy !== null}
              className={primaryButtonClass}
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span>{busy === "device" ? "Mengakhiri..." : "Logout Perangkat Ini"}</span>
            </button>

            <button
              type="button"
              onClick={() => logout("all")}
              disabled={busy !== null}
              className={`${ghostButtonClass} text-[#BE123C] hover:border-[#BE123C]/40`}
            >
              <ShieldX className="h-4 w-4" aria-hidden="true" />
              <span>{busy === "all" ? "Mengakhiri..." : "Logout Semua Sesi"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
