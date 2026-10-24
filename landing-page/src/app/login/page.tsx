"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Eye, EyeOff, LogIn, X } from "lucide-react";
import { apiFetch, ApiError, useApi, setApiCache } from "@/lib/api";
import { inputClass, primaryButtonClass } from "@/components/dashboard-ui";
import { Monogram } from "@/components/Monogram";

// iOS men-zoom input di bawah 16px, jadi di HP teks input dibuat 16px.
const fieldClass = `${inputClass} min-h-12 text-base sm:text-sm`;

type StepKey = "form" | "siakad" | "mybest" | "session" | "redirect";
type StepState = "pending" | "running" | "done" | "failed";

const STEPS: { key: StepKey; label: string; detail: string }[] = [
  { key: "form", label: "Cek isian", detail: "NIM dan kedua password" },
  { key: "siakad", label: "Login ke SIAKAD", detail: "students.bsi.ac.id" },
  { key: "mybest", label: "Login ke MyBest", detail: "elearning.bsi.ac.id" },
  { key: "session", label: "Menyimpan sesi", detail: "Terenkripsi, aktif 7 hari" },
  { key: "redirect", label: "Masuk ke dashboard", detail: "Sebentar lagi masuk" },
];

const IDLE_STEPS: Record<StepKey, StepState> = {
  form: "pending",
  siakad: "pending",
  mybest: "pending",
  session: "pending",
  redirect: "pending",
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function PasswordField({
  id,
  label,
  name,
  value,
  onChange,
  autoComplete,
  disabled,
}: {
  id: string;
  label: string;
  name: string;
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
          name={name}
          type={show ? "text" : "password"}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          placeholder="xxxxx"
          disabled={disabled}
          className={`${fieldClass} pr-12`}
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

function StepIcon({ state }: { state: StepState }) {
  if (state === "done") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-[#0F766E] text-white shadow-[2px_2px_0_0_#072033]">
        <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }
  if (state === "failed") {
    return (
      <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-[#BE123C] text-white shadow-[2px_2px_0_0_#072033]">
        <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
      </span>
    );
  }
  if (state === "running") {
    return (
      <span className="login-step-running grid h-6 w-6 shrink-0 grid-cols-2 gap-[2px] p-[3px] shadow-[0_-2px_0_0_#0369A1,0_2px_0_0_#0369A1,-2px_0_0_0_#0369A1,2px_0_0_0_#0369A1]" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </span>
    );
  }
  return <span className="h-6 w-6 shrink-0 bg-white shadow-[0_-2px_0_0_#CFE2EE,0_2px_0_0_#CFE2EE,-2px_0_0_0_#CFE2EE,2px_0_0_0_#CFE2EE]" aria-hidden="true" />;
}

function formatElapsed(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const tenths = Math.floor((ms % 1000) / 100);
  return `00:${String(seconds).padStart(2, "0")}.${tenths}`;
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
  const segments = 10;
  const filled = Math.round((doneCount / STEPS.length) * segments);
  const runningStep = STEPS.find((step) => steps[step.key] === "running");

  return (
    <div className="login-check" role="status" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-kicker mb-2">{failed ? "Akses ditolak" : doneCount === STEPS.length ? "Akses diterima" : "Memeriksa akses"}</p>
          <p className="truncate font-mono text-sm font-semibold text-foreground">NIM {nim}</p>
        </div>
        <span className="px-chip shrink-0 bg-px-tint px-2 py-1 font-mono text-[11px] font-bold text-[#075985]">
          {formatElapsed((frozenAt ?? now) - startedAt)}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-10 gap-1" aria-hidden="true">
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className={`h-3 transition-colors duration-300 ${
              i < filled ? (failed ? "bg-[#BE123C]" : "bg-[#0369A1]") : i === filled && !failed && runningStep ? "login-seg-running" : "bg-px-tint"
            }`}
          />
        ))}
      </div>

      <ol className="mt-6 space-y-3">
        {STEPS.map((step, index) => {
          const state = steps[step.key];
          return (
            <li
              key={step.key}
              className={`login-step flex items-center gap-3 px-3 py-2.5 transition-colors duration-300 ${
                state === "running" ? "bg-px-highlight" : state === "failed" ? "bg-[#FFF1F2]" : "bg-white"
              }`}
              data-state={state}
              style={{ ["--i" as string]: index }}
            >
              <StepIcon state={state} />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${state === "pending" ? "text-secondary" : state === "failed" ? "text-[#BE123C]" : "text-foreground"}`}>
                  {step.label}
                </span>
                <span className="block truncate font-mono text-[11px] text-secondary">{step.detail}</span>
              </span>
              <span className="shrink-0 font-mono text-[10px] font-bold uppercase text-secondary">
                {state === "running" ? (
                  <span className="text-[#0369A1]">
                    cek<span className="px-cursor">_</span>
                  </span>
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
        <div className="mt-6" role="alert">
          <div className="px-frame bg-[#FFF1F2] px-4 py-3 [--px-line:#FDA4AF]">
            <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#BE123C]">{error.code}</p>
            <p className="mt-0.5 text-sm text-[#BE123C]">{error.message}</p>
          </div>
          <button type="button" onClick={onBack} className={`${primaryButtonClass} mt-5 w-full`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Perbaiki data login
          </button>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const [nim, setNim] = useState("");
  const [siakadPass, setSiakadPass] = useState("");
  const [mybestPass, setMybestPass] = useState("");
  const [agree, setAgree] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [phase, setPhase] = useState<"form" | "checking">("form");
  const [steps, setSteps] = useState<Record<StepKey, StepState>>(IDLE_STEPS);
  const [startedAt, setStartedAt] = useState(0);
  const [finished, setFinished] = useState(false);
  const nimRef = useRef<HTMLInputElement>(null);

  // Sudah login: langsung ke dashboard tanpa render form login
  const { data: me, loading: checkingSession } = useApi<{ nim: string }>("/v1/auth/me");
  useEffect(() => {
    if (me?.nim && phase === "form") router.replace("/dashboard");
  }, [me, router, phase]);

  if (checkingSession && !me) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center p-4">
        <div className="grid-overlay" aria-hidden="true" />
        <div className="flex flex-col items-center gap-3 relative z-10">
          <Monogram className="w-10 h-10 animate-pulse" />
          <p className="text-xs font-mono text-secondary">Memeriksa sesi login...</p>
        </div>
      </div>
    );
  }

  if (me?.nim && phase === "form") {
    return (
      <div className="flex flex-col min-h-screen bg-background text-foreground items-center justify-center p-4">
        <div className="grid-overlay" aria-hidden="true" />
        <div className="flex flex-col items-center gap-3 relative z-10">
          <Monogram className="w-10 h-10" />
          <p className="text-xs font-mono text-[#0369A1] font-semibold">
            Sesi aktif ({me.nim}). Mengalihkan ke dashboard...
          </p>
        </div>
      </div>
    );
  }

  const mark = (updates: Partial<Record<StepKey, StepState>>) => setSteps((prev) => ({ ...prev, ...updates }));

  function backToForm() {
    setPhase("form");
    setSteps(IDLE_STEPS);
    setFinished(false);
    window.requestAnimationFrame(() => nimRef.current?.focus());
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
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
    setSteps({ ...IDLE_STEPS, form: "running" });
    setStartedAt(Date.now());
    setPhase("checking");

    await sleep(350);
    // SIAKAD dan MyBest diverifikasi paralel di server, jadi keduanya berjalan bersamaan.
    mark({ form: "done", siakad: "running", mybest: "running" });

    try {
      const res = await apiFetch<{ nim: string; token?: string }>("/v1/auth/login", {
        json: {
          nim: nim.trim(),
          studentv2_pass: siakadPass,
          elearning_pass: mybestPass,
        },
      });
      mark({ siakad: "done" });
      await sleep(180);
      mark({ mybest: "done", session: "running" });

      if (res?.token && typeof window !== "undefined") {
        localStorage.setItem("ubsi_session_token", res.token);
      }
      // Prime cache /v1/auth/me seketika agar saat redirect ke /dashboard,
      // useRequireSession() langsung 0ms (authed = true) tanpa tunggu roundtrip network lagi.
      if (res?.nim) {
        setApiCache("/v1/auth/me", { nim: res.nim, auth_type: "session" });
      }
      await sleep(300);
      mark({ session: "done", redirect: "running" });
      await sleep(450);
      mark({ redirect: "done" });
      setFinished(true);
      router.replace("/dashboard");
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : new ApiError("ERROR", "Login gagal. Coba lagi.", 0);
      if (apiErr.code === "INVALID_CREDENTIALS") {
        // Pesan server menyebut sistem mana yang menolak: "password SIAKAD dan MyBest salah".
        mark({
          siakad: apiErr.message.includes("SIAKAD") ? "failed" : "done",
          mybest: apiErr.message.includes("MyBest") ? "failed" : "done",
        });
      } else {
        mark({ siakad: "failed", mybest: "failed" });
      }
      setError(apiErr);
      setFinished(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-[100dvh] bg-background text-foreground">
      {/* Panel brand (desktop): pola sama dengan portal USRC, warna Mira. */}
      <aside className="login-brand sticky top-0 hidden h-[100dvh] w-1/2 flex-col justify-between self-start overflow-hidden p-12 text-white lg:flex xl:p-16" aria-label="Tentang Mira">
        <Link href="/" className="group inline-flex min-h-11 w-fit items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-white/70 transition-colors hover:text-white">
          <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden="true" />
          Kembali ke beranda
        </Link>

        <div className="relative">
          <span className="inline-flex items-center gap-2 bg-[#FCD34D] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#072033] shadow-[3px_3px_0_0_#0369A1]">
            <span className="h-1.5 w-1.5 bg-[#072033]" aria-hidden="true" />
            Portal Mahasiswa
          </span>
          <p className="mt-8 font-display text-6xl font-bold uppercase leading-[0.95] tracking-[-0.04em] xl:text-7xl">
            Jadwal.
            <br />
            Tugas.
            <br />
            <span className="text-[#FCD34D]">Satu pintu.</span>
          </p>
          <p className="mt-8 max-w-md font-mono text-sm leading-7 text-[#9CC6E0]">
            Satu login untuk SIAKAD, MyBest, presensi, dan nilai. Password dicek langsung ke server kampus, lalu disimpan terenkripsi.
          </p>
        </div>

        <div className="flex items-center justify-between font-mono text-[11px] font-semibold uppercase tracking-[0.18em] text-white/55">
          <span>Mira · Muara AI · UBSI</span>
          <span className="inline-flex items-center gap-1.5 text-[#5EEAD4]">
            <span className="h-1.5 w-1.5 bg-[#5EEAD4]" aria-hidden="true" />
            AES-256
          </span>
        </div>
      </aside>

      <div className="relative flex min-h-[100dvh] flex-1 flex-col lg:w-1/2">
        <div className="grid-overlay" aria-hidden="true" />

        <header className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between px-4 pt-5 sm:pt-8 lg:hidden">
          <Link href="/" className="group inline-flex min-h-11 items-center gap-2 font-mono text-xs font-semibold text-secondary transition-colors hover:text-[#0369A1]">
            <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" aria-hidden="true" />
            Beranda
          </Link>
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold text-[#0F766E]">
            <span className="h-1.5 w-1.5 bg-[#0F766E]" aria-hidden="true" />
            AES-256
          </span>
        </header>

        <main id="main-content" className="relative z-10 flex flex-1 items-start justify-center px-4 pb-10 pt-4 sm:items-center sm:py-10">
          <div className="w-full max-w-md pr-[6px]">
            <div className="mb-6 flex items-center gap-3 sm:mb-8">
              <span className="px-frame flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden bg-white [--px-line:#CFE2EE]">
                <Monogram className="h-10 w-10" />
              </span>
              <div className="min-w-0">
                <h1 className="font-display text-3xl font-bold uppercase leading-none tracking-[-0.03em] sm:text-4xl">
                  Mira <span className="text-[#0369A1]">Portal</span>
                </h1>
                <p className="mt-1.5 text-sm text-secondary">Masuk pakai akun SIAKAD dan MyBest.</p>
              </div>
            </div>

            <ol className="mb-4 grid grid-cols-2 gap-3" aria-label="Tahap login">
              {[
                { n: 1, label: "Akun kampus", on: phase === "form" },
                { n: 2, label: "Verifikasi", on: phase === "checking" },
              ].map((step) => (
                <li
                  key={step.n}
                  aria-current={step.on ? "step" : undefined}
                  className={`flex min-h-11 items-center gap-2.5 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] transition-colors ${
                    step.on
                      ? "bg-white text-foreground shadow-[0_-2px_0_0_#163A55,0_2px_0_0_#163A55,-2px_0_0_0_#163A55,2px_0_0_0_#163A55,4px_4px_0_0_#0369A1]"
                      : "text-secondary/70 shadow-[inset_0_0_0_2px_#CFE2EE]"
                  }`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center text-[10px] ${step.on ? "bg-[#072033] text-white" : "shadow-[inset_0_0_0_2px_#CFE2EE]"}`}>
                    {step.n}
                  </span>
                  {step.label}
                </li>
              ))}
            </ol>

            <div className="px-card bg-white p-5 [--px-drop:#0369A1] [--px-off:8px] min-[400px]:p-6 sm:p-8">
            {phase === "checking" ? (
              <LoginCheck nim={nim.trim()} steps={steps} startedAt={startedAt} finished={finished} error={error} onBack={backToForm} />
            ) : (
              <div className="login-form-in">
                <p className="mb-6 text-sm leading-relaxed text-secondary">
                  Password dicek langsung ke SIAKAD dan MyBest, lalu disimpan terenkripsi selama sesi aktif (7 hari) supaya kamu nggak perlu login ulang.
                </p>

                {error && (
                  <div className="px-frame mb-6 bg-[#FFF1F2] px-4 py-3 [--px-line:#FDA4AF]" role="alert">
                    <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#BE123C]">
                      {error.code}
                    </p>
                    <p className="mt-0.5 text-sm text-[#BE123C]">{error.message}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <label htmlFor="nim" className="mb-2 block text-sm font-semibold text-foreground">
                      NIM
                    </label>
                    <input
                      ref={nimRef}
                      id="nim"
                      name="nim"
                      type="text"
                      inputMode="numeric"
                      required
                      minLength={3}
                      value={nim}
                      onChange={(e) => setNim(e.target.value)}
                      autoComplete="username"
                      placeholder="152xxxxx"
                      className={`${fieldClass} font-mono tracking-wider`}
                    />
                  </div>

                  <PasswordField
                    id="studentv2_pass"
                    label="Password SIAKAD"
                    name="studentv2_pass"
                    value={siakadPass}
                    onChange={setSiakadPass}
                    autoComplete="current-password"
                  />

                  <PasswordField
                    id="elearning_pass"
                    label="Password MyBest"
                    name="elearning_pass"
                    value={mybestPass}
                    onChange={setMybestPass}
                    autoComplete="current-password"
                  />

                  <label htmlFor="agree" className="flex cursor-pointer items-start gap-3 pt-1">
                    <input
                      id="agree"
                      type="checkbox"
                      required
                      checked={agree}
                      onChange={(e) => setAgree(e.target.checked)}
                      className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[#0369A1]"
                    />
                    <span className="text-xs text-secondary leading-relaxed">
                      Saya sudah membaca dan menyetujui{" "}
                      <a
                        href="/privacy"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#0369A1] underline underline-offset-2"
                      >
                        Kebijakan Privasi
                      </a>{" "}
                      dan{" "}
                      <a
                        href="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#0369A1] underline underline-offset-2"
                      >
                        Syarat dan Ketentuan Layanan
                      </a>
                      , termasuk larangan otomasi akademik terlarang.
                    </span>
                  </label>

                  <button
                    type="submit"
                    disabled={submitting}
                    className={`${primaryButtonClass} min-h-12 w-full mt-2`}
                  >
                    <LogIn className="h-4 w-4" aria-hidden="true" />
                    {submitting ? "Memeriksa kredensial kampus" : "Masuk"}
                  </button>
                </form>

                <p className="mt-6 border-t-2 border-dashed border-px-soft pt-4 text-xs text-secondary leading-relaxed">
                  Login dibatasi 5 percobaan per menit per NIM. Session aktif 7 hari dan diperpanjang
                  otomatis selama akun tetap digunakan.
                </p>
              </div>
            )}
          </div>

            <p className="mt-6 text-center font-mono text-[11px] text-secondary">
              Mira bukan aplikasi resmi UBSI.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
