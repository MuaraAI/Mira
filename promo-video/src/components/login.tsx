import React from "react";
import { ArrowLeft, Eye, LogIn } from "lucide-react";
import { BlinkBlock, Monogram, StepIcon, type StepState } from "./ui";
import { pageIn } from "./motion";
import { EASE_PX, prog } from "../lib/anim";

export type StepKey = "form" | "siakad" | "mybest" | "session" | "redirect";

/* Disalin dari AuthPortal.tsx */
export const LOGIN_STEPS: { key: StepKey; label: string; detail: string }[] = [
  { key: "form", label: "Cek isian", detail: "NIM dan kedua password" },
  { key: "siakad", label: "Login ke SIAKAD", detail: "students.bsi.ac.id" },
  { key: "mybest", label: "Login ke MyBest", detail: "elearning.bsi.ac.id" },
  { key: "session", label: "Menyimpan sesi", detail: "Terenkripsi, aktif 7 hari" },
  { key: "redirect", label: "Masuk ke dashboard", detail: "Sebentar lagi masuk" },
];

export interface LoginFormState {
  nim: string;
  siakad: number;
  mybest: number;
  agree: boolean;
  focus: "nim" | "siakad" | "mybest" | null;
  submit: "idle" | "hover" | "press";
}

export interface LoginCheckState {
  steps: Record<StepKey, StepState>;
  elapsed: number;
  appearAt: number;
}

const fieldClass = "px-input min-h-12 w-full px-4 py-2.5 text-sm text-foreground";

function Dots({ n }: { n: number }) {
  return <span style={{ letterSpacing: "0.18em", fontSize: 18, lineHeight: "20px" }}>{"•".repeat(n)}</span>;
}

