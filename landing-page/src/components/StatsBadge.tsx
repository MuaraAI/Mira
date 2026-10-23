"use client";

import { useApi } from "@/lib/api";

interface PublicStats {
  users?: { total_all_time?: number; average_per_day?: number };
  requests?: { total_all_time?: number };
  branches?: { name: string; active_users_30d: number }[];
}

/** Label ramah kode cabang internal (fallback: kode mentah). */
function formatId(n: number): string {
  return new Intl.NumberFormat("id-ID").format(n);
}

export function StatsBadge() {
  const { data } = useApi<PublicStats>("/v1/stats", { refreshMs: 60_000 });

  if (!data?.users?.total_all_time) return null;

  const users = data.users.total_all_time;
  const avg = data.users.average_per_day;
  const requests = data.requests?.total_all_time;
  const branchesCount = data.branches?.length || 0;

  return (
    <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs font-semibold text-secondary" aria-label="Statistik pengguna terkini">
      <span>Dipercaya {formatId(users)} mahasiswa</span>
      {branchesCount > 0 && <span aria-hidden="true">·</span>}
      {branchesCount > 0 && <span>{branchesCount} cabang UBSI</span>}
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
