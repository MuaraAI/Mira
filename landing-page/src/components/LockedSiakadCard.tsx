"use client";

import { useRef, useState } from "react";
import { Lock, KeyRound, Check, AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import { apiFetch, ApiError, clearApiCache } from "@/lib/api";
import { primaryButtonClass, ghostButtonClass, inputClass } from "@/components/dashboard-ui";

interface LockedSiakadCardProps {
  title?: string;
  description?: string;
  onConnected?: () => void;
}

interface SiakadCaptcha {
  id: string;
  image: string;
  label: string;
  code: string;
  loading?: boolean;
}

export function LockedSiakadCard({
  title = "Fitur SIAKAD Terkunci",
  description = "Halaman ini memerlukan data dari SIAKAD (students.bsi.ac.id). Hubungkan akun SIAKAD kamu untuk membuka jadwal, nilai, KRS, dan kartu ujian.",
  onConnected,
}: LockedSiakadCardProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [captcha, setCaptcha] = useState<SiakadCaptcha | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  // Guard antar-load: respons yang mendarat setelah load lebih baru dibuang.
  const captchaGeneration = useRef(0);
  const captchaNim = useRef<string | null>(null);

  // Challenge CAPTCHA sekali pakai dan terikat ke NIM: setiap load mengganti
  // challenge lama secara menyeluruh, jangan pertahankan id/kode basi.
  async function loadCaptcha() {
    const generation = ++captchaGeneration.current;
    setCaptchaError(null);
    setCaptcha({ id: "", image: "", label: "SIAKAD", code: "", loading: true });
    try {
      const nim =
        captchaNim.current ??
        (captchaNim.current = (await apiFetch<{ nim: string }>("/v1/auth/me")).nim);
      const data = await apiFetch<{ id: string; image: string; label: string }>("/v1/auth/captcha", {
        json: { nim, host: "siakad" },
      });
      if (captchaGeneration.current !== generation) return;
      setCaptcha({ ...data, code: "" });
    } catch {
      if (captchaGeneration.current !== generation) return;
      captchaNim.current = null;
      setCaptcha(null);
      setCaptchaError("Gagal memuat CAPTCHA SIAKAD. Tekan Muat ulang untuk mencoba lagi.");
    }
  }

  function openForm() {
    setOpen(true);
    void loadCaptcha();
  }

  function closeForm() {
    captchaGeneration.current += 1; // buang respons in-flight
    setOpen(false);
    setError(null);
    setCaptchaError(null);
    setPassword("");
    setCaptcha(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim() || loading) return;
    if (!captcha || captcha.loading || !captcha.id || !captcha.code.trim()) {
      setError("Isi kode CAPTCHA SIAKAD dari gambar di atas dulu, lalu tekan Hubungkan.");
      if (!captcha || !captcha.loading) void loadCaptcha();
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await apiFetch<{ connected: boolean }>("/v1/auth/credentials", {
        json: {
          system: "siakad",
          password: password.trim(),
          captcha: { id: captcha.id, code: captcha.code.trim() },
        },
      });
      // Bersihkan cache me dan endpoint studentv2 agar request ulang langsung fresh
      clearApiCache();
      setSuccess(true);
      setTimeout(() => {
        onConnected?.();
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      }, 700);
    } catch (err) {
      // Challenge CAPTCHA sekali pakai: setiap gagal wajib memuat gambar baru.
      void loadCaptcha();
      setError(
        err instanceof ApiError
          ? err.message
          : "Gagal menghubungkan akun SIAKAD. Coba lagi."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="px-card bg-white p-6 sm:p-8 max-w-2xl mx-auto border-2 border-px-soft">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center bg-amber-50 text-amber-700 border-2 border-amber-300">
          <Lock className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100 px-2 py-0.5 inline-block mb-2">
            Akses Terbatas
          </span>
          <h2 className="font-display text-xl font-bold uppercase tracking-tight text-foreground sm:text-2xl">
            {title}
          </h2>
          <p className="mt-2 text-sm text-secondary leading-relaxed">
            {description}
          </p>
        </div>
      </div>

      {!open ? (
        <div className="mt-6 pt-6 border-t-2 border-dashed border-px-soft flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs text-secondary">
            Bisa dihubungkan kapan saja tanpa harus logout.
          </p>
          <button
            type="button"
            onClick={openForm}
            className={`${primaryButtonClass} text-xs`}
          >
            <KeyRound className="h-4 w-4" aria-hidden="true" />
            Hubungkan Akun SIAKAD
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 pt-6 border-t-2 border-dashed border-px-soft space-y-4">
          <div>
            <label htmlFor="siakad-inline-pass" className="block text-xs font-mono font-bold uppercase tracking-wider text-foreground mb-1.5">
              Password SIAKAD (students.bsi.ac.id)
            </label>
            <input
              id="siakad-inline-pass"
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Masukkan password SIAKAD"
              disabled={loading || success}
              className={`${inputClass} text-sm`}
            />
            <p className="mt-1 text-[11px] font-mono text-secondary">
              Password dicek langsung ke server kampus dan disimpan terenkripsi.
            </p>
          </div>

          {open && (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-[#0369A1]">
                  CAPTCHA SIAKAD
                </span>
                <button
                  type="button"
                  onClick={() => void loadCaptcha()}
                  disabled={Boolean(captcha?.loading) || success}
                  className="inline-flex min-h-8 items-center gap-1 font-mono text-[11px] font-semibold text-[#0369A1] hover:underline disabled:opacity-60"
                >
                  <RefreshCw className={`h-3 w-3 ${captcha?.loading ? "animate-spin" : ""}`} aria-hidden="true" />
                  Muat ulang
                </button>
              </div>
              <div className="flex items-center gap-3">
                {captcha?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={captcha.image}
                    alt="Kode CAPTCHA SIAKAD"
                    className="h-14 w-auto rounded border border-stroke bg-white"
                  />
                ) : (
                  <span className="flex h-14 w-32 items-center justify-center rounded border border-stroke bg-white font-mono text-[11px] text-secondary">
                    {captcha?.loading ? "Memuat..." : "Gagal"}
                  </span>
                )}
                <input
                  value={captcha?.code ?? ""}
                  onChange={(e) =>
                    setCaptcha((prev) => (prev ? { ...prev, code: e.target.value } : prev))
                  }
                  maxLength={8}
                  required
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="Kode"
                  aria-label="Kode CAPTCHA SIAKAD"
                  className={`${inputClass} font-mono text-sm`}
                />
              </div>
              {captchaError && (
                <p className="text-[11px] text-rose-700" role="alert">
                  {captchaError}
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800" role="alert">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800" role="status">
              <Check className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <span>Akun SIAKAD terhubung. Membuka halaman...</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeForm}
              disabled={loading || success}
              className={`${ghostButtonClass} text-xs`}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || success || !password.trim() || !captcha || captcha.loading || !captcha.id}
              className={`${primaryButtonClass} text-xs`}
            >
              {loading ? "Memverifikasi..." : success ? "Terhubung" : "Simpan & Buka Fitur"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
