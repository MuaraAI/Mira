"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, ExternalLink, GraduationCap, Link2Off, School } from "lucide-react";
import { apiFetch, ApiError, clearApiCache, useApi } from "@/lib/api";
import { ghostButtonClass, inputClass } from "@/components/dashboard-ui";

/** Bentuk data dari `GET /v1/auth/me` (lihat docs/api.md). */
export interface MeLinks {
  nim: string | null;
  session?: { expires_in: number; expires_at: string; days_left: number } | null;
  systems?: { siakad: boolean; mybest: boolean };
  links?: {
    mybest?: { linked: boolean; required: boolean; linked_password: string | null };
    siakad?: { linked: boolean; required: boolean; linked_password: string | null };
  };
}

const SIAKAD_FEATURES = [
  "KRS dan total SKS semester",
  "KHS, IPK, dan nilai per semester",
  "Jadwal kuliah versi SIAKAD",
  "Ruang ujian UTS, UAS, dan HER",
  "Kalender akademik dan kontak prodi",
];

const MYBEST_FEATURES = [
  "Jadwal dan kelas hari ini",
  "Tugas, kuis, dan materi",
  "Presensi dan rekap kehadiran",
  "Nilai tugas yang sudah dinilai",
];

function formatRemaining(seconds: number) {
  if (seconds <= 0) return "kedaluwarsa";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days} hari ${hours} jam`;
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours > 0 ? `${hours} jam ${minutes} menit` : `${minutes} menit`;
}

/** Hitung mundur dari nilai awal, tanpa memanggil ulang server tiap detik. */
function useCountdown(initialSeconds?: number | null) {
  const [seconds, setSeconds] = useState<number | null>(initialSeconds ?? null);

  useEffect(() => {
    setSeconds(initialSeconds ?? null);
  }, [initialSeconds]);

  useEffect(() => {
    if (seconds === null) return;
    const timer = window.setInterval(() => {
      setSeconds((prev) => (prev === null || prev <= 1 ? prev : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [seconds === null]); // eslint-disable-line react-hooks/exhaustive-deps

  return seconds;
}

export function CampusSystemsCard({ me, onChanged }: { me: MeLinks | null; onChanged?: () => void }) {
  const remaining = useCountdown(me?.session?.expires_in);
  const [linking, setLinking] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState<"link" | "unlink" | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  async function linkSiakad(event: React.FormEvent) {
    event.preventDefault();
    if (!password.trim() || busy) return;
    setBusy("link");
    setFeedback(null);
    try {
      await apiFetch("/v1/auth/credentials", {
        method: "POST",
        json: { system: "siakad", password: password.trim() },
      });
      setFeedback({ ok: true, message: "SIAKAD berhasil dihubungkan." });
      setPassword("");
      setLinking(false);
      clearApiCache("/v1/auth/me");
      clearApiCache("/v1/auth/security");
      onChanged?.();
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      setFeedback({
        ok: false,
        message: apiErr?.message ?? "Gagal menghubungkan SIAKAD. Coba lagi.",
      });
    } finally {
      setBusy(null);
    }
  }

  async function unlinkSiakad() {
    if (busy) return;
    setBusy("unlink");
    setFeedback(null);
    try {
      await apiFetch("/v1/auth/credentials/siakad", { method: "DELETE" });
      setFeedback({ ok: true, message: "Tautan SIAKAD dilepas." });
      clearApiCache("/v1/auth/me");
      clearApiCache("/v1/auth/security");
      onChanged?.();
    } catch (err) {
      const apiErr = err instanceof ApiError ? err : null;
      setFeedback({ ok: false, message: apiErr?.message ?? "Gagal melepas tautan SIAKAD." });
    } finally {
      setBusy(null);
    }
  }


  const mybest = me?.links?.mybest;
  const siakad = me?.links?.siakad;

  const siakadPasswordLabel =
    siakad?.linked_password === "separate"
      ? "Password berbeda dari MyBest"
      : siakad?.linked_password === "mybest"
        ? "Memakai password MyBest"
        : null;

  return (
    <section className="glass-card space-y-5 border-l-4 border-l-[#0369A1] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stroke pb-3">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-[#0369A1]" aria-hidden="true" />
          <h2 className="font-display text-base font-bold text-foreground">Sesi & Sistem Kampus</h2>
        </div>
        {remaining !== null && (
          <span
            className="inline-flex items-center gap-1.5 bg-[#F0F7FB] px-2.5 py-1 font-mono text-[11px] font-bold text-[#075985]"
            title={me?.session?.expires_at ? `Berakhir ${me.session.expires_at}` : undefined}
          >
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {formatRemaining(remaining)} lagi
          </span>
        )}
      </div>

      <p className="text-xs leading-relaxed text-secondary">
        Satu login Mira menampung dua akun kampus. Sesi otomatis diperpanjang selama kamu membuka Mira,
        jadi tidak perlu login ulang tiap minggu.
      </p>

      <div className="grid gap-3 md:grid-cols-2">
        <SystemRow
          icon={School}
          name="SIAKAD"
          portal="https://students.bsi.ac.id"
          linked={Boolean(siakad?.linked)}
          required={Boolean(siakad?.required)}
          note={siakadPasswordLabel}
          features={SIAKAD_FEATURES}
        />
        <SystemRow
          icon={GraduationCap}
          name="MyBest"
          portal="https://elearning.bsi.ac.id"
          linked={Boolean(mybest?.linked)}
          required={Boolean(mybest?.required)}
          note={mybest?.linked ? "Password wajib, dipakai untuk login Mira" : null}
          features={MYBEST_FEATURES}
        />
      </div>

      {!siakad?.linked && (
        <div className="space-y-3 bg-[#FFF7ED] p-3 shadow-[inset_0_0_0_2px_#FCD34D]">
          <p className="text-xs leading-relaxed text-[#92400E]">
            SIAKAD belum tertaut. Hubungkan supaya KRS, KHS, dan jadwal kuliah muncul di Mira.
          </p>
          {linking ? (
            <form onSubmit={linkSiakad} className="flex flex-col gap-2 sm:flex-row">
              <label className="sr-only" htmlFor="siakad-password">
                Password SIAKAD
              </label>
              <input
                id="siakad-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="Password SIAKAD"
                className={`${inputClass} min-w-0 flex-1`}
                required
              />
              <div className="flex gap-2">
                <button type="submit" disabled={busy !== null} className={`${ghostButtonClass} shrink-0 text-xs`}>
                  {busy === "link" ? "Menghubungkan..." : "Hubungkan"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLinking(false);
                    setPassword("");
                  }}
                  disabled={busy !== null}
                  className={`${ghostButtonClass} shrink-0 text-xs`}
                >
                  Batal
                </button>
              </div>
            </form>
          ) : (
            <button type="button" onClick={() => setLinking(true)} className={`${ghostButtonClass} text-xs`}>
              Hubungkan SIAKAD
            </button>
          )}
        </div>
      )}

      {siakad?.linked && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stroke/60 pt-3">
          <p className="text-[11px] text-secondary">
            Melepas tautan menyembunyikan fitur SIAKAD, tapi jadwal dan tugas MyBest tetap jalan.
          </p>
          <button
            type="button"
            onClick={unlinkSiakad}
            disabled={busy !== null}
            className={`${ghostButtonClass} shrink-0 text-xs text-[#BE123C] hover:border-[#BE123C]/40`}
          >
            <Link2Off className="h-3.5 w-3.5" aria-hidden="true" />
            {busy === "unlink" ? "Melepas..." : "Lepas tautan SIAKAD"}
          </button>
        </div>
      )}

      {feedback && (
        <p
          role="status"
          className={`text-xs leading-relaxed ${feedback.ok ? "text-[#0F766E]" : "text-[#BE123C]"}`}
        >
          {feedback.message}
        </p>
      )}

      <p className="flex items-start gap-2 border-t border-stroke/60 pt-3 text-[11px] leading-relaxed text-secondary">
        <Link2Off className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        Kalau kamu ganti password di portal kampus, Mira akan meminta login ulang karena password lama tidak bisa dipakai lagi.
        Mencabut izin perangkat atau logout dari semua sesi juga langsung mengakhiri sesi.
      </p>
    </section>
  );
}

