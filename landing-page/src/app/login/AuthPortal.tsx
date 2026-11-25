"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Eye, EyeOff, Hash, KeyRound, ShieldBan, X } from "lucide-react";
import { apiFetch, ApiError, useApi, clearApiCache, writeSessionToken } from "@/lib/api";
import { Monogram } from "@/components/Monogram";
import { ForgotPasswordView } from "@/components/auth/PasswordRecovery";
import { MaintenanceContent } from "@/components/MaintenanceContent";
import { useMaintenance } from "@/lib/maintenance";
import type { PasswordSystem } from "@/lib/security";

export type AuthView = "login" | "forgot";

const VIEW_PATH: Record<AuthView, string> = {
  login: "/login",
  forgot: "/lupa-password",
};

const VIEW_COPY: Record<AuthView, { title: string; accent: string; subtitle: string }> = {
  login: {
    title: "Mira",
    accent: "Portal",
    subtitle: "Masuk pakai akun MyBest. Data dan tugas kuliah langsung terbuka.",
  },
  forgot: {
    title: "Lupa",
    accent: "Password",
    subtitle: "Masukkan NIM dan email, link reset dikirim kampus.",
  },
};

// iOS men-zoom input di bawah 16px, jadi di HP teks input dibuat 16px.
const authButtonClass =
  "inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[6px] border-[1px] border-[#072033] bg-[#072033] px-5 py-2.5 text-[13px] font-medium tracking-[0.015em] text-white transition-colors duration-200 hover:bg-white hover:text-[#072033] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-[#072033] disabled:hover:text-white";

type StepKey = "form" | "kampus" | "session" | "redirect";
type StepState = "pending" | "running" | "done" | "failed";

const STEPS: { key: StepKey; label: string; detail: string }[] = [
  { key: "form", label: "Cek isian", detail: "NIM dan password MyBest" },
  { key: "kampus", label: "Verifikasi ke kampus", detail: "elearning.bsi.ac.id" },
  { key: "session", label: "Menyimpan sesi", detail: "Terenkripsi, aktif 7 hari" },
  { key: "redirect", label: "Masuk ke dashboard", detail: "Sebentar lagi masuk" },
];

