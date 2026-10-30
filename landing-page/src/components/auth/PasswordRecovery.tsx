"use client";

import { useRef, useState } from "react";
import { ArrowLeft, LogIn, MailCheck, RotateCcw, Send } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { inputClass, primaryButtonClass } from "@/components/dashboard-ui";
import { PASSWORD_SYSTEM_LABEL, PasswordSystem } from "@/lib/security";

const fieldClass = `${inputClass} min-h-12 text-base sm:text-sm`;
const RESET_TTL_MINUTES = 60;

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 2)}***@${domain}`;
}

/** Getar visual pada input yang salah (diulang tiap error) + getar perangkat di HP. */
function useFieldErrors() {
  const [fields, setFields] = useState<string[]>([]);
  const refs = useRef<Record<string, HTMLElement | null>>({});

  const flag = (names: string[]) => {
    setFields(names);
    window.requestAnimationFrame(() => {
      names.forEach((name) => {
        const el = refs.current[name];
        if (!el) return;
        el.classList.remove("field-shake");
        void el.offsetWidth;
        el.classList.add("field-shake");
      });
      if (names.length) refs.current[names[0]]?.querySelector("input")?.focus();
    });
    if (names.length) navigator.vibrate?.([60, 40, 60]);
  };

  const bind = (name: string) => (el: HTMLElement | null) => {
    refs.current[name] = el;
  };
  const hasError = (name: string) => fields.includes(name);
  const clear = (name: string) => setFields((prev) => prev.filter((f) => f !== name));

  return { flag, bind, hasError, clear };
}

function SystemToggle({ value, onChange, disabled }: { value: PasswordSystem; onChange: (v: PasswordSystem) => void; disabled?: boolean }) {
  return (
    <div role="radiogroup" aria-label="Akun yang direset" className="grid grid-cols-2 gap-2">
      {(["mybest", "siakad"] as PasswordSystem[]).map((key) => {
        const active = value === key;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(key)}
            className={`flex min-h-11 items-center justify-center font-mono text-xs font-bold transition-colors ${
              active
                ? "bg-[#072033] text-white shadow-[3px_3px_0_0_#0369A1]"
                : "bg-white text-secondary shadow-[inset_0_0_0_2px_#CFE2EE] hover:text-foreground"
            }`}
          >
            {PASSWORD_SYSTEM_LABEL[key]}
          </button>
        );
      })}
    </div>
  );
}

function ErrorNote({ error }: { error: ApiError | null }) {
  if (!error) return null;
  return (
    <p role="alert" className="bg-[#FFF1F2] px-3 py-2.5 text-sm leading-snug text-[#BE123C] shadow-[inset_0_0_0_2px_#FDA4AF]">
      {error.message}
    </p>
  );
}

function BackToLogin({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex min-h-11 items-center gap-2 font-mono text-xs font-semibold text-secondary transition-colors hover:text-[#0369A1]"
    >
      <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" aria-hidden="true" />
      Kembali ke login
    </button>
  );
}

interface SentInfo {
  system: PasswordSystem;
  email: string;
}

/** Langkah 1: NIM + email. Kampus mengirim link reset ke email terdaftar. */
export function ForgotPasswordView({ initialNim, onBack }: { initialNim?: string; onBack: () => void }) {
  const [system, setSystem] = useState<PasswordSystem>("mybest");
  const [nim, setNim] = useState(initialNim ?? "");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState<SentInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const { flag, bind, hasError, clear } = useFieldErrors();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const missing = [!/^\d{6,12}$/.test(nim.trim()) && "nim", !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim()) && "email"].filter(
      Boolean
    ) as string[];
    if (missing.length) {
      setError(new ApiError("INVALID_INPUT", missing.length === 2 ? "Isi NIM dan email dengan benar." : missing[0] === "nim" ? "NIM harus berupa angka." : "Format email belum benar.", 0));
      flag(missing);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await apiFetch("/v1/auth/forgot-password", { json: { nim: nim.trim(), email: email.trim(), system } });
      setSent({ system, email: email.trim().toLowerCase() });
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError("ERROR", "Gagal mengirim link. Coba lagi.", 0);
      setError(apiErr);
      flag(apiErr.fields ?? []);
    } finally {
      setBusy(false);
    }
  }

  if (sent) return <ResetLinkSent sent={sent} onResend={() => setSent(null)} onBack={onBack} />;

  return (
    <form onSubmit={submit} noValidate className="login-form-in space-y-4">
      <SystemToggle value={system} onChange={setSystem} disabled={busy} />

      <div ref={bind("nim")}>
        <label htmlFor="forgot-nim" className="mb-2 block text-sm font-semibold text-foreground">
          NIM
        </label>
        <input
          id="forgot-nim"
          inputMode="numeric"
          autoComplete="username"
          placeholder="152xxxxx"
          value={nim}
          onChange={(e) => {
            setNim(e.target.value);
            clear("nim");
          }}
          aria-invalid={hasError("nim")}
          className={`${fieldClass} font-mono tracking-wider ${hasError("nim") ? "field-error" : ""}`}
        />
      </div>

      <div ref={bind("email")}>
        <label htmlFor="forgot-email" className="mb-2 block text-sm font-semibold text-foreground">
          Email terdaftar di {PASSWORD_SYSTEM_LABEL[system]}
        </label>
        <input
          id="forgot-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="nama@gmail.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            clear("email");
          }}
          aria-invalid={hasError("email")}
          className={`${fieldClass} ${hasError("email") ? "field-error" : ""}`}
        />
      </div>

      <ErrorNote error={error} />

      <button type="submit" disabled={busy} className={`${primaryButtonClass} min-h-12 w-full`}>
        <Send className="h-4 w-4" aria-hidden="true" />
        {busy ? "Mengirim link..." : "Kirim link reset"}
      </button>

      <div className="border-t-2 border-dashed border-px-soft pt-2">
        <BackToLogin onClick={onBack} />
      </div>
    </form>
  );
}

/** Langkah 2: link sudah di email. Password baru disetel di situs kampus lewat link itu, bukan di Mira. */
function ResetLinkSent({ sent, onResend, onBack }: { sent: SentInfo; onResend: () => void; onBack: () => void }) {
  const label = PASSWORD_SYSTEM_LABEL[sent.system];
  return (
    <div className="login-form-in space-y-5" role="status">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center bg-[#0F766E] text-white shadow-[3px_3px_0_0_#072033]">
          <MailCheck className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="font-display text-lg font-bold text-foreground">Cek email kamu</p>
          <p className="mt-0.5 text-sm text-secondary">
            Link reset {label} dikirim ke <span className="whitespace-nowrap font-semibold text-foreground">{maskEmail(sent.email)}</span>
          </p>
        </div>
      </div>

      <ol className="space-y-2.5 bg-[#F0F7FB] px-4 py-3.5 text-sm text-foreground shadow-[inset_0_0_0_2px_#CFE2EE]">
        {[
          `Buka email dari ${label}. Cek folder Spam kalau belum masuk.`,
          `Klik link reset. Berlaku ${RESET_TTL_MINUTES} menit.`,
          `Buat password baru di situs ${label}, lalu login lagi di Mira.`,
        ].map((text, i) => (
          <li key={text} className="flex gap-2.5">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center bg-[#072033] font-mono text-[10px] font-bold text-white">{i + 1}</span>
            <span className="leading-snug">{text}</span>
          </li>
        ))}
      </ol>

      <button type="button" onClick={onBack} className={`${primaryButtonClass} min-h-12 w-full`}>
        <LogIn className="h-4 w-4" aria-hidden="true" />
        Kembali ke login
      </button>

      <div className="border-t-2 border-dashed border-px-soft pt-2">
        <button
          type="button"
          onClick={onResend}
          className="inline-flex min-h-11 items-center gap-1.5 font-mono text-xs font-semibold text-[#0369A1] hover:underline"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
          Belum masuk? Kirim ulang
        </button>
      </div>
    </div>
  );
}