function SystemRow({
  icon: Icon,
  name,
  portal,
  linked,
  required,
  note,
  features,
}: {
  icon: typeof School;
  name: string;
  portal: string;
  linked: boolean;
  required: boolean;
  note: string | null;
  features: string[];
}) {
  return (
    <div
      className={`space-y-2.5 border p-3.5 ${
        linked ? "border-[#0F766E]/30 bg-[#F0FDFA]" : "border-stroke bg-[#F7FAFC]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-bold text-foreground">
          <Icon className="h-4 w-4 text-[#0369A1]" aria-hidden="true" />
          {name}
        </span>
        <span
          className={`font-mono text-[10px] font-bold uppercase tracking-wider ${
            linked ? "text-[#0F766E]" : "text-secondary"
          }`}
        >
          {linked ? "Tertaut" : "Belum tertaut"}
          {required && " · wajib"}
        </span>
      </div>

      {note && <p className="text-[11px] text-secondary">{note}</p>}

      <ul className="space-y-1">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-secondary">
            <CheckCircle2
              className={`mt-0.5 h-3 w-3 shrink-0 ${linked ? "text-[#0F766E]" : "text-stroke"}`}
              aria-hidden="true"
            />
            {feature}
          </li>
        ))}
      </ul>

      <a
        href={portal}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-[#0369A1] hover:underline"
      >
        Buka portal
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    </div>
  );
}
