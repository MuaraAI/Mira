"use client";

import { Activity, GitBranch, Users } from "lucide-react";
import { useApi } from "@/lib/api";

interface PublicStatsData {
  users?: { active_24h?: number; active_7d?: number; active_30d?: number };
  requests?: { total_24h?: number; total_7d?: number; total_30d?: number };
  branches?: { name: string; active_users_30d: number }[];
  programs?: { name: string; active_users_30d: number }[];
}

function formatCount(value?: number) {
  if (typeof value !== "number") return null;
  return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function PublicStats() {
  const { data, loading, error, reload } = useApi<PublicStatsData>("/v1/stats", { ttlMs: 60_000 });
  const hasStats = Boolean(data?.users || data?.requests || data?.branches?.length || data?.programs?.length);

  return (
    <section id="stats" aria-labelledby="public-stats-title" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20">
      <div className="flex flex-col gap-3 border-b border-stroke pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="section-kicker mb-2">Data publik</p>
          <h2 id="public-stats-title" className="font-display text-2xl font-bold tracking-[-0.02em] text-foreground sm:text-3xl">Aktivitas UBSI API</h2>
        </div>
        <span className="text-xs text-secondary">Agregat anonim, rolling 30 hari</span>
      </div>

      {loading && (
        <div className="mt-6 rounded-xl border border-stroke bg-white p-5 text-sm text-secondary" role="status">
          Memuat statistik publik...
        </div>
      )}

      {error && !loading && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-[#F3C2C2] bg-[#FFF7F7] p-5" role="alert">
          <div>
            <p className="font-semibold text-[#9F1239]">Statistik belum dapat dimuat.</p>
            <p className="mt-1 text-sm text-secondary">Data akademik tetap aman. Coba lagi atau lanjut ke dokumentasi API.</p>
          </div>
          <button type="button" onClick={reload} className="min-h-11 rounded-lg border border-[#BE123C] px-4 py-2 text-sm font-semibold text-[#9F123C] hover:bg-white">Coba lagi</button>
        </div>
      )}

      {!loading && !error && !hasStats && (
        <div className="mt-6 rounded-xl border border-stroke bg-white p-5 text-sm text-secondary">
          Statistik publik belum tersedia. Nilai akan muncul setelah layanan menerima aktivitas teragregasi.
        </div>
      )}

      {!loading && !error && hasStats && (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <StatItem icon={<Users aria-hidden="true" className="h-4 w-4" />} label="Mahasiswa aktif 30 hari" value={formatCount(data?.users?.active_30d)} />
            <StatItem icon={<Activity aria-hidden="true" className="h-4 w-4" />} label="Request 30 hari" value={formatCount(data?.requests?.total_30d)} />
            <StatItem icon={<GitBranch aria-hidden="true" className="h-4 w-4" />} label="Cabang aktif" value={data?.branches?.length ? String(data.branches.length) : null} />
          </div>
          <div className="mt-5 grid gap-5 text-sm sm:grid-cols-2">
            <StatList title="Cabang yang terdeteksi" values={data?.branches?.map((branch) => branch.name) ?? []} />
            <StatList title="Program studi yang terdeteksi" values={data?.programs?.map((program) => program.name) ?? []} />
          </div>
        </>
      )}
    </section>
  );
}

function StatItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | null }) {
  return (
    <div className="rounded-xl border border-stroke bg-white p-4">
      <span className="text-[#0369A1]">{icon}</span>
      <p className="mt-3 text-xs text-secondary">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-foreground">{value ?? "Belum tersedia"}</p>
    </div>
  );
}

function StatList({ title, values }: { title: string; values: string[] }) {
  return (
    <div className="border-t border-stroke pt-4">
      <p className="font-semibold text-foreground">{title}</p>
      {values.length > 0 ? <p className="mt-2 leading-6 text-secondary">{values.join(", ")}</p> : <p className="mt-2 text-secondary">Belum ada data untuk ditampilkan.</p>}
    </div>
  );
}
