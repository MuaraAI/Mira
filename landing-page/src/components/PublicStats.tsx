"use client";

import { Activity, Users, GitBranch, Server, type LucideIcon } from "lucide-react";
import { useApi } from "@/lib/api";

interface PublicStatsData {
  users?: { active_30d?: number };
  requests?: { total_30d?: number };
  branches?: { name: string; active_users_30d: number }[];
  programs?: { name: string; active_users_30d: number }[];
}

function formatCount(value = 0) {
  return new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function PublicStats() {
  const { data, loading } = useApi<PublicStatsData>("/v1/stats", { ttlMs: 60_000 });
  const branches = data?.branches?.length ?? 0;

  const cards: [LucideIcon, string, string][] = [
    [Users, "Mahasiswa aktif", formatCount(data?.users?.active_30d)],
    [Activity, "Request diproses", formatCount(data?.requests?.total_30d)],
    [GitBranch, "Cabang UBSI", String(branches)],
    [Server, "Layanan terhubung", "6"],
  ];

  return (
    <section aria-labelledby="public-stats-title" className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
        <div>
          <p className="text-[11px] font-mono uppercase tracking-widest text-[#0369A1] font-bold">Live usage</p>
          <h2 id="public-stats-title" className="mt-1 text-xl sm:text-2xl font-display font-bold text-foreground">Ekosistem UBSI API</h2>
        </div>
        <span className="text-xs text-secondary">Agregat anonim 30 hari terakhir</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(([StatIcon, label, value]) => {
          return (
            <div key={String(label)} className="glass-card p-4 sm:p-5">
              <StatIcon className="w-4 h-4 text-[#0369A1]" aria-hidden="true" />
              <p className="mt-3 text-xs text-secondary">{label}</p>
              <p className="mt-1 text-xl font-display font-bold text-foreground">{loading ? "..." : value}</p>
            </div>
          );
        })}
      </div>
      {data?.branches && data.branches.length > 0 && (
        <p className="mt-3 text-xs text-secondary">Cabang aktif: {data.branches.map((branch) => branch.name).join(", ")}</p>
      )}
    </section>
  );
}
