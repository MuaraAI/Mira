"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { KeyRound, LogIn, ShieldAlert, X } from "lucide-react";
import { PASSWORD_SYSTEM_LABEL, useSecurityStatus, usesDefaultPassword } from "@/lib/security";

/** Jumlah login sukses hari ini untuk akun ini. Merah bila ada login gagal (indikasi orang lain mencoba). */
export function LoginTodayBadge({ compact = false }: { compact?: boolean }) {
  const { data } = useSecurityStatus();
  const logins = data?.logins_today ?? null;
  const failed = data?.failed_today ?? 0;
  const alert = failed > 0;
  const label =
    logins === null
      ? "Memuat jumlah login hari ini"
      : `${logins} kali login hari ini${alert ? `, ${failed} kali gagal` : ""}. Buka Sesi & Keamanan`;

  return (
    <Link
      href="/dashboard/sesi"
      aria-label={label}
      title={label}
      className={`px-chip flex shrink-0 items-center gap-1.5 font-mono text-[11px] font-semibold transition-colors ${
        compact ? "min-h-[44px] px-2.5" : "px-2.5 py-1"
      } ${alert ? "bg-[#FFF1F2] text-[#BE123C] hover:bg-[#FFE4E6]" : "bg-[#F0F7FB] text-[#0369A1] hover:bg-px-highlight"}`}
    >
      {alert ? <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> : <LogIn className="h-3.5 w-3.5" aria-hidden="true" />}
      <span className="tabular-nums" aria-hidden="true">{logins ?? "–"}x</span>
      <span className={compact && alert ? "hidden min-[400px]:inline" : ""} aria-hidden="true">
        {compact ? "login" : "login hari ini"}
      </span>
      {alert && <span className="tabular-nums" aria-hidden="true">· {failed} gagal</span>}
    </Link>
  );
}

const DISMISS_KEY = "mira_default_pw_reminder_dismissed";

/** Pengingat wajib ganti password default kampus (Mhs-1945 / Mhs-2026). Muncul lagi di sesi berikutnya. */
export function DefaultPasswordBanner() {
  const { data } = useSecurityStatus();
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!data || !usesDefaultPassword(data) || dismissed) return null;

  const systems = (Object.keys(PASSWORD_SYSTEM_LABEL) as (keyof typeof PASSWORD_SYSTEM_LABEL)[])
    .filter((key) => data.default_password[key])
    .map((key) => PASSWORD_SYSTEM_LABEL[key]);

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {}
    setDismissed(true);
  };

  return (
    <section
      role="alert"
      aria-label="Pengingat ganti password default"
      className="px-card relative mb-6 flex flex-col gap-4 bg-[#FFFBEB] p-4 pr-12 [--px-drop:#F59E0B] [--px-line:#F59E0B] sm:flex-row sm:items-center sm:justify-between sm:pr-14"
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#F59E0B] text-[#451A03]">
          <ShieldAlert className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#451A03]">Password {systems.join(" dan ")} masih default</p>
          <p className="mt-1 text-xs leading-relaxed text-[#78350F]">
            Password bawaan kampus diketahui banyak orang. Ganti sekarang supaya akunmu tidak bisa dipakai orang lain.
          </p>
        </div>
      </div>
      <Link
        href="/dashboard/sesi#ganti-password"
        className="px-btn inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 py-2 text-sm font-bold"
      >
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        Ganti password
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Tutup pengingat untuk sesi ini"
        className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center text-[#78350F] transition-colors hover:bg-[#FEF3C7]"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </section>
  );
}
