"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, ClipboardPaste, Clock, Eye, EyeOff, KeyRound, Link2, LogIn, MailCheck, Send, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { inputClass, primaryButtonClass } from "@/components/dashboard-ui";
import { PASSWORD_SYSTEM_LABEL, PasswordSystem } from "@/lib/security";

const fieldClass = `${inputClass} min-h-12 text-base sm:text-sm`;
const RESET_TTL_MS = 60 * 60 * 1000;
const SENT_KEY = "mira_reset_sent";

export interface ResetTarget {
  system: PasswordSystem | null;
  token: string;
  email: string;
}

interface SentInfo {
  system: PasswordSystem;
  email: string;
  nim: string;
  sentAt: number;
}

export function readSentInfo(): SentInfo | null {
  try {
    const info = JSON.parse(localStorage.getItem(SENT_KEY) || "null") as SentInfo | null;
    return info && Date.now() - info.sentAt < RESET_TTL_MS * 2 ? info : null;
  } catch {
    return null;
  }
}

function saveSentInfo(info: SentInfo) {
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify(info));
  } catch {}
}

/** Pola sama dengan backend `parse_reset_link`: /reset-password/<token>?email=... */
export function parseResetLink(raw: string): ResetTarget | null {
  const text = raw.trim();
  const m = text.match(/\/reset-password\/([A-Za-z0-9]{20,128})/);
  if (!m) return null;
  let email = "";
  try {
    email = new URL(text.slice(text.indexOf("http"))).searchParams.get("email") ?? "";
  } catch {
    email = decodeURIComponent(text.match(/[?&]email=([^&\s]+)/)?.[1] ?? "");
  }
  const system: PasswordSystem | null = /students\.bsi\.ac\.id/.test(text)
    ? "siakad"
    : /elearning\.bsi\.ac\.id/.test(text)
      ? "mybest"
      : null;
  return { system, token: m[1], email: email.trim().toLowerCase() };
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain) return email;
  return `${local.slice(0, 2)}***@${domain}`;
}

function formatClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
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

/** Langkah 1: NIM + email. Kampus mengirim link reset ke email terdaftar. */
export function ForgotPasswordView({
  initialNim,
  onSent,
  onHaveLink,
  onBack,
}: {
  initialNim?: string;
  onSent: (info: SentInfo) => void;
  onHaveLink: () => void;
  onBack: () => void;
}) {
  const [system, setSystem] = useState<PasswordSystem>("mybest");
  const [nim, setNim] = useState(initialNim ?? "");
  const [email, setEmail] = useState("");
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
      const info = { system, email: email.trim().toLowerCase(), nim: nim.trim(), sentAt: Date.now() };
      saveSentInfo(info);
      onSent(info);
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError("ERROR", "Gagal mengirim link. Coba lagi.", 0);
      setError(apiErr);
      flag(apiErr.fields ?? []);
    } finally {
      setBusy(false);
    }
  }

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

      <div className="flex flex-wrap items-center justify-between gap-x-4 border-t-2 border-dashed border-px-soft pt-2">
        <BackToLogin onClick={onBack} />
        <button
          type="button"
          onClick={onHaveLink}
          className="inline-flex min-h-11 items-center gap-1.5 font-mono text-xs font-semibold text-[#0369A1] hover:underline"
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
          Sudah punya link?
        </button>
      </div>
    </form>
  );
}