const IDLE_STEPS: Record<StepKey, StepState> = {
  form: "pending",
  kampus: "pending",
  session: "pending",
  redirect: "pending",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Login memanggil dua server kampus; tanpa batas waktu UI bisa macet di "Memeriksa kredensial".
const LOGIN_TIMEOUT_MS = 60_000;

// Server memblokir IP yang spam login; simpan batas waktunya agar refresh halaman tidak bisa mengakali.
const BLOCK_KEY = "mira_login_blocked_until";

function readBlockedUntil(): number | null {
  try {
    const until = Number(localStorage.getItem(BLOCK_KEY) || 0);
    return until > Date.now() ? until : null;
  } catch {
    return null;
  }
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const sec = total % 60;
  const mmss = `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

/** Hitung mundur blokir IP; kembali null saat blokir habis. */
function useBlockedUntil() {
  const [until, setUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setUntil(readBlockedUntil());
  }, []);

  useEffect(() => {
    if (!until) return;
    const timer = window.setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= until) {
        setUntil(null);
        try {
          localStorage.removeItem(BLOCK_KEY);
        } catch {}
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, [until]);

  const block = (seconds: number) => {
    const next = Date.now() + seconds * 1000;
    try {
      localStorage.setItem(BLOCK_KEY, String(next));
    } catch {}
    setNow(Date.now());
    setUntil(next);
  };

  return { blockedUntil: until, remainingMs: until ? until - now : 0, block };
}

function PasswordField({
  id,
  label,
  name,
  value,
  onChange,
  autoComplete,
  disabled,
  required = true,
  action,
  hint,
  onBlur,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  disabled?: boolean;
  required?: boolean;
  action?: React.ReactNode;
  hint?: React.ReactNode;
  onBlur?: () => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label
          htmlFor={id}
          className="block font-mono text-[11px] uppercase tracking-[0.12em] text-secondary"
        >
          {label}
        </label>
        {action}
      </div>
      <div
        className={`auth-field-wrap group ${
          disabled ? "cursor-not-allowed bg-surface-alt opacity-60" : ""
        }`}
      >
        <span
          className="flex h-11 w-10 shrink-0 items-center justify-center text-[#648296] transition-colors duration-200 group-focus-within:text-[#0369A1]"
          aria-hidden="true"
        >
          <KeyRound className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          placeholder={disabled ? "Dilewati (bisa diisi nanti)" : "Masukkan password MyBest"}
          disabled={disabled}
          className="auth-field-input text-base sm:text-[13.5px]"
        />
        {!disabled && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? `Sembunyikan ${label}` : `Tampilkan ${label}`}
            aria-pressed={show}
            className="flex h-11 w-11 shrink-0 items-center justify-center text-[#648296] transition-colors duration-150 hover:text-[#072033]"
          >
            {show ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
      {hint && <div className="mt-1">{hint}</div>}
    </div>
  );
}

function StepIcon({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[9999px] bg-[#0F766E] text-white">
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[9999px] bg-[#BE123C] text-white">
        <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
      </span>
    );
  }
  if (state === "running") {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[9999px] border-[1.5px] border-[#0369A1] bg-[#EAF3F9]"
        aria-hidden="true"
      >
        <span className="h-2 w-2 rounded-[9999px] bg-[#0369A1]" />
      </span>
    );
  }
  return (
    <span
      className="h-6 w-6 shrink-0 rounded-[9999px] border-[1px] border-stroke bg-white"
      aria-hidden="true"
    />
  );
}

function formatElapsed(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const tenths = Math.floor((ms % 1000) / 100);
  return `00:${String(seconds).padStart(2, "0")}.${tenths}`;
}

function formatAuthError(error: ApiError): { title: string; detail: string; code: string } {
  const code = (error.code || "ERROR").toUpperCase();
  if (code === "INVALID_CREDENTIALS") {
    return {
      title: "NIM atau password MyBest salah",
      detail: "Periksa kembali NIM dan password MyBest kamu, atau pakai menu Lupa password.",
      code,
    };
  }
  if (code === "NETWORK_ERROR") {
    return {
      title: "Tidak dapat terhubung ke server",
      detail: "Pastikan koneksi internet stabil atau tunggu beberapa detik lalu coba lagi.",
      code,
    };
  }
  if (code === "TIMEOUT" || code === "ABORT_ERR") {
    return {
      title: "Waktu verifikasi habis",
      detail: "Server kampus merespons terlalu lambat. Coba kirim ulang login sebentar lagi.",
      code: "TIMEOUT",
    };
  }
  if (code === "CAPTCHA_INVALID") {
    return {
      title: "Verifikasi keamanan kampus gagal",
      detail: "Coba masuk ulang agar server mengulang verifikasi ke MyBest secara otomatis.",
      code,
    };
  }
  if (error.status === 429 || code === "RATE_LIMITED") {
    return {
      title: "Terlalu banyak percobaan login",
      detail: "Tunggu beberapa saat sebelum mencoba masuk kembali agar akun tetap aman.",
      code: "RATE_LIMITED",
    };
  }
  if (code === "VALIDATION_ERROR" || code === "AGREEMENT_REQUIRED") {
    return {
      title: code === "AGREEMENT_REQUIRED" ? "Persetujuan belum dicentang" : "Data login belum lengkap",
      detail: error.message,
      code,
    };
  }
  if (error.status >= 500) {
    return {
      title: "Server sedang mengalami gangguan",
      detail: "Server Mira atau portal MyBest kampus sedang sibuk. Coba lagi beberapa saat lagi.",
      code,
    };
  }
  return {
    title: "Verifikasi login gagal",
    detail: error.message || "Terjadi kendala saat memeriksa akun kampus. Coba lagi.",
    code,
  };
}

function AuthErrorBanner({ error, className = "" }: { error: ApiError; className?: string }) {
  const info = formatAuthError(error);
  return (
    <div
      className={`rounded-[6px] border-[1px] border-[#FECDD3] border-l-[3px] border-l-[#BE123C] bg-[#FFF5F6] px-3.5 py-2.5 ${className}`}
      role="alert"
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[12.5px] font-medium leading-snug text-[#9F1239]">{info.title}</p>
        <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.1em] text-[#BE123C]/80">
          {info.code}
        </span>
      </div>
      <p className="mt-1 text-[12px] leading-relaxed text-[#881337]">{info.detail}</p>
    </div>
  );
}

/** Panel pengecekan login: tiap langkah mengikuti status request yang sebenarnya. */
function LoginCheck({
  nim,
  steps,
  startedAt,
  finished,
  error,
  onBack,
}: {
  nim: string;
  steps: Record<StepKey, StepState>;
  startedAt: number;
  finished: boolean;
  error: ApiError | null;
  onBack: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const [frozenAt, setFrozenAt] = useState<number | null>(null);

  useEffect(() => {
    if (finished) {
      setFrozenAt(Date.now());
      return;
    }
    setFrozenAt(null);
    const timer = window.setInterval(() => setNow(Date.now()), 100);
    return () => window.clearInterval(timer);
  }, [finished]);

  const doneCount = STEPS.filter((step) => steps[step.key] === "done").length;
  const failed = STEPS.some((step) => steps[step.key] === "failed");
  const runningStep = STEPS.find((step) => steps[step.key] === "running");
  const progressPct = Math.min(
    100,
    Math.round(((doneCount + (runningStep && !failed ? 0.45 : 0)) / STEPS.length) * 100)
  );

  return (
    <div className="login-form-in" role="status" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p
            className={`font-mono text-[10.5px] uppercase tracking-[0.15em] ${
              failed ? "text-[#BE123C]" : doneCount === STEPS.length ? "text-[#0F766E]" : "text-[#0369A1]"
            }`}
          >
            {failed ? "Akses ditolak" : doneCount === STEPS.length ? "Akses diterima" : "Memeriksa akses"}
          </p>
          <p className="mt-0.5 truncate font-mono text-[13px] text-foreground">NIM {nim}</p>
        </div>
        <span className="shrink-0 rounded-[5px] border-[1px] border-stroke bg-surface-alt px-2 py-0.5 font-mono text-[11px] tabular-nums text-[#075985]">
          {formatElapsed((frozenAt ?? now) - startedAt)}
        </span>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-[9999px] bg-surface-alt" aria-hidden="true">
        <div
          className={`h-full transition-all duration-300 ${
            failed ? "bg-[#BE123C]" : doneCount === STEPS.length ? "bg-[#0F766E]" : "bg-[#0369A1]"
          }`}
          style={{ width: `${Math.max(12, progressPct)}%` }}
        />
      </div>

      <ol className="mt-4 divide-y-[1px] divide-stroke overflow-hidden rounded-[8px] border-[1px] border-stroke bg-white">
        {STEPS.map((step) => {
          const state = steps[step.key];
          return (
            <li
              key={step.key}
              className={`flex items-center gap-3 px-3 py-2.5 transition-colors duration-200 ${
                state === "running"
                  ? "bg-surface-alt"
                  : state === "failed"
                    ? "bg-[#FFF5F6]"
                    : "bg-white"
              }`}
              data-state={state}
            >
              <StepIcon state={state} />
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-[13px] leading-tight ${
                    state === "pending"
                      ? "text-secondary"
                      : state === "failed"
                        ? "text-[#BE123C]"
                        : "text-foreground"
                  }`}
                >
                  {step.label}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[10.5px] text-secondary">
                  {step.detail}
                </span>
              </span>
              <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] text-secondary">
                {state === "running" ? (
                  <span className="text-[#0369A1]">proses</span>
                ) : state === "done" ? (
                  <span className="text-[#0F766E]">ok</span>
                ) : state === "failed" ? (
                  <span className="text-[#BE123C]">gagal</span>
                ) : (
                  ""
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {failed && error && (
        <div className="mt-3.5">
          <AuthErrorBanner error={error} />
          <button type="button" onClick={onBack} className={`${authButtonClass} mt-3`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Perbaiki data login
          </button>
        </div>
      )}
    </div>
  );
}

export function AuthPortal({ initialView = "login" }: { initialView?: AuthView }) {
  const router = useRouter();
  const [view, setView] = useState<AuthView>(initialView);
  const [nim, setNim] = useState("");
  const [mybestPass, setMybestPass] = useState("");
  const [agree, setAgree] = useState(false);
  const [maintenanceDismissed, setMaintenanceDismissed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [phase, setPhase] = useState<"form" | "checking">("form");
  const [steps, setSteps] = useState<Record<StepKey, StepState>>(IDLE_STEPS);
  const [startedAt, setStartedAt] = useState(0);
  const [finished, setFinished] = useState(false);
  const [forgotSystem, setForgotSystem] = useState<PasswordSystem>("mybest");
  const nimRef = useRef<HTMLInputElement>(null);
  const { blockedUntil, remainingMs, block } = useBlockedUntil();
  const { status: maintenance } = useMaintenance();

  // URL ikut tampilan supaya refresh tetap di layar yang sama.
  function go(next: AuthView) {
    setView(next);
    setError(null);
    window.history.replaceState(null, "", VIEW_PATH[next]);
    window.scrollTo({ top: 0 });
  }

  // Sudah login: langsung ke dashboard tanpa render form login
  const { data: me, loading: checkingSession } = useApi<{ nim: string }>("/v1/auth/me");
  const onLogin = view === "login";
  useEffect(() => {
    if (onLogin && me?.nim && phase === "form") router.replace("/dashboard");
  }, [me, router, phase, onLogin]);

  if (onLogin && checkingSession && !me) {
    return (
      <div className="mira-auth flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground">
        <div className="flex flex-col items-center gap-3">
          <Monogram className="h-10 w-10" />
          <p className="font-mono text-xs text-secondary">Memeriksa sesi login...</p>
        </div>
      </div>
    );
  }

  if (onLogin && me?.nim && phase === "form") {
    return (
      <div className="mira-auth flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground">
        <div className="flex flex-col items-center gap-3">
          <Monogram className="h-10 w-10" />
          <p className="font-mono text-xs text-[#0369A1]">
            Sesi aktif ({me.nim}). Mengalihkan ke dashboard...
          </p>
        </div>
      </div>
    );
  }

  const mark = (updates: Partial<Record<StepKey, StepState>>) =>
    setSteps((prev) => ({ ...prev, ...updates }));

  function backToForm() {
    setPhase("form");
    setSteps(IDLE_STEPS);
    setFinished(false);
    window.requestAnimationFrame(() => nimRef.current?.focus());
  }

  function handleNimChange(value: string) {
    // Hanya terima angka agar NIM selalu valid sebelum dikirim ke server kampus.
    setNim(value.replace(/\D/g, ""));
    if (error) setError(null);
  }

  function handlePassChange(value: string) {
    setMybestPass(value);
    if (error) setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (blockedUntil || submitting) return;
    const cleanNim = nim.trim();
    const cleanPass = mybestPass.trim();
    if (!/^\d{6,16}$/.test(cleanNim)) {
      setError(
        new ApiError(
          "VALIDATION_ERROR",
          "Masukkan NIM mahasiswa UBSI berupa angka (minimal 6 digit).",
          0
        )
      );
      nimRef.current?.focus();
      return;
    }
    if (!cleanPass) {
      setError(new ApiError("VALIDATION_ERROR", "Password MyBest tidak boleh kosong.", 0));
      return;
    }
    if (!agree) {
      setError(
        new ApiError(
          "AGREEMENT_REQUIRED",
          "Centang persetujuan Kebijakan Privasi dan Syarat Layanan sebelum masuk.",
          0
        )
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    setFinished(false);
    setSteps({ ...IDLE_STEPS, form: "done", kampus: "running" });
    setStartedAt(Date.now());
    setPhase("checking");

    try {
      const res = await apiFetch<{
        nim: string;
        token?: string;
        systems?: { siakad: boolean; mybest: boolean };
        warnings?: string[];
      }>("/v1/auth/login", {
        signal: AbortSignal.timeout(LOGIN_TIMEOUT_MS),
        // Login web hanya memakai MyBest. SIAKAD ditautkan nanti di dashboard.
        json: {
          nim: cleanNim,
          elearning_pass: cleanPass,
        },
      });

      mark({ kampus: "done", session: "running" });

      if (res?.token) {
        writeSessionToken(res.token);
      }
      // Bersihkan cache sesi lama sebelum mengarah ke dashboard agar /v1/auth/me
      // memuat status tautan kanonis SIAKAD dan profil mahasiswa secara utuh.
      clearApiCache();
      mark({ session: "done", redirect: "running" });
      await sleep(150);
      mark({ redirect: "done" });
      setFinished(true);
      router.replace("/dashboard");
    } catch (err) {
      const isTimeout = err instanceof DOMException && err.name === "TimeoutError";
      const apiErr =
        err instanceof ApiError
          ? err
          : isTimeout
            ? new ApiError("TIMEOUT", "Waktu verifikasi ke server kampus habis.", 0)
            : new ApiError("NETWORK_ERROR", "Tidak dapat terhubung ke server.", 0);
      if (apiErr.retryAfter && apiErr.status === 429) {
        block(apiErr.retryAfter);
      }
      // Kredensial ditolak: kembalikan ke form dengan NIM & password tetap terisi.
      if (apiErr.code === "INVALID_CREDENTIALS" || apiErr.code === "CAPTCHA_INVALID") {
        setPhase("form");
        setSteps(IDLE_STEPS);
        setFinished(false);
      }
      if (apiErr.status === 429) {
        // Ditolak sebelum menyentuh server kampus.
        mark({ form: "failed", kampus: "pending" });
      } else {
        mark({ kampus: "failed" });
      }
      setError(apiErr);
      setFinished(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mira-auth flex min-h-[100dvh] bg-background text-foreground lg:h-[100dvh] lg:overflow-hidden">
      {maintenance?.enabled && !maintenanceDismissed && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#072033]/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Pemberitahuan maintenance"
        >
          <MaintenanceContent
            message={maintenance.message}
            reason={maintenance.reason}
            onClose={() => setMaintenanceDismissed(true)}
          />
        </div>
      )}

      <aside
        className="sticky top-0 hidden h-[100dvh] w-[54%] flex-col justify-between self-start overflow-hidden bg-[#061A2B] px-12 py-10 text-white lg:flex xl:px-16 xl:py-12"
        aria-label="Tentang Mira"
      >
        <div className="muara-ocean-base pointer-events-none absolute -inset-4" aria-hidden="true">
          <Image
            src="/images/login-ocean-muara.webp"
            alt=""
            fill
            priority
            quality={80}
            sizes="55vw"
            className="select-none object-cover object-center"
            aria-hidden="true"
          />
        </div>
        <div
          className="muara-ocean-surface pointer-events-none absolute -inset-4"
          aria-hidden="true"
        >
          <Image
            src="/images/login-ocean-muara.webp"
            alt=""
            fill
            quality={65}
            sizes="55vw"
            className="select-none object-cover object-center"
            aria-hidden="true"
          />
        </div>
        {/* Lapisan shade vertikal, radial kiri-bawah, dan tepi kanan agar langit & ombak terasa dalam serta teks menyatu. */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
          style={{
            backgroundImage: [
              "linear-gradient(to bottom, rgba(4, 18, 32, 0.72) 0%, rgba(4, 18, 32, 0.12) 36%, rgba(4, 18, 32, 0.28) 62%, rgba(4, 18, 32, 0.92) 100%)",
              "radial-gradient(ellipse 85% 65% at 15% 76%, rgba(4, 20, 36, 0.78) 0%, rgba(4, 20, 36, 0) 72%)",
              "linear-gradient(to left, rgba(4, 16, 28, 0.42) 0%, rgba(4, 16, 28, 0) 14%)",
            ].join(", "),
          }}
        />

        <div className="relative z-10 flex items-center justify-between">
          <Link
            href="/"
            className="group inline-flex min-h-[40px] w-fit items-center gap-2 text-[13px] text-[#DCEBF5] transition-colors hover:text-white"
          >
            <ArrowLeft
              className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5"
              aria-hidden="true"
            />
            Kembali ke beranda
          </Link>
        </div>

        <div className="relative z-10 mt-auto pb-8">
          <h2
            className="font-home-display max-w-[14ch] text-[clamp(2.65rem,4.4vw,4.15rem)] leading-[1.04] tracking-[-0.015em] text-white"
            style={{ textShadow: "0 12px 32px rgba(4, 18, 32, 0.58)" }}
          >
            Semua urusan kampus UBSI,{" "}
            <span className="text-[#7DD3FC]">di satu layar.</span>
          </h2>
          <p
            className="mt-5 max-w-[440px] text-[14.5px] leading-[1.7] text-[#E2F0F8]"
            style={{ textShadow: "0 4px 18px rgba(4, 18, 32, 0.65)" }}
          >
            Cek jadwal, tugas, presensi, sampai nilai tanpa bolak-balik portal. Cukup login sekali
            pakai akun MyBest, kredensial langsung dicek ke server kampus dan disimpan terenkripsi.
          </p>
        </div>

        <div className="relative z-10 flex items-center justify-between border-t-[1px] border-white/15 pt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-[#CBE0EE]">
          <span>Mira · Muara AI · UBSI</span>
          <span className="text-white/60">Satu Login · 6 Layanan</span>
        </div>
      </aside>

      <div className="relative flex min-h-[100dvh] flex-1 flex-col bg-background lg:h-[100dvh] lg:w-[46%] lg:overflow-y-auto">
        <header className="relative overflow-hidden bg-[#072033] text-white lg:hidden">
          <div className="muara-ocean-base pointer-events-none absolute -inset-3" aria-hidden="true">
            <Image
              src="/images/login-ocean-muara.webp"
              alt=""
              fill
              priority
              quality={65}
              sizes="100vw"
              className="select-none object-cover object-bottom"
              aria-hidden="true"
            />
          </div>
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(7, 32, 51, 0.72) 0%, rgba(7, 32, 51, 0.52) 55%, rgba(7, 32, 51, 0.88) 100%)",
            }}
          />
          <div className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between px-5 py-4">
            <Link
              href="/"
              className="group inline-flex min-h-[40px] items-center gap-2 text-[13px] text-[#DCEBF5] transition-colors hover:text-white"
            >
              <ArrowLeft
                className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5"
                aria-hidden="true"
              />
              Beranda
            </Link>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#9AD8F8]">
              Mira · UBSI
            </span>
          </div>
        </header>

        <main
          id="main-content"
          className="flex flex-1 items-start justify-center px-5 pb-6 pt-5 sm:items-center sm:px-6 sm:py-4"
        >
          <div className="w-full max-w-[430px]">
            <div className="mb-4 flex items-center gap-3.5">
              <Monogram className="h-10 w-10 shrink-0" />
              <div className="min-w-0">
                <h1 className="font-home-display text-2xl leading-none tracking-[0.02em] text-foreground sm:text-[26px]">
                  {VIEW_COPY[view].title}{" "}
                  <span className="text-[#0369A1]">{VIEW_COPY[view].accent}</span>
                </h1>
                <p className="mt-1 text-[12.5px] leading-snug text-secondary">
                  {VIEW_COPY[view].subtitle}
                </p>
              </div>
            </div>

            {onLogin && (
              <ol
                className="mb-4 grid grid-cols-2 gap-4 border-b-[1px] border-stroke"
                aria-label="Tahap login"
              >
                {[
                  { n: "01", label: "Akun kampus", on: phase === "form" },
                  { n: "02", label: "Verifikasi", on: phase === "checking" },
                ].map((step) => (
                  <li
                    key={step.n}
                    aria-current={step.on ? "step" : undefined}
                    className={`-mb-[1px] flex items-center gap-2 border-b-[2px] pb-2.5 text-[12.5px] tracking-[0.01em] transition-colors ${
                      step.on
                        ? "border-[#072033] text-foreground"
                        : "border-transparent text-secondary/65"
                    }`}
                  >
                    <span
                      className={`font-mono text-[11px] ${
                        step.on ? "text-[#0369A1]" : "text-secondary/55"
                      }`}
                    >
                      {step.n}
                    </span>
                    <span>{step.label}</span>
                  </li>
                ))}
              </ol>
            )}

            <div className="rounded-[10px] border-[1px] border-stroke bg-white p-5 sm:p-6">
              {view === "forgot" ? (
                <ForgotPasswordView
                  initialNim={nim.trim()}
                  initialSystem={forgotSystem}
                  onBack={() => go("login")}
                />
              ) : phase === "checking" ? (
                <LoginCheck
                  nim={nim.trim()}
                  steps={steps}
                  startedAt={startedAt}
                  finished={finished}
                  error={error}
                  onBack={backToForm}
                />
              ) : (
                <div className="login-form-in">
                  <p className="mb-4 text-[12.5px] leading-[1.6] text-secondary">
                    Gunakan NIM dan password MyBest. Sesi aktif selama 7 hari.
                  </p>

                  {blockedUntil && (
                    <div
                      className="mb-4 flex items-start gap-3 rounded-[8px] border-[1px] border-[#FDA4AF] bg-[#FFF1F2] px-3.5 py-3"
                      role="alert"
                    >
                      <ShieldBan
                        className="mt-0.5 h-5 w-5 shrink-0 text-[#BE123C]"
                        aria-hidden="true"
                      />
                      <div className="min-w-0">
                        <p className="font-mono text-xs uppercase tracking-widest text-[#BE123C]">
                          IP diblokir sementara
                        </p>
                        <p className="mt-0.5 text-[12.5px] leading-relaxed text-[#9F1239]">
                          Terlalu banyak percobaan login dari jaringan ini. Coba lagi dalam{" "}
                          <span className="font-mono tabular-nums">
                            {formatCountdown(remainingMs)}
                          </span>
                          .
                        </p>
                      </div>
                    </div>
                  )}

                  {error && !blockedUntil && <AuthErrorBanner error={error} className="mb-4" />}

                  <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
                    <div>
                      <div className="mb-1.5 flex items-center justify-between gap-2">
                        <label
                          htmlFor="nim"
                          className="block font-mono text-[11px] uppercase tracking-[0.12em] text-secondary"
                        >
                          NIM
                        </label>
                        {nim.trim().length > 0 && (
                          <span
                            className={`inline-flex items-center gap-1 font-mono text-[11px] tabular-nums transition-colors ${
                              nim.trim().length >= 8 ? "text-[#0F766E]" : "text-secondary/75"
                            }`}
                          >
                            {nim.trim().length >= 8 && (
                              <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden="true" />
                            )}
                            {nim.trim().length} digit
                          </span>
                        )}
                      </div>
                      <div className="auth-field-wrap group">
                        <span
                          className="flex h-11 w-10 shrink-0 items-center justify-center text-[#648296] transition-colors duration-200 group-focus-within:text-[#0369A1]"
                          aria-hidden="true"
                        >
                          <Hash className="h-4 w-4" strokeWidth={1.75} />
                        </span>
                        <input
                          ref={nimRef}
                          id="nim"
                          name="nim"
                          type="text"
                          inputMode="numeric"
                          required
                          minLength={3}
                          value={nim}
                          onChange={(e) => handleNimChange(e.target.value)}
                          autoComplete="username"
                          placeholder="152xxxxx"
                          className="auth-field-input font-mono text-base tracking-[0.06em] sm:text-[13.5px]"
                        />
                        {nim.length > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              setNim("");
                              nimRef.current?.focus();
                            }}
                            aria-label="Hapus NIM"
                            className="flex h-11 w-10 shrink-0 items-center justify-center text-[#648296] transition-colors duration-150 hover:text-[#072033]"
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>

                    <PasswordField
                      id="elearning_pass"
                      label="Password MyBest"
                      name="elearning_pass"
                      value={mybestPass}
                      onChange={handlePassChange}
                      autoComplete="current-password"
                      action={
                        <button
                          type="button"
                          onClick={() => {
                            setForgotSystem("mybest");
                            go("forgot");
                          }}
                          className="text-[12px] text-[#0369A1] underline-offset-4 hover:underline"
                        >
                          Lupa password?
                        </button>
                      }
                    />

                    <label
                      htmlFor="agree"
                      className="group flex cursor-pointer items-start gap-2.5 pt-0.5 select-none"
                    >
                      <span className="relative mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                        <input
                          id="agree"
                          type="checkbox"
                          required
                          checked={agree}
                          onChange={(e) => {
                            setAgree(e.target.checked);
                            if (error?.code === "AGREEMENT_REQUIRED") setError(null);
                          }}
                          className="peer sr-only"
                        />
                        <span
                          className={`flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border-[1px] transition-colors duration-150 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#0369A1] ${
                            agree
                              ? "border-[#072033] bg-[#072033] text-white"
                              : "border-[#B4CBD9] bg-white text-transparent group-hover:border-[#0369A1]"
                          }`}
                          aria-hidden="true"
                        >
                          <Check className="h-3 w-3" strokeWidth={3} />
                        </span>
                      </span>
                      <span className="text-[12px] leading-snug text-secondary">
                        Saya sudah membaca dan menyetujui{" "}
                        <a
                          href="/privacy"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0369A1] underline underline-offset-2 hover:text-[#072033]"
                        >
                          Kebijakan Privasi
                        </a>{" "}
                        dan{" "}
                        <a
                          href="/terms"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0369A1] underline underline-offset-2 hover:text-[#072033]"
                        >
                          Syarat dan Ketentuan Layanan
                        </a>
                        , termasuk larangan otomasi akademik terlarang.
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={submitting || Boolean(blockedUntil)}
                      className={`${authButtonClass} mt-1`}
                    >
                      {blockedUntil ? (
                        <ShieldBan className="h-4 w-4" aria-hidden="true" />
                      ) : null}
                      {blockedUntil
                        ? `Diblokir ${formatCountdown(remainingMs)}`
                        : submitting
                          ? "Memeriksa kredensial kampus"
                          : "Masuk ke Dashboard"}
                    </button>
                  </form>

                  <p className="mt-4 border-t-[1px] border-stroke pt-3 text-[11.5px] leading-relaxed text-secondary">
                    Batas login: 10 percobaan/menit per IP (blokir otomatis 15 menit hingga 24 jam
                    jika berulang).
                  </p>
                </div>
              )}
            </div>

            <p className="mt-3.5 text-center font-mono text-[11px] text-secondary">
              Mira bukan aplikasi resmi UBSI.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