function Field({
  t,
  label,
  anchor,
  focused,
  children,
  placeholder,
  empty,
  action,
  hint,
  password,
}: {
  t: number;
  label: string;
  anchor: string;
  focused: boolean;
  children?: React.ReactNode;
  placeholder: string;
  empty: boolean;
  action?: React.ReactNode;
  hint?: React.ReactNode;
  password?: boolean;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="block text-sm font-semibold text-foreground">{label}</span>
        {action}
      </div>
      <div className="relative">
        <div data-anchor={anchor} data-focus={focused} className={`${fieldClass} flex items-center ${password ? "pr-12" : ""}`}>
          {empty ? <span className="font-mono text-secondary/60">{placeholder}</span> : children}
          {focused && <BlinkBlock t={t} style={{ width: 2, height: 18, background: "#072033", marginLeft: 2 }} />}
        </div>
        {password && (
          <span className="absolute inset-y-0 right-0 flex min-w-12 items-center justify-center text-secondary">
            <Eye className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
      {hint && <div className="mt-1">{hint}</div>}
    </div>
  );
}

function formatElapsed(sec: number) {
  const seconds = Math.floor(sec);
  const tenths = Math.floor((sec % 1) * 10);
  return `00:${String(seconds).padStart(2, "0")}.${tenths}`;
}

/** LoginCheck dari AuthPortal.tsx: panel verifikasi 5 tahap dengan bar 10 segmen. */
export const LoginCheck: React.FC<{ t: number; nim: string; check: LoginCheckState }> = ({ t, nim, check }) => {
  const doneCount = LOGIN_STEPS.filter((s) => check.steps[s.key] === "done").length;
  const segments = 10;
  const filled = Math.round((doneCount / LOGIN_STEPS.length) * segments);
  const running = LOGIN_STEPS.find((s) => check.steps[s.key] === "running");
  const allDone = doneCount === LOGIN_STEPS.length;
  return (
    <div style={pageIn(t, check.appearAt)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="section-kicker mb-2">{allDone ? "Akses diterima" : "Memeriksa akses"}</p>
          <p className="truncate font-mono text-sm font-semibold text-foreground">NIM {nim}</p>
        </div>
        <span className="px-chip shrink-0 bg-px-tint px-2 py-1 font-mono text-[11px] font-bold text-[#075985] tabular">{formatElapsed(check.elapsed)}</span>
      </div>

      <div className="mt-5 grid grid-cols-10 gap-1" data-anchor="login-bar">
        {Array.from({ length: segments }, (_, i) => {
          const runningSeg = i === filled && running;
          // .login-seg-running: garis biru-air yang bergeser 4 langkah per 0.6s.
          const shift = Math.floor(((t % 0.6) / 0.6) * 4) * 4;
          return (
            <span
              key={i}
              className="h-3"
              style={
                i < filled
                  ? { background: "#0369A1" }
                  : runningSeg
                    ? { backgroundImage: "repeating-linear-gradient(90deg, #0369A1 0 4px, #9CC6E0 4px 8px)", backgroundSize: "16px 100%", backgroundPosition: `${shift}px 0` }
                    : { background: "#EAF3F9" }
              }
            />
          );
        })}
      </div>

      <ol className="mt-6 space-y-3">
        {LOGIN_STEPS.map((step, index) => {
          const state = check.steps[step.key];
          const p = prog(t, check.appearAt + index * 0.07, 0.36, EASE_PX);
          return (
            <li
              key={step.key}
              data-anchor={`step-${step.key}`}
              data-state={state}
              className={`login-step flex items-center gap-3 px-3 py-2.5 ${state === "running" ? "bg-px-highlight" : "bg-white"}`}
              style={{ opacity: p, transform: `translateX(${(1 - p) * -10}px)` }}
            >
              <StepIcon state={state} t={t} />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-semibold ${state === "pending" ? "text-secondary" : "text-foreground"}`}>{step.label}</span>
                <span className="block truncate font-mono text-[11px] text-secondary">{step.detail}</span>
              </span>
              <span className="shrink-0 font-mono text-[10px] font-bold uppercase text-secondary">
                {state === "running" ? (
                  <span className="text-[#0369A1]">
                    cek<span style={{ opacity: Math.floor(t * 2) % 2 === 0 ? 1 : 0 }}>_</span>
                  </span>
                ) : state === "done" ? (
                  <span className="text-[#0F766E]">ok</span>
                ) : (
                  ""
                )}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

/**
 * Halaman /login Mira versi desktop: panel brand gelap bergaris diagonal di kiri,
 * form "MIRA PORTAL" di kanan. Struktur & copy sama dengan AuthPortal.tsx.
 */
export const LoginDesktop: React.FC<{
  t: number;
  load: number;
  phase: "form" | "checking";
  form: LoginFormState;
  check: LoginCheckState;
}> = ({ t, load, phase, form, check }) => {
  const submitStyle: React.CSSProperties =
    form.submit === "hover"
      ? ({ ["--px-off" as string]: "6px", transform: "translate(-2px, -2px)" } as React.CSSProperties)
      : form.submit === "press"
        ? ({ ["--px-off" as string]: "1px", transform: "translate(2px, 2px)" } as React.CSSProperties)
        : {};
  return (
    <div className="flex bg-background text-foreground" style={{ width: 1440, height: 900, ...pageIn(t, load) }}>
      <aside className="login-brand flex h-full w-1/2 flex-col justify-between overflow-hidden p-16 text-white">
        <span className="inline-flex min-h-11 w-fit items-center gap-2 font-mono text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Kembali ke beranda
        </span>
        <div className="relative">
          <span className="inline-flex items-center gap-2 bg-[#FCD34D] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#072033] shadow-[3px_3px_0_0_#0369A1]">
            <span className="h-1.5 w-1.5 bg-[#072033]" aria-hidden="true" />
            Portal Mahasiswa
          </span>
          <p className="mt-8 font-display text-7xl font-bold uppercase leading-[0.95] tracking-[-0.04em]">
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

      <div className="relative flex h-full w-1/2 flex-col grid-overlay">
        <main className="relative z-10 flex flex-1 items-start justify-center px-4 pt-10">
          <div className="w-full max-w-md pr-[6px]">
            <div className="mb-8 flex items-center gap-3">
              <span className="px-frame flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden bg-white" style={{ ["--px-line" as string]: "#CFE2EE" }}>
                <Monogram size={40} />
              </span>
              <div className="min-w-0">
                <h1 className="font-display text-4xl font-bold uppercase leading-none tracking-[-0.03em]">
                  Mira <span className="text-[#0369A1]">Portal</span>
                </h1>
                <p className="mt-1.5 text-sm text-secondary">Masuk pakai akun SIAKAD dan MyBest.</p>
              </div>
            </div>

            <ol className="mb-4 grid grid-cols-2 gap-3">
              {[
                { n: 1, label: "Akun kampus", on: phase === "form" },
                { n: 2, label: "Verifikasi", on: phase === "checking" },
              ].map((step) => (
                <li
                  key={step.n}
                  className={`flex min-h-11 items-center gap-2.5 px-3 font-mono text-[11px] font-bold uppercase tracking-[0.14em] ${
                    step.on
                      ? "bg-white text-foreground shadow-[0_-2px_0_0_#163A55,0_2px_0_0_#163A55,-2px_0_0_0_#163A55,2px_0_0_0_#163A55,4px_4px_0_0_#0369A1]"
                      : "text-secondary/70 shadow-[inset_0_0_0_2px_#CFE2EE]"
                  }`}
                >
                  <span className={`flex h-5 w-5 items-center justify-center text-[10px] ${step.on ? "bg-[#072033] text-white" : "shadow-[inset_0_0_0_2px_#CFE2EE]"}`}>{step.n}</span>
                  {step.label}
                </li>
              ))}
            </ol>

            <div data-anchor="login-card" className="px-card bg-white p-8" style={{ ["--px-drop" as string]: "#0369A1", ["--px-off" as string]: "8px" }}>
              {phase === "checking" ? (
                <LoginCheck t={t} nim={form.nim} check={check} />
              ) : (
                <div>
                  <p className="mb-6 text-sm leading-relaxed text-secondary">
                    Password dicek langsung ke SIAKAD dan MyBest, lalu disimpan terenkripsi selama sesi aktif (7 hari) supaya kamu nggak perlu login ulang.
                  </p>
                  <div className="space-y-5">
                    <Field t={t} label="NIM" anchor="f-nim" focused={form.focus === "nim"} placeholder="152xxxxx" empty={!form.nim}>
                      <span className="font-mono tracking-wider">{form.nim}</span>
                    </Field>
                    <Field
                      t={t}
                      label="Password SIAKAD"
                      anchor="f-siakad"
                      focused={form.focus === "siakad"}
                      placeholder="xxxxx"
                      empty={form.siakad === 0}
                      password
                      action={<span className="inline-flex items-center font-mono text-[11px] font-semibold text-[#0369A1]">Lewati SIAKAD</span>}
                      hint={<p className="font-mono text-[11px] text-secondary">Opsional. Jika gagal atau belum ingat, kamu bisa lewati dulu.</p>}
                    >
                      <Dots n={form.siakad} />
                    </Field>
                    <div>
                      <Field t={t} label="Password MyBest" anchor="f-mybest" focused={form.focus === "mybest"} placeholder="xxxxx" empty={form.mybest === 0} password>
                        <Dots n={form.mybest} />
                      </Field>
                      <div className="mt-1 flex justify-end">
                        <span className="inline-flex min-h-10 items-center font-mono text-xs font-semibold text-[#0369A1]">Lupa password?</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 pt-1">
                      <span
                        data-anchor="f-agree"
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center"
                        style={{
                          background: form.agree ? "#0369A1" : "#fff",
                          boxShadow: form.agree ? "none" : "inset 0 0 0 2px #9CC6E0",
                        }}
                      >
                        {form.agree && (
                          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
                            <path d="M2 6.5 4.8 9 10 3" fill="none" stroke="#fff" strokeWidth="2" />
                          </svg>
                        )}
                      </span>
                      <span className="text-xs leading-relaxed text-secondary">
                        Saya sudah membaca dan menyetujui <span className="font-semibold text-[#0369A1] underline underline-offset-2">Kebijakan Privasi</span> dan{" "}
                        <span className="font-semibold text-[#0369A1] underline underline-offset-2">Syarat dan Ketentuan Layanan</span>, termasuk larangan otomasi akademik terlarang.
                      </span>
                    </div>
                    <span data-anchor="f-submit" className="px-btn mt-2 inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 py-2.5 text-sm font-bold" style={submitStyle}>
                      <LogIn className="h-4 w-4" aria-hidden="true" />
                      Masuk
                    </span>
                  </div>
                  <p className="mt-6 border-t-2 border-dashed border-px-soft pt-4 text-xs leading-relaxed text-secondary">
                    Maksimal 10 percobaan login per menit per IP. Lebih dari itu, IP diblokir otomatis (15 menit, naik jadi 1 jam lalu 24 jam bila diulang). Sesi aktif 7 hari.
                  </p>
                </div>
              )}
            </div>
            <p className="mt-6 text-center font-mono text-[11px] text-secondary">Mira bukan aplikasi resmi UBSI.</p>
          </div>
        </main>
      </div>
    </div>
  );
};