function SecretField({
  id,
  label,
  value,
  onChange,
  invalid,
  inputRef,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  inputRef?: (el: HTMLElement | null) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div ref={inputRef}>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-foreground">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={invalid}
          className={`${fieldClass} pr-12 ${invalid ? "field-error" : ""}`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? `Sembunyikan ${label}` : `Tampilkan ${label}`}
          aria-pressed={show}
          className="absolute inset-y-0 right-0 flex min-w-12 items-center justify-center text-secondary hover:text-[#0369A1]"
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

function resetChecks(pw: string) {
  return [
    { ok: pw.length >= 8 && pw.length <= 64 && pw === pw.trim(), label: "Min. 8 karakter" },
    { ok: /[A-Za-z]/.test(pw) && /\d/.test(pw), label: "Huruf + angka" },
    { ok: pw.length > 0 && pw !== "Mhs-1945" && pw !== "Mhs-2026", label: "Bukan default" },
  ];
}

/** Langkah 2: tempel link dari email (atau buka link Mira), lalu setel password baru. */
export function ResetPasswordView({
  initialTarget,
  sent,
  onBack,
  onResend,
  onDone,
}: {
  initialTarget?: ResetTarget | null;
  sent: SentInfo | null;
  onBack: () => void;
  onResend: () => void;
  onDone: (nim?: string) => void;
}) {
  const [target, setTarget] = useState<ResetTarget | null>(initialTarget ?? null);
  const [system, setSystem] = useState<PasswordSystem>(initialTarget?.system ?? sent?.system ?? "mybest");
  const [linkText, setLinkText] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [doneMessage, setDoneMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const { flag, bind, hasError, clear } = useFieldErrors();

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Info "link dikirim" hanya relevan bila link yang dipakai memang untuk email itu.
  const sentInfo = sent && (!target?.email || target.email === sent.email) ? sent : null;
  const remaining = sentInfo ? sentInfo.sentAt + RESET_TTL_MS - now : null;
  const expired = remaining !== null && remaining <= 0;
  const checks = resetChecks(password);

  /** Baca link utuh (saat ditempel, ditinggalkan, atau submit); kembalikan target bila valid. */
  function applyLink(text: string): ResetTarget | null {
    setLinkText(text);
    const parsed = parseResetLink(text);
    if (parsed) {
      setTarget(parsed);
      if (parsed.system) setSystem(parsed.system);
      setLinkText("");
      setError(null);
      clear("link");
    }
    return parsed;
  }

  async function pasteFromClipboard() {
    try {
      applyLink(await navigator.clipboard.readText());
    } catch {
      document.getElementById("reset-link")?.focus();
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const link = target ?? applyLink(linkText);
    if (!link) {
      setError(new ApiError("INVALID_RESET_LINK", "Link belum valid. Tempel link lengkap dari email kampus.", 0));
      flag(["link"]);
      return;
    }
    if (!checks.every((c) => c.ok) || confirm !== password) {
      setError(new ApiError("WEAK_PASSWORD", confirm !== password ? "Ulangi password belum sama." : "Password baru belum memenuhi syarat.", 0));
      flag(confirm !== password && checks.every((c) => c.ok) ? ["confirm"] : ["password"]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ message: string }>("/v1/auth/reset-password", {
        json: { system: link.system ?? system, token: link.token, email: link.email || sent?.email || "", password },
      });
      try {
        localStorage.removeItem(SENT_KEY);
      } catch {}
      setDoneMessage(res?.message ?? "Password berhasil direset.");
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError("ERROR", "Reset gagal. Coba lagi.", 0);
      setError(apiErr);
      if (apiErr.fields?.includes("link")) setTarget(null);
      flag(apiErr.fields ?? []);
    } finally {
      setBusy(false);
    }
  }

  if (doneMessage) {
    return (
      <div className="login-form-in space-y-5 text-center" role="status">
        <span className="mx-auto flex h-14 w-14 items-center justify-center bg-[#0F766E] text-white shadow-[4px_4px_0_0_#072033]">
          <Check className="h-7 w-7" strokeWidth={3} aria-hidden="true" />
        </span>
        <div>
          <p className="font-display text-xl font-bold text-foreground">Password diperbarui</p>
          <p className="mt-1 text-sm text-secondary">{doneMessage}</p>
        </div>
        <button type="button" onClick={() => onDone(sent?.nim)} className={`${primaryButtonClass} min-h-12 w-full`}>
          <LogIn className="h-4 w-4" aria-hidden="true" />
          Masuk sekarang
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate className="login-form-in space-y-4">
      {sentInfo && (
        <div className={`flex items-start gap-3 px-3 py-3 ${expired ? "bg-[#FFF1F2] shadow-[inset_0_0_0_2px_#FDA4AF]" : "bg-[#F0FDFA] shadow-[inset_0_0_0_2px_#99D5CC]"}`}>
          <MailCheck className={`mt-0.5 h-5 w-5 shrink-0 ${expired ? "text-[#BE123C]" : "text-[#0F766E]"}`} aria-hidden="true" />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold text-foreground">
              Link dikirim ke <span className="whitespace-nowrap">{maskEmail(sentInfo.email)}</span>
            </p>
            <p className={`mt-0.5 flex items-center gap-1.5 font-mono text-xs ${expired ? "text-[#BE123C]" : "text-[#0F766E]"}`}>
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {expired ? "Link sudah kedaluwarsa" : <>Berlaku <span className="tabular-nums">{formatClock(remaining ?? 0)}</span> lagi</>}
            </p>
          </div>
          <button type="button" onClick={onResend} className="shrink-0 font-mono text-xs font-semibold text-[#0369A1] hover:underline">
            Kirim ulang
          </button>
        </div>
      )}

      {target && !target.system && <SystemToggle value={system} onChange={setSystem} disabled={busy} />}

      {target ? (
        <div className="flex items-center gap-3 bg-[#F0F7FB] px-3 py-2.5 shadow-[inset_0_0_0_2px_#CFE2EE]">
          <Link2 className="h-4 w-4 shrink-0 text-[#0369A1]" aria-hidden="true" />
          <p className="min-w-0 flex-1 truncate text-sm">
            <span className="font-semibold text-foreground">Link {PASSWORD_SYSTEM_LABEL[system]} siap</span>
            {(target.email || sent?.email) && <span className="text-secondary"> · {maskEmail(target.email || sent?.email || "")}</span>}
          </p>
          <button
            type="button"
            onClick={() => setTarget(null)}
            aria-label="Ganti link reset"
            className="flex h-9 w-9 shrink-0 items-center justify-center text-secondary hover:bg-white hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : (
        <div ref={bind("link")}>
          <label htmlFor="reset-link" className="mb-2 block text-sm font-semibold text-foreground">
            Link reset dari email
          </label>
          <div className="flex gap-2">
            <input
              id="reset-link"
              inputMode="url"
              autoComplete="off"
              placeholder="Tempel link di sini"
              value={linkText}
              onChange={(e) => {
                setLinkText(e.target.value);
                clear("link");
              }}
              onPaste={(e) => {
                const pasted = e.clipboardData.getData("text");
                if (parseResetLink(pasted)) {
                  e.preventDefault();
                  applyLink(pasted);
                }
              }}
              onBlur={() => linkText && applyLink(linkText)}
              aria-invalid={hasError("link")}
              className={`${fieldClass} min-w-0 flex-1 ${hasError("link") ? "field-error" : ""}`}
            />
            <button
              type="button"
              onClick={pasteFromClipboard}
              className="px-btn-ghost inline-flex min-h-12 shrink-0 items-center gap-1.5 px-3 text-xs font-bold"
            >
              <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
              Tempel
            </button>
          </div>
          <p className="mt-1.5 text-xs text-secondary">Salin link panjang dari email kampus, Mira yang merapikannya.</p>
        </div>
      )}

      <SecretField
        id="reset-password"
        label="Password baru"
        value={password}
        onChange={(v) => {
          setPassword(v);
          clear("password");
        }}
        invalid={hasError("password")}
        inputRef={bind("password")}
      />
      <ul className="flex flex-wrap gap-x-4 gap-y-1" aria-label="Syarat password">
        {checks.map((c) => (
          <li key={c.label} className={`flex items-center gap-1 font-mono text-[11px] ${c.ok ? "text-[#0F766E]" : "text-secondary"}`}>
            {c.ok ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <X className="h-3.5 w-3.5" aria-hidden="true" />}
            {c.label}
          </li>
        ))}
      </ul>
      <SecretField
        id="reset-confirm"
        label="Ulangi password baru"
        value={confirm}
        onChange={(v) => {
          setConfirm(v);
          clear("confirm");
        }}
        invalid={hasError("confirm") || (confirm.length > 0 && confirm !== password)}
        inputRef={bind("confirm")}
      />

      <ErrorNote error={error} />

      <button type="submit" disabled={busy} className={`${primaryButtonClass} min-h-12 w-full`}>
        <KeyRound className="h-4 w-4" aria-hidden="true" />
        {busy ? `Menyimpan ke ${PASSWORD_SYSTEM_LABEL[system]}...` : "Simpan password baru"}
      </button>

      <div className="border-t-2 border-dashed border-px-soft pt-2">
        <BackToLogin onClick={onBack} />
      </div>
    </form>
  );
}
