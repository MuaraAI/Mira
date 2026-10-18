"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { apiFetch, ApiError, useApi } from "@/lib/api";
import { inputClass, primaryButtonClass } from "@/components/dashboard-ui";
import { Monogram } from "@/components/Monogram";

function PasswordField({
  id,
  label,
  name,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-foreground">
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
          className={`${inputClass} pr-12`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? `Sembunyikan ${label}` : `Tampilkan ${label}`}
          aria-pressed={show}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-secondary hover:text-foreground"
        >
          {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </div>
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

  // Sudah login: langsung ke dashboard.
  const { data: me } = useApi<{ nim: string }>("/v1/auth/me");
  useEffect(() => {
    if (me?.nim) router.replace("/dashboard");
  }, [me, router]);

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
    try {
      const res = await apiFetch<{ nim: string; token?: string }>("/v1/auth/login", {
        json: {
          nim: nim.trim(),
          studentv2_pass: siakadPass,
          elearning_pass: mybestPass,
        },
      });
      if (res?.token && typeof window !== "undefined") {
        localStorage.setItem("ubsi_session_token", res.token);
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof ApiError ? err : new ApiError("ERROR", "Login gagal. Coba lagi.", 0));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      <div className="grid-overlay" aria-hidden="true" />

      <main id="main-content" className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="glass-card p-6 sm:p-10">
            <div className="flex items-center gap-3 mb-6">
              <Monogram className="w-9 h-9" />
              <div>
                <h1 className="text-xl font-display font-bold tracking-tight">Login Mahasiswa</h1>
                <p className="text-xs font-mono tracking-widest text-[#0369A1] font-bold uppercase">
                  UBSI API Dashboard
                </p>
              </div>
            </div>

            <p className="text-sm text-secondary mb-6">
              Masuk dengan NIM dan password kampus Anda. Password SIAKAD dan MyBest diverifikasi
              langsung ke server kampus dan tidak disimpan di sistem ini.
            </p>

            {error && (
              <div className="mb-5 rounded-sm border border-[#BE123C]/30 bg-[#F0F7FB] px-4 py-3" role="alert">
                <p className="font-mono text-xs font-bold uppercase tracking-widest text-[#BE123C]">
                  {error.code}
                </p>
                <p className="mt-0.5 text-sm text-[#BE123C]">{error.message}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="nim" className="mb-1.5 block text-sm font-semibold text-foreground">
                  NIM
                </label>
                <input
                  id="nim"
                  name="nim"
                  type="text"
                  inputMode="numeric"
                  required
                  minLength={3}
                  value={nim}
                  onChange={(e) => setNim(e.target.value)}
                  autoComplete="username"
                  placeholder="Contoh: 0110223xxx"
                  className={inputClass}
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

              <div className="flex items-start gap-2.5 pt-1">
                <input
                  id="agree"
                  type="checkbox"
                  required
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-stroke text-[#0369A1] focus:ring-2 focus:ring-[#0369A1]/40 cursor-pointer"
                />
                <label htmlFor="agree" className="text-xs text-secondary leading-relaxed cursor-pointer">
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
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={`${primaryButtonClass} w-full mt-2`}
              >
                <LogIn className="h-4 w-4" aria-hidden="true" />
                {submitting ? "Memeriksa kredensial kampus" : "Masuk"}
              </button>
            </form>

            <p className="mt-6 text-xs text-secondary leading-relaxed">
              Login dibatasi 5 percobaan per menit per NIM. Session aktif 7 hari dan diperpanjang
              otomatis selama akun tetap digunakan.
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-secondary">
            <a href="/" className="underline underline-offset-4 hover:text-foreground">
              Kembali ke halaman utama
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
