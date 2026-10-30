"use client";

import { useEffect, useState } from "react";
import { Check, Eye, EyeOff, KeyRound, Loader2, ShieldAlert, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { inputClass, primaryButtonClass } from "@/components/dashboard-ui";
import {
  PASSWORD_SYSTEM_LABEL,
  PasswordSystem,
  SecurityStatus,
  notifySecurityChanged,
  passwordChecks,
} from "@/lib/security";

const fieldClass = `${inputClass} min-h-12 pr-12 text-base sm:text-sm`;

function SecretInput({
  id,
  label,
  value,
  onChange,
  autoComplete,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  disabled?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          disabled={disabled}
          className={fieldClass}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? `Sembunyikan ${label}` : `Tampilkan ${label}`}
          aria-pressed={show}
          className="absolute inset-y-0 right-0 flex min-w-12 items-center justify-center text-secondary transition-colors hover:text-[#0369A1]"
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

/** Ganti password SIAKAD / MyBest langsung di server kampus. Sukses hanya bila login ulang dengan password baru berhasil. */
export function ChangePasswordCard({
  nim,
  status,
  onChanged,
}: {
  nim: string;
  status: SecurityStatus | null;
  onChanged?: () => void;
}) {
  const [system, setSystem] = useState<PasswordSystem>("siakad");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Default ke sistem yang masih memakai password default.
  useEffect(() => {
    if (status?.default_password.mybest && !status.default_password.siakad) setSystem("mybest");
  }, [status?.default_password.mybest, status?.default_password.siakad]);

  const checks = passwordChecks(nim, current, next);
  const confirmOk = confirm.length > 0 && confirm === next;
  const ready = current.length > 0 && checks.every((c) => c.ok) && confirmOk;
  const label = PASSWORD_SYSTEM_LABEL[system];

  function switchSystem(target: PasswordSystem) {
    setSystem(target);
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
    setSuccess(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch<{ message: string }>("/v1/auth/password", {
        json: { system, current_password: current, new_password: next },
      });
      setSuccess(res?.message ?? `Password ${label} berhasil diganti.`);
      setCurrent("");
      setNext("");
      setConfirm("");
      notifySecurityChanged();
      onChanged?.();
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("ERROR", "Gagal mengganti password. Coba lagi.", 0));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="ganti-password" className="glass-card scroll-mt-24 space-y-5 border-l-4 border-l-[#F59E0B] p-5 sm:p-6">
      <div className="flex items-center gap-2 border-b border-stroke pb-3">
        <KeyRound className="h-5 w-5 text-[#B45309]" aria-hidden="true" />
        <h2 className="font-display text-base font-bold text-foreground">Ganti Password Kampus</h2>
      </div>

      <div role="tablist" aria-label="Pilih akun" className="grid grid-cols-2 gap-2">
        {(Object.keys(PASSWORD_SYSTEM_LABEL) as PasswordSystem[]).map((key) => {
          const active = system === key;
          const isDefault = status?.default_password[key];
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchSystem(key)}
              disabled={busy}
              className={`flex min-h-11 items-center justify-center gap-2 px-3 font-mono text-xs font-bold transition-colors ${
                active
                  ? "bg-[#072033] text-white shadow-[3px_3px_0_0_#0369A1]"
                  : "bg-white text-secondary shadow-[inset_0_0_0_2px_#CFE2EE] hover:text-foreground"
              }`}
            >
              {PASSWORD_SYSTEM_LABEL[key]}
              {isDefault && (
                <span className="bg-[#F59E0B] px-1.5 py-0.5 text-[10px] uppercase text-[#451A03]">default</span>
              )}
            </button>
          );
        })}
      </div>

      {status?.default_password[system] && (
        <p className="flex items-start gap-2 bg-[#FFFBEB] p-3 text-xs leading-relaxed text-[#78350F] shadow-[inset_0_0_0_2px_#FCD34D]">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          Password {label} kamu masih default kampus. Segera ganti.
        </p>
      )}

      <form onSubmit={submit} className="space-y-4" noValidate>
        <SecretInput
          id="pw-current"
          label={`Password ${label} saat ini`}
          value={current}
          onChange={setCurrent}
          autoComplete="current-password"
          disabled={busy}
        />
        <SecretInput
          id="pw-new"
          label="Password baru"
          value={next}
          onChange={setNext}
          autoComplete="new-password"
          disabled={busy}
        />

        <ul className="grid grid-cols-1 gap-1.5 min-[420px]:grid-cols-2" aria-label="Syarat password baru">
          {checks.map((check) => (
            <li
              key={check.label}
              className={`flex items-center gap-1.5 font-mono text-[11px] ${check.ok ? "text-[#0F766E]" : "text-secondary"}`}
            >
              {check.ok ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />}
              <span>{check.label}</span>
              <span className="sr-only">{check.ok ? "terpenuhi" : "belum terpenuhi"}</span>
            </li>
          ))}
        </ul>

        <div>
          <SecretInput
            id="pw-confirm"
            label="Ulangi password baru"
            value={confirm}
            onChange={setConfirm}
            autoComplete="new-password"
            disabled={busy}
          />
          {confirm.length > 0 && !confirmOk && (
            <p className="mt-1.5 text-xs text-[#BE123C]">Belum sama dengan password baru.</p>
          )}
        </div>

        {error && (
          <div className="bg-[#FFF1F2] px-4 py-3 shadow-[inset_0_0_0_2px_#FDA4AF]" role="alert">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#BE123C]">{error.code}</p>
            <p className="mt-0.5 text-sm text-[#BE123C]">{error.message}</p>
          </div>
        )}
        {success && (
          <div className="bg-[#F0FDFA] px-4 py-3 shadow-[inset_0_0_0_2px_#5EEAD4]" role="status">
            <p className="text-sm font-semibold text-[#0F766E]">{success}</p>
          </div>
        )}

        <button type="submit" disabled={!ready || busy} className={`${primaryButtonClass} w-full disabled:opacity-60`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <KeyRound className="h-4 w-4" aria-hidden="true" />}
          {busy ? `Mengganti di ${label}...` : `Ganti password ${label}`}
        </button>
        <p className="text-xs leading-relaxed text-secondary">
          Password diganti langsung di server {label}, lalu dicek dengan login ulang. Sesi dan API Key Mira ikut diperbarui otomatis.
          Proses ini bisa makan waktu hingga 30 detik.
        </p>
      </form>
    </section>
  );
}
