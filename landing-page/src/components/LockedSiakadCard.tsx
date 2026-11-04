"use client";

import { useState } from "react";
import { Lock, KeyRound, Check, AlertCircle, ArrowRight } from "lucide-react";
import { apiFetch, ApiError, clearApiCache } from "@/lib/api";
import { primaryButtonClass, ghostButtonClass, inputClass } from "@/components/dashboard-ui";

interface LockedSiakadCardProps {
  title?: string;
  description?: string;
  onConnected?: () => void;
}

export function LockedSiakadCard({
  title = "Fitur SIAKAD Terkunci",
  description = "Halaman ini memerlukan data dari SIAKAD (students.bsi.ac.id). Hubungkan akun SIAKAD kamu untuk membuka jadwal, nilai, KRS, dan kartu ujian.",
  onConnected,
}: LockedSiakadCardProps) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim() || loading) return;

    setLoading(true);
    setError(null);
    try {
      await apiFetch<{ connected: boolean }>("/v1/auth/credentials", {
        json: {
          system: "siakad",
          password: password.trim(),
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
      const msg = err instanceof ApiError ? err.message : "Gagal menghubungkan akun SIAKAD. Coba lagi.";
      setError(msg);
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
            onClick={() => setOpen(true)}
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
              onClick={() => {
                setOpen(false);
                setError(null);
                setPassword("");
              }}
              disabled={loading || success}
              className={`${ghostButtonClass} text-xs`}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading || success || !password.trim()}
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
