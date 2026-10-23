"use client";

import { useApi } from "@/lib/api";

interface PublicStats {
  users?: { total_all_time?: number; average_per_day?: number };
  requests?: { total_all_time?: number };
  branches?: { name: string; active_users_30d: number }[];
}

/** Label ramah kode cabang internal (fallback: kode mentah). */
const BRANCH_LABELS: Record<string, string> = { "30": "Pontianak" };

function formatId(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

/**
 * Badge stats live 1 baris untuk hero. Gagal fetch = badge hilang senyap,
 * jangan pernah ganggu first paint hero.
 */
export function StatsBadge() {
  const { data } = useApi<PublicStats>("/v1/stats", { refreshMs: 60_000 });

  if (!data?.users?.total_all_time) return null;

  const users = data.users.total_all_time;
  const avg = data.users.average_per_day;
  const requests = data.requests?.total_all_time;
  const branch = data.branches?.[0]?.name;
  const branchLabel = branch ? BRANCH_LABELS[branch] ?? branch : null;

  return (
    <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs font-semibold text-secondary" aria-label="Statistik pengguna terkini">
      <span>Dipercaya {formatId(users)} mahasiswa</span>
      {branchLabel && <span aria-hidden="true">·</span>}
      {branchLabel && <span>Cabang UBSI {branchLabel}</span>}
      {typeof avg === "number" && avg > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <span>{formatId(avg)} aktif/hari</span>
        </>
      )}
      {typeof requests === "number" && requests > 0 && (
        <>
          <span aria-hidden="true">·</span>
          <span>{formatId(requests)} request diproses</span>
        </>
      )}
    </p>
  );
}
